const supabase = require('../config/supabase');

/**
 * Generate a Supabase Storage public URL for a stored image.
 *
 * @param {string} bucket - Bucket name
 * @param {string} storagePath - File path within the bucket
 * @returns {string} Public URL
 */
function getImagePublicUrl(bucket, storagePath) {
  const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
  return data.publicUrl;
}

/**
 * Fetch all images associated with a grab_id, with pagination.
 *
 * @param {string} grabId - UUID of the face identity
 * @param {number} page - Page number (1-based)
 * @param {number} limit - Images per page (max 100)
 * @returns {Promise<{grab_id: string, total_images: number, page: number, limit: number, images: Array}>}
 */
async function getImagesByGrabId(grabId, page = 1, limit = 20) {
  // Clamp limit to 100
  limit = Math.min(Math.max(1, limit), 100);
  page = Math.max(1, page);

  const offset = (page - 1) * limit;

  // Verify the grab_id exists
  const { data: face, error: faceError } = await supabase
    .from('faces')
    .select('grab_id')
    .eq('grab_id', grabId)
    .single();

  if (faceError || !face) {
    const err = new Error('No identity found with the provided grab_id.');
    err.code = 'GRAB_ID_NOT_FOUND';
    err.statusCode = 404;
    throw err;
  }

  // Get total count of images for this grab_id
  const { count: totalImages } = await supabase
    .from('face_image_map')
    .select('*', { count: 'exact', head: true })
    .eq('grab_id', grabId);

  // Fetch the image IDs for this grab_id with pagination
  const { data: mappings, error: mapError } = await supabase
    .from('face_image_map')
    .select('image_id')
    .eq('grab_id', grabId)
    .range(offset, offset + limit - 1);

  if (mapError) {
    const err = new Error(`Failed to fetch image mappings: ${mapError.message}`);
    err.code = 'DATABASE_ERROR';
    err.statusCode = 500;
    throw err;
  }

  if (!mappings || mappings.length === 0) {
    return {
      grab_id: grabId,
      total_images: 0,
      page,
      limit,
      images: [],
    };
  }

  // Fetch image details
  const imageIds = mappings.map((m) => m.image_id);
  const { data: images, error: imgError } = await supabase
    .from('images')
    .select('id, storage_path, bucket_name, original_name, width, height, faces_count, created_at')
    .in('id', imageIds);

  if (imgError) {
    const err = new Error(`Failed to fetch images: ${imgError.message}`);
    err.code = 'DATABASE_ERROR';
    err.statusCode = 500;
    throw err;
  }

  // Attach public URLs
  const imagesWithUrls = (images || []).map((img) => ({
    id: img.id,
    url: getImagePublicUrl(img.bucket_name, img.storage_path),
    original_name: img.original_name,
    width: img.width,
    height: img.height,
    faces_count: img.faces_count,
    created_at: img.created_at,
  }));

  return {
    grab_id: grabId,
    total_images: totalImages || 0,
    page,
    limit,
    images: imagesWithUrls,
  };
}

module.exports = { getImagesByGrabId, getImagePublicUrl };
