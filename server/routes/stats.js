const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

/**
 * @swagger
 * /api/stats:
 *   get:
 *     summary: Get system statistics
 *     description: Returns counts of total images, processed images, unique faces, and face-to-image mappings.
 *     tags: [Stats]
 *     responses:
 *       200:
 *         description: System statistics
 */
router.get('/stats', async (req, res, next) => {
  try {
    const [
      { count: totalImages },
      { count: processedImages },
      { count: totalUniqueFaces },
      { count: totalFaceMappings },
    ] = await Promise.all([
      supabase.from('images').select('*', { count: 'exact', head: true }),
      supabase.from('images').select('*', { count: 'exact', head: true }).eq('processed', true),
      supabase.from('faces').select('*', { count: 'exact', head: true }),
      supabase.from('face_image_map').select('*', { count: 'exact', head: true }),
    ]);

    res.json({
      success: true,
      data: {
        total_images: totalImages || 0,
        processed_images: processedImages || 0,
        total_unique_faces: totalUniqueFaces || 0,
        total_face_mappings: totalFaceMappings || 0,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
