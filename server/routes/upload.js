const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const supabase = require('../config/supabase');
const { processImage } = require('../services/crawlService');

const MAX_FILES = 20;

/**
 * @swagger
 * /api/upload/event-photos:
 *   post:
 *     summary: Upload event photos for face processing
 *     description: Upload up to 20 event photos. Each photo is stored in Supabase Storage and processed for face detection.
 *     tags: [Upload]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - photos
 *             properties:
 *               photos:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Event photos (JPEG/PNG/WebP, max 5MB each, up to 20 files)
 *     responses:
 *       200:
 *         description: Photos uploaded and processed
 *       400:
 *         description: No files uploaded or invalid files
 */
router.post('/upload/event-photos', (req, res, next) => {
  upload.array('photos', MAX_FILES)(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: { code: 'FILE_TOO_LARGE', message: 'One or more files exceed the 5MB limit.' },
        });
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
          success: false,
          error: { code: 'TOO_MANY_FILES', message: `Maximum ${MAX_FILES} files per upload.` },
        });
      }
      return next(err);
    }

    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'NO_FILES', message: 'No photo files were uploaded.' },
        });
      }

      const results = [];
      const bucket = 'event-photos';

      for (const file of req.files) {
        const fileName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

        // 1. Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(fileName, file.buffer, {
            contentType: file.mimetype,
            upsert: false,
          });

        if (uploadError) {
          results.push({
            file: file.originalname,
            success: false,
            error: uploadError.message,
          });
          continue;
        }

        // 2. Process the image (detect faces, store in DB)
        try {
          const processResult = await processImage(
            { name: fileName, metadata: { mimetype: file.mimetype } },
            bucket
          );
          results.push({
            file: file.originalname,
            success: true,
            newFaces: processResult.newFaces,
            matchedFaces: processResult.matchedFaces,
          });
        } catch (processErr) {
          results.push({
            file: file.originalname,
            success: true,
            uploaded: true,
            processingError: processErr.message,
          });
        }
      }

      const uploaded = results.filter((r) => r.success).length;
      const totalNew = results.reduce((s, r) => s + (r.newFaces || 0), 0);
      const totalMatched = results.reduce((s, r) => s + (r.matchedFaces || 0), 0);

      res.json({
        success: true,
        data: {
          total_uploaded: uploaded,
          total_failed: results.length - uploaded,
          new_faces: totalNew,
          matched_faces: totalMatched,
          details: results,
        },
      });
    } catch (err) {
      next(err);
    }
  });
});

module.exports = router;
