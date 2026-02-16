import { z } from 'zod';
import { commonSchemas } from './index.js';

// Clock-in schema (uses snake_case after case converter middleware)
export const clockInSchema = z.object({
  guard_id: commonSchemas.id,
  site_id: commonSchemas.id,
  lat: commonSchemas.latitude.optional(),
  lng: commonSchemas.longitude.optional(),
  within_geofence: z.boolean().optional(),
});

// Clock-out schema
export const clockOutSchema = z.object({
  guard_id: commonSchemas.id,
});

// Attendance query filters schema (uses snake_case after case converter middleware)
export const attendanceQuerySchema = z.object({
  from: commonSchemas.dateISO.optional(),
  to: commonSchemas.dateISO.optional(),
  site_id: z.string().optional(),
  guard_id: z.string().optional(),
  date: commonSchemas.dateISO.optional(),
  start_date: commonSchemas.dateISO.optional(),
  end_date: commonSchemas.dateISO.optional(),
});
