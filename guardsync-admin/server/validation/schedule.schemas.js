import { z } from 'zod';
import { commonSchemas } from './index.js';

// Create schedule schema
export const createScheduleSchema = z.object({
  guardId: commonSchemas.id,
  siteId: z.string().optional(),
  siteName: z.string().max(200).optional(),
  date: commonSchemas.dateISO,
  startTime: commonSchemas.time,
  endTime: commonSchemas.time,
  isNightShift: z.boolean().optional(),
}).refine((data) => {
  // Validate that endTime is after startTime (unless it's a night shift crossing midnight)
  const [startHour, startMin] = data.startTime.split(':').map(Number);
  const [endHour, endMin] = data.endTime.split(':').map(Number);
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  
  // Allow night shifts where end time is "before" start time (crossing midnight)
  if (data.isNightShift) return true;
  
  return endMinutes > startMinutes;
}, {
  message: 'End time must be after start time (or mark as night shift)',
  path: ['endTime'],
});

// Update schedule schema
export const updateScheduleSchema = z.object({
  siteId: z.string().optional(),
  siteName: z.string().max(200).optional(),
  date: commonSchemas.dateISO.optional(),
  startTime: commonSchemas.time.optional(),
  endTime: commonSchemas.time.optional(),
  isNightShift: z.boolean().optional(),
  status: z.enum(['scheduled', 'active', 'completed', 'cancelled']).optional(),
}).partial();

// Schedule query schema
export const scheduleQuerySchema = z.object({
  from: commonSchemas.dateISO.optional(),
  to: commonSchemas.dateISO.optional(),
});
