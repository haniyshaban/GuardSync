import { z } from 'zod';
import { commonSchemas } from './index.js';

// Conveyance request schema
export const conveyanceRequestSchema = z.object({
  guardId: commonSchemas.id,
  siteId: z.string().optional(),
  reason: z.string().min(1, 'Reason is required').max(500, 'Reason must be at most 500 characters'),
  estimatedDuration: z.number().min(1).max(480).optional(), // in minutes, max 8 hours
  currentLocation: commonSchemas.location.optional(),
});

// Conveyance response schema (approve/deny)
export const conveyanceResponseSchema = z.object({
  action: z.enum(['approve', 'deny'], {
    errorMap: () => ({ message: 'Action must be either approve or deny' })
  }),
  staffId: z.string().optional(),
  notes: z.string().max(500).optional(),
});
