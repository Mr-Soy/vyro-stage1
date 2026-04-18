/**
 * Script to download face-api.js model weights from GitHub.
 * Run with: npm run download-models
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const MODELS_DIR = path.join(__dirname, '..', 'models');

const MODEL_BASE_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';

const MODEL_FILES = [
  'ssd_mobilenetv1_model-weights_manifest.json',
  'ssd_mobilenetv1_model.bin',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model.bin',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model.bin',
];

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        downloadFile(response.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: HTTP ${response.statusCode}`));
        return;
      }

      const file = fs.createWriteStream(dest);
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });

      file.on('error', (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    }).on('error', (err) => {
      if (fs.existsSync(dest)) {
        fs.unlink(dest, () => {});
      }
      reject(err);
    });
  });
}

async function main() {
  if (!fs.existsSync(MODELS_DIR)) {
    fs.mkdirSync(MODELS_DIR, { recursive: true });
  }

  console.log(`Downloading ${MODEL_FILES.length} model files to ${MODELS_DIR}...\n`);

  for (const file of MODEL_FILES) {
    const url = `${MODEL_BASE_URL}/${file}`;
    const dest = path.join(MODELS_DIR, file);

    if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
      console.log(`  [SKIP] ${file} (already exists)`);
      continue;
    }

    process.stdout.write(`  [DOWNLOADING] ${file}...`);
    try {
      await downloadFile(url, dest);
      console.log(' OK');
    } catch (err) {
      console.log(` FAILED: ${err.message}`);
    }
  }

  console.log('\nDone.');
}

main();
