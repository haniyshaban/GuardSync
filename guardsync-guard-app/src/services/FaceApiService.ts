import * as faceapi from '@vladmandic/face-api';

// Model loading state
let modelsLoaded = false;
let modelsLoading: Promise<void> | null = null;

// Model path (relative to public folder)
const MODEL_URL = '/models';

/**
 * Load all required face-api.js models
 * Models should be placed in /public/models directory
 * Using @vladmandic/face-api which uses .bin format
 */
export async function loadFaceApiModels(): Promise<void> {
  if (modelsLoaded) {
    return;
  }

  if (modelsLoading) {
    return modelsLoading;
  }

  modelsLoading = (async () => {
    try {
      console.log('[FaceAPI] Loading models from:', MODEL_URL);
      
      // Load the models in parallel
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);

      modelsLoaded = true;
      console.log('[FaceAPI] All models loaded successfully');
    } catch (error) {
      console.error('[FaceAPI] Failed to load models:', error);
      modelsLoading = null;
      throw error;
    }
  })();

  return modelsLoading;
}

/**
 * Check if models are loaded
 */
export function areModelsLoaded(): boolean {
  return modelsLoaded;
}

/**
 * TinyFaceDetector options for fast detection
 */
export const detectorOptions = new faceapi.TinyFaceDetectorOptions({
  inputSize: 416,
  scoreThreshold: 0.5,
});

/**
 * Detect all faces in an image/video element and return descriptors
 */
export async function detectAllFaces(
  input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
): Promise<faceapi.WithFaceDescriptor<faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }>>[]> {
  if (!modelsLoaded) {
    throw new Error('Face API models not loaded. Call loadFaceApiModels() first.');
  }

  const detections = await faceapi
    .detectAllFaces(input, detectorOptions)
    .withFaceLandmarks()
    .withFaceDescriptors();

  return detections;
}

/**
 * Detect a single face and return its descriptor
 */
export async function detectSingleFace(
  input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
): Promise<Float32Array | null> {
  if (!modelsLoaded) {
    throw new Error('Face API models not loaded. Call loadFaceApiModels() first.');
  }

  const detection = await faceapi
    .detectSingleFace(input, detectorOptions)
    .withFaceLandmarks()
    .withFaceDescriptor();

  return detection?.descriptor || null;
}

/**
 * Create a FaceMatcher from stored descriptors
 * @param labeledDescriptors Array of { label: string, descriptors: Float32Array[] }
 * @param threshold Distance threshold (lower = stricter match, default 0.6)
 */
export function createFaceMatcher(
  labeledDescriptors: { label: string; descriptors: Float32Array[] }[],
  threshold: number = 0.6
): faceapi.FaceMatcher {
  const labeledFaceDescriptors = labeledDescriptors.map(
    (ld) => new faceapi.LabeledFaceDescriptors(ld.label, ld.descriptors)
  );
  return new faceapi.FaceMatcher(labeledFaceDescriptors, threshold);
}

/**
 * Match a face descriptor against stored descriptors
 * @returns The matching guard ID or null if no match found
 */
export function matchFace(
  matcher: faceapi.FaceMatcher,
  descriptor: Float32Array
): { label: string; distance: number } | null {
  const match = matcher.findBestMatch(descriptor);
  
  if (match.label === 'unknown') {
    return null;
  }
  
  return {
    label: match.label,
    distance: match.distance,
  };
}

/**
 * Convert Float32Array descriptor to JSON string for storage
 */
export function descriptorToString(descriptor: Float32Array): string {
  return JSON.stringify(Array.from(descriptor));
}

/**
 * Convert JSON string back to Float32Array descriptor
 */
export function stringToDescriptor(str: string): Float32Array {
  const arr = JSON.parse(str) as number[];
  return new Float32Array(arr);
}

/**
 * Calculate Euclidean distance between two descriptors
 * Lower distance = more similar faces
 */
export function calculateDistance(
  descriptor1: Float32Array,
  descriptor2: Float32Array
): number {
  return faceapi.euclideanDistance(descriptor1, descriptor2);
}

/**
 * Check if two descriptors match within threshold
 * @param threshold Distance threshold (default 0.6, lower = stricter)
 */
export function descriptorsMatch(
  descriptor1: Float32Array,
  descriptor2: Float32Array,
  threshold: number = 0.6
): boolean {
  const distance = calculateDistance(descriptor1, descriptor2);
  return distance < threshold;
}

// Export faceapi for direct use if needed
export { faceapi };
