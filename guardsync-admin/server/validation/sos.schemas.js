import { z } from 'zod';
import { commonSchemas } from './index.js';

// Create SOS alert schema
export const createSOSAlertSchema = z.object({
  guardId: commonSchemas.id,
  guardName: z.string().min(1).max(100),
  siteId: z.string().optional(),
  siteName: z.string().max(200).optional(),
  lat: commonSchemas.latitude.optional(),
  lng: commonSchemas.longitude.optional(),
  message: z.string().max(500).optional(),
});

// Resolve SOS alert schema
export const resolveSOSAlertSchema = z.object({
  resolvedBy: z.string().optional(),
  resolvedNotes: z.string().max(1000).optional(),
});

// SOS query schema
export const sosQuerySchema = z.object({
  status: z.enum(['active', 'resolved', 'cancelled']).optional(),
});
