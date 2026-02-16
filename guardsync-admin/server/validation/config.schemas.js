import { z } from 'zod';

// Update system configuration schema
export const updateConfigSchema = z.object({
  usePremiumAPIs: z.boolean().optional(),
  faceRecognition: z.enum(['local', 'aws-rekognition', 'azure-face', 'google-vision']).optional(),
  mapProvider: z.enum(['openstreetmap', 'google-maps', 'mapbox']).optional(),
  locationUpdateInterval: z.number().min(10).max(300).optional(), // seconds, between 10s and 5 minutes
  geofenceStrictness: z.enum(['low', 'medium', 'high']).optional(),
  autoClockOut: z.boolean().optional(),
});
