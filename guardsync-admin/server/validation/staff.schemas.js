import { z } from 'zod';
import { commonSchemas } from './index.js';

// Staff clock-in schema
export const staffClockInSchema = z.object({
  staffId: commonSchemas.id,
  shiftType: z.enum(['general', 'morning', 'evening', 'night']).optional(),
  location: commonSchemas.location.optional(),
});

// Staff clock-out schema
export const staffClockOutSchema = z.object({
  staffId: commonSchemas.id,
  location: commonSchemas.location.optional(),
});
