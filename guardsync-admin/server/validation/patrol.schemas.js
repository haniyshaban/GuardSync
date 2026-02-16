import { z } from 'zod';
import { commonSchemas } from './index.js';

// Create patrol log schema
export const createPatrolLogSchema = z.object({
  guardId: commonSchemas.id,
  siteId: z.string().optional(),
  patrolPointId: commonSchemas.id,
  patrolPointName: z.string().min(1).max(200),
  shiftId: z.string().optional(),
  lat: commonSchemas.latitude.optional(),
  lng: commonSchemas.longitude.optional(),
  withinRadius: z.boolean().optional(),
  distanceFromPoint: z.number().min(0).optional(), // in meters
});

// Patrol log query schema
export const patrolLogQuerySchema = z.object({
  date: commonSchemas.dateISO.optional(),
  shiftId: z.string().optional(),
});
