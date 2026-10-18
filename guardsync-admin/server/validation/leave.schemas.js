import { z } from 'zod';
import { commonSchemas } from './index.js';

// Create leave request schema
export const createLeaveRequestSchema = z.object({
  guardId: commonSchemas.id,
  startDate: commonSchemas.dateISO,
  endDate: commonSchemas.dateISO,
  reason: z.string().min(1, 'Reason is required').max(500, 'Reason must be at most 500 characters'),
  leaveType: z.enum(['casual', 'sick', 'annual', 'emergency', 'planned', 'unpaid']).optional(),
}).refine((data) => new Date(data.endDate) >= new Date(data.startDate), {
  message: 'End date must be after or equal to start date',
  path: ['endDate'],
});

// Update leave request schema (for approval/rejection)
export const updateLeaveRequestSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']),
  reviewedBy: z.string().optional(),
  adminNotes: z.string().max(500).optional(),
});
