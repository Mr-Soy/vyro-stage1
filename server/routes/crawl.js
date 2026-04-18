const express = require('express');
const router = express.Router();
const { crawlBucket } = require('../services/crawlService');

/**
 * @swagger
 * /api/crawl:
 *   post:
 *     summary: Crawl & ingest images from Supabase Storage
 *     description: Scans the storage bucket, detects faces in unprocessed images, assigns grab_ids.
 *     tags: [Crawl]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               bucket:
 *                 type: string
 *                 default: event-photos
 *                 description: Storage bucket name
 *               limit:
 *                 type: integer
 *                 default: 50
 *                 description: Max images to process in this batch
 *     responses:
 *       200:
 *         description: Crawl completed successfully
 *       500:
 *         description: Crawl failed
 */
router.post('/crawl', async (req, res, next) => {
  try {
    const { bucket = 'event-photos', limit = 50 } = req.body || {};

    const result = await crawlBucket(bucket, limit);

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
