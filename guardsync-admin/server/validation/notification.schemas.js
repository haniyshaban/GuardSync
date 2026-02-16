import { z } from 'zod';
import { commonSchemas } from './index.js';

// Create notification schema
export const createNotificationSchema = z.object({
  guardId: commonSchemas.id,
  type: z.enum(['info', 'warning', 'alert', 'success', 'schedule', 'leave', 'payment']).optional(),
  title: z.string().min(1, 'Title is required').max(200, 'Title must be at most 200 characters'),
  message: z.string().min(1, 'Message is required').max(1000, 'Message must be at most 1000 characters'),
});
