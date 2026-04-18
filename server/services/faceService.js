const Jimp = require('jimp');
const { faceapi, tf } = require('../utils/faceModels');

const THRESHOLD = parseFloat(process.env.FACE_MATCH_THRESHOLD) || 0.6;

/**
 * Convert an image buffer (JPEG/PNG) into a tf.Tensor3D [height, width, 3].
 * Uses Jimp (pure JS) to decode — no native bindings needed.
 *
 * @param {Buffer} imageBuffer
 * @returns {Promise<tf.Tensor3D>}
 */
async function bufferToTensor(imageBuffer) {
  const image = await Jimp.read(imageBuffer);

  const { width, height } = image.bitmap;

  // Jimp bitmap.data is RGBA (4 channels). We need RGB (3 channels).
  const rgbaData = image.bitmap.data; // Uint8Array, length = w * h * 4
  const rgbData = new Uint8Array(width * height * 3);

  for (let i = 0, j = 0; i < rgbaData.length; i += 4, j += 3) {
    rgbData[j] = rgbaData[i];       // R
    rgbData[j + 1] = rgbaData[i + 1]; // G
    rgbData[j + 2] = rgbaData[i + 2]; // B
  }

  return tf.tensor3d(rgbData, [height, width, 3]);
}

/**
 * Detect all faces in an image buffer.
 * Returns an array of detections, each with bounding box and 128-dim descriptor.
 *
 * @param {Buffer} imageBuffer - Raw image bytes (JPEG/PNG)
 * @returns {Promise<Array<{detection: object, descriptor: Float32Array}>>}
 */
async function detectFaces(imageBuffer) {
  const tensor = await bufferToTensor(imageBuffer);

  try {
    const results = await faceapi
      .detectAllFaces(tensor, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
      .withFaceLandmarks()
      .withFaceDescriptors();

    return results.map((r) => ({
      detection: {
        box: {
          x: Math.round(r.detection.box.x),
          y: Math.round(r.detection.box.y),
          width: Math.round(r.detection.box.width),
          height: Math.round(r.detection.box.height),
        },
        score: r.detection.score,
      },
      descriptor: Array.from(r.descriptor), // Convert Float32Array to plain array for JSON storage
    }));
  } finally {
    tensor.dispose();
  }
}

/**
 * Compute Euclidean distance between two 128-dim face descriptors.
 *
 * @param {number[]|Float32Array} enc1
 * @param {number[]|Float32Array} enc2
 * @returns {number} Euclidean distance (lower = more similar)
 */
function compareFaces(enc1, enc2) {
  let sum = 0;
  for (let i = 0; i < 128; i++) {
    const diff = enc1[i] - enc2[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/**
 * Find the closest matching grab_id for a given face encoding.
 * Compares against ALL known faces IN MEMORY (not in SQL).
 *
 * @param {number[]} encoding - The new face's 128-dim descriptor
 * @param {Array<{grab_id: string, encoding: number[]}>} knownFaces - All faces from DB
 * @returns {{ grab_id: string, distance: number } | null} - Best match or null
 */
function findMatchingGrabId(encoding, knownFaces) {
  let bestMatch = null;
  let bestDistance = Infinity;

  for (const known of knownFaces) {
    // known.encoding is JSONB from Supabase — should already be a number[]
    // If it comes back as a string, parse it
    const knownEncoding = typeof known.encoding === 'string'
      ? JSON.parse(known.encoding)
      : known.encoding;

    const distance = compareFaces(encoding, knownEncoding);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestMatch = known.grab_id;
    }
  }

  if (bestDistance < THRESHOLD) {
    return { grab_id: bestMatch, distance: bestDistance };
  }

  return null;
}

module.exports = { detectFaces, compareFaces, findMatchingGrabId };
