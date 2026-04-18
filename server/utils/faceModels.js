const path = require('path');
const tf = require('@tensorflow/tfjs');
const wasm = require('@tensorflow/tfjs-backend-wasm');
const faceapi = require('@vladmandic/face-api/dist/face-api.node-wasm.js');

const MODELS_DIR = path.join(__dirname, '..', '..', 'models');

let modelsLoaded = false;

/**
 * Load face-api.js models ONCE at server startup.
 * Uses a boolean flag to ensure models are only loaded once (singleton pattern).
 * Must be awaited before the server starts accepting requests.
 */
async function loadModels() {
  if (modelsLoaded) {
    return;
  }

  // Set WASM backend path and initialize (no native C++ bindings)
  wasm.setWasmPaths(path.join(__dirname, '..', '..', 'node_modules', '@tensorflow', 'tfjs-backend-wasm', 'dist') + '/');
  await tf.setBackend('wasm');
  await tf.ready();
  console.log(`TensorFlow.js backend: ${tf.getBackend()}`);

  console.log(`Loading models from: ${MODELS_DIR}`);
  await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODELS_DIR);
  await faceapi.nets.faceLandmark68Net.loadFromDisk(MODELS_DIR);
  await faceapi.nets.faceRecognitionNet.loadFromDisk(MODELS_DIR);

  modelsLoaded = true;
  console.log('All face-api.js models loaded.');
}

/**
 * Check whether models have been loaded.
 */
function areModelsLoaded() {
  return modelsLoaded;
}

module.exports = { loadModels, areModelsLoaded, faceapi, tf };
