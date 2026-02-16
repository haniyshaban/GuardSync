declare module '@vladmandic/face-api' {
  export class TinyFaceDetectorOptions {
    constructor(options?: { inputSize?: number; scoreThreshold?: number });
  }

  export class FaceDetection {
    score: number;
    box: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }

  export interface WithFaceLandmarks<T> extends T {
    landmarks: FaceLandmarks68;
  }

  export interface WithFaceDescriptor<T> extends T {
    descriptor: Float32Array;
  }

  export class FaceLandmarks68 {
    positions: Point[];
  }

  export interface Point {
    x: number;
    y: number;
  }

  export class LabeledFaceDescriptors {
    constructor(label: string, descriptors: Float32Array[]);
    label: string;
    descriptors: Float32Array[];
  }

  export class FaceMatcher {
    constructor(inputs: LabeledFaceDescriptors[], distanceThreshold?: number);
    findBestMatch(descriptor: Float32Array): FaceMatch;
  }

  export class FaceMatch {
    label: string;
    distance: number;
  }

  export const nets: {
    tinyFaceDetector: {
      loadFromUri(uri: string): Promise<void>;
      isLoaded: boolean;
    };
    faceLandmark68Net: {
      loadFromUri(uri: string): Promise<void>;
      isLoaded: boolean;
    };
    faceRecognitionNet: {
      loadFromUri(uri: string): Promise<void>;
      isLoaded: boolean;
    };
  };

  export function detectAllFaces(
    input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
    options?: TinyFaceDetectorOptions
  ): {
    withFaceLandmarks(): {
      withFaceDescriptors(): Promise<WithFaceDescriptor<WithFaceLandmarks<{ detection: FaceDetection }>>[]>;
    };
  };

  export function detectSingleFace(
    input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
    options?: TinyFaceDetectorOptions
  ): {
    withFaceLandmarks(): {
      withFaceDescriptor(): Promise<WithFaceDescriptor<WithFaceLandmarks<{ detection: FaceDetection }>> | undefined>;
    };
  };

  export function euclideanDistance(arr1: Float32Array, arr2: Float32Array): number;
}
