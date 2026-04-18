const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');
const { detectFaces, findMatchingGrabId } = require('./faceService');

/**
 * List all files in a Supabase Storage bucket.
 *
 * @param {string} bucket - Bucket name (default: "event-photos")
 * @returns {Promise<Array<{name: string, id: string, metadata: object}>>}
 */
async function listStorageFiles(bucket = 'event-photos') {
  const { data, error } = await supabase.storage.from(bucket).list('', {
    limit: 1000,
    sortBy: { column: 'name', order: 'asc' },
  });

  if (error) {
    throw Object.assign(new Error(`Failed to list files in bucket "${bucket}": ${error.message}`), {
      code: 'CRAWL_FAILED',
      statusCode: 500,
    });
  }

  // Filter out folders, keep only image files
  return (data || []).filter((f) => {
    const ext = f.name.toLowerCase().split('.').pop();
    return ['jpg', 'jpeg', 'png', 'webp'].includes(ext);
  });
}

/**
 * Process a single image: download, detect faces, assign/match grab_ids, persist to DB.
 *
 * @param {object} file - File object from Supabase Storage { name }
 * @param {string} bucket - Bucket name
 * @returns {Promise<{newFaces: number, matchedFaces: number}>}
 */
async function processImage(file, bucket = 'event-photos') {
  const storagePath = file.name;

  // 1. Download image buffer from Supabase Storage
  const { data: fileData, error: downloadError } = await supabase.storage
    .from(bucket)
    .download(storagePath);

  if (downloadError) {
    throw Object.assign(
      new Error(`Failed to download "${storagePath}": ${downloadError.message}`),
      { code: 'CRAWL_FAILED', statusCode: 500 }
    );
  }

  // Convert Blob/File to Buffer
  const arrayBuffer = await fileData.arrayBuffer();
  const imageBuffer = Buffer.from(arrayBuffer);

  // 2. Insert image record into DB (or skip if exists)
  const { data: existingImage } = await supabase
    .from('images')
    .select('id')
    .eq('storage_path', storagePath)
    .single();

  let imageId;
  if (existingImage) {
    imageId = existingImage.id;
  } else {
    const { data: newImage, error: insertError } = await supabase
      .from('images')
      .insert({
        storage_path: storagePath,
        bucket_name: bucket,
        original_name: file.name,
        mime_type: file.metadata?.mimetype || 'image/jpeg',
      })
      .select('id')
      .single();

    if (insertError) {
      throw Object.assign(
        new Error(`Failed to insert image record: ${insertError.message}`),
        { code: 'DATABASE_ERROR', statusCode: 500 }
      );
    }
    imageId = newImage.id;
  }

  // 3. Detect faces in the image
  let faceResults;
  try {
    faceResults = await detectFaces(imageBuffer);
  } catch (err) {
    console.error(`Face detection failed for "${storagePath}":`, err.message);
    // Mark as processed even if detection fails (so we don't retry endlessly)
    await supabase.from('images').update({ processed: true, faces_count: 0 }).eq('id', imageId);
    return { newFaces: 0, matchedFaces: 0 };
  }

  // 4. Fetch ALL existing faces from DB for in-memory comparison
  const { data: knownFaces, error: facesError } = await supabase
    .from('faces')
    .select('grab_id, encoding');

  if (facesError) {
    throw Object.assign(
      new Error(`Failed to fetch known faces: ${facesError.message}`),
      { code: 'DATABASE_ERROR', statusCode: 500 }
    );
  }

  let newFacesCount = 0;
  let matchedFacesCount = 0;

  // 5. For each detected face, match or create a grab_id
  for (const face of faceResults) {
    const match = findMatchingGrabId(face.descriptor, knownFaces || []);

    let grabId;

    if (match) {
      // Existing person found
      grabId = match.grab_id;
      matchedFacesCount++;
    } else {
      // New person — create new grab_id
      grabId = uuidv4();
      const { error: faceInsertError } = await supabase.from('faces').insert({
        grab_id: grabId,
        encoding: face.descriptor, // Stored as JSONB array
        sample_image_id: imageId,
      });

      if (faceInsertError) {
        console.error(`Failed to insert new face: ${faceInsertError.message}`);
        continue;
      }

      // Add to known faces so subsequent faces in the same image can match
      knownFaces.push({ grab_id: grabId, encoding: face.descriptor });
      newFacesCount++;
    }

    // 6. Insert junction record (face_image_map)
    const { error: mapError } = await supabase.from('face_image_map').upsert(
      {
        image_id: imageId,
        grab_id: grabId,
        bbox_x: face.detection.box.x,
        bbox_y: face.detection.box.y,
        bbox_width: face.detection.box.width,
        bbox_height: face.detection.box.height,
        confidence: face.detection.score,
      },
      { onConflict: 'image_id,grab_id' }
    );

    if (mapError) {
      console.error(`Failed to insert face_image_map: ${mapError.message}`);
    }
  }

  // 7. Mark image as processed, update faces_count
  await supabase
    .from('images')
    .update({
      processed: true,
      faces_count: faceResults.length,
      updated_at: new Date().toISOString(),
    })
    .eq('id', imageId);

  return { newFaces: newFacesCount, matchedFaces: matchedFacesCount };
}

/**
 * Main crawl orchestrator: list files, filter unprocessed, run face pipeline.
 *
 * @param {string} bucket - Bucket name
 * @param {number} limit - Max images to process in this batch
 * @returns {Promise<object>} Crawl summary
 */
async function crawlBucket(bucket = 'event-photos', limit = 50) {
  const startTime = Date.now();

  // 1. List all files in storage
  const allFiles = await listStorageFiles(bucket);

  // 2. Get already-processed image paths from DB
  const { data: processedImages } = await supabase
    .from('images')
    .select('storage_path')
    .eq('processed', true);

  const processedPaths = new Set((processedImages || []).map((i) => i.storage_path));

  // 3. Filter to unprocessed files only
  const unprocessedFiles = allFiles.filter((f) => !processedPaths.has(f.name));

  // 4. Limit the batch
  const batch = unprocessedFiles.slice(0, limit);

  let totalNewFaces = 0;
  let totalMatchedFaces = 0;

  // 5. Process each image
  for (const file of batch) {
    console.log(`Processing: ${file.name}`);
    try {
      const result = await processImage(file, bucket);
      totalNewFaces += result.newFaces;
      totalMatchedFaces += result.matchedFaces;
    } catch (err) {
      console.error(`Error processing ${file.name}:`, err.message);
    }
  }

  // 6. Get total unique faces count
  const { count: totalUniqueFaces } = await supabase
    .from('faces')
    .select('*', { count: 'exact', head: true });

  return {
    total_images_found: allFiles.length,
    already_processed: processedPaths.size,
    newly_processed: batch.length,
    new_faces_discovered: totalNewFaces,
    existing_faces_matched: totalMatchedFaces,
    total_unique_faces: totalUniqueFaces || 0,
    processing_time_ms: Date.now() - startTime,
  };
}

module.exports = { listStorageFiles, processImage, crawlBucket };
