const express = require('express');
const router = express.Router();
const { getImagesByGrabId } = require('../services/imageService');

/**
 * @swagger
 * /api/images/{grab_id}:
 *   get:
 *     summary: Retrieve images by grab_id
 *     description: Fetch all event images where the identified person (grab_id) appears.
 *     tags: [Images]
 *     parameters:
 *       - in: path
 *         name: grab_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The unique face identity UUID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Images per page (max 100)
 *     responses:
 *       200:
 *         description: List of images for the given grab_id
 *       404:
 *         description: grab_id not found
 */
router.get('/images/:grab_id', async (req, res, next) => {
  try {
    const { grab_id } = req.params;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;

    // Validate grab_id is a UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(grab_id)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_GRAB_ID',
          message: 'The grab_id must be a valid UUID.',
        },
      });
    }

    const result = await getImagesByGrabId(grab_id, page, limit);

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
