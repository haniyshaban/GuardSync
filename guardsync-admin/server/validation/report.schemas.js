import { z } from 'zod';
import { commonSchemas } from './index.js';

// Create field report schema
export const createFieldReportSchema = z.object({
  staffId: commonSchemas.id,
  staffName: z.string().min(1).max(100).optional(),
  reportType: z.enum(['incident', 'inspection', 'maintenance', 'safety', 'general']),
  title: z.string().min(1, 'Title is required').max(200, 'Title must be at most 200 characters'),
  description: z.string().max(2000).optional(),
  mediaUrl: z.string().url().optional(),
  mediaType: z.enum(['image', 'video', 'document']).optional(),
  siteId: z.string().optional(),
  siteName: z.string().max(200).optional(),
  location: commonSchemas.location.optional(),
  tags: z.array(z.string().max(50)).optional(),
});

// Field report query schema
export const fieldReportQuerySchema = z.object({
  staffId: z.string().optional(),
});
