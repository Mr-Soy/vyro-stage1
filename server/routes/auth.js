const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { detectFaces, findMatchingGrabId } = require('../services/faceService');
const supabase = require('../config/supabase');

/**
 * @swagger
 * /api/auth/selfie:
 *   post:
 *     summary: Authenticate with a selfie
 *     description: Upload a selfie image to identify the user and get their grab_id.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - selfie
 *             properties:
 *               selfie:
 *                 type: string
 *                 format: binary
 *                 description: Selfie image (JPEG/PNG, max 5MB)
 *     responses:
 *       200:
 *         description: Match found — returns grab_id and confidence
 *       400:
 *         description: No face detected or multiple faces detected
 *       404:
 *         description: No matching identity found
 */
router.post('/auth/selfie', (req, res, next) => {
  upload.single('selfie')(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'FILE_TOO_LARGE',
            message: 'File exceeds the 5MB size limit.',
          },
        });
      }
      return next(err);
    }

    try {
      // Validate file was provided
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'NO_FILE',
            message: 'No selfie file was uploaded. Send a file in the "selfie" field.',
          },
        });
      }

      // 1. Detect faces in the selfie
      const faces = await detectFaces(req.file.buffer);

      // 2. Validate exactly one face
      if (faces.length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'NO_FACE_DETECTED',
            message: 'No face was detected in the uploaded image. Please upload a clear selfie.',
          },
        });
      }

      if (faces.length > 1) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MULTIPLE_FACES',
            message: 'Multiple faces detected. Please upload an image with only your face.',
          },
        });
      }

      const selfieEncoding = faces[0].descriptor;

      // 3. Fetch ALL known faces from DB for in-memory comparison
      const { data: knownFaces, error: dbError } = await supabase
        .from('faces')
        .select('grab_id, encoding');

      if (dbError) {
        const err = new Error(`Failed to fetch known faces: ${dbError.message}`);
        err.code = 'DATABASE_ERROR';
        err.statusCode = 500;
        throw err;
      }

      if (!knownFaces || knownFaces.length === 0) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NO_MATCH',
            message: 'No faces in the database yet. The event photos have not been processed.',
          },
        });
      }

      // 4. Find the closest match in memory
      const match = findMatchingGrabId(selfieEncoding, knownFaces);

      if (!match) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NO_MATCH',
            message: 'No matching identity found in the database. You may not appear in any event photos.',
          },
        });
      }

      // 5. Count total images for this grab_id
      const { count: totalImages } = await supabase
        .from('face_image_map')
        .select('*', { count: 'exact', head: true })
        .eq('grab_id', match.grab_id);

      return res.json({
        success: true,
        data: {
          grab_id: match.grab_id,
          confidence: parseFloat((1 - match.distance).toFixed(4)),
          match_distance: parseFloat(match.distance.toFixed(4)),
          total_images: totalImages || 0,
        },
      });
    } catch (err) {
      next(err);
    }
  });
});

module.exports = router;
