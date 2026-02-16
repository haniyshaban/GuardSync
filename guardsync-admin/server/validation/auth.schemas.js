import { z } from 'zod';
import { commonSchemas } from './index.js';

// Login schemas
export const loginSchema = z.object({
  email: commonSchemas.email,
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const staffLoginSchema = z.object({
  email: commonSchemas.email,
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const faceLoginSchema = z.object({
  guardId: commonSchemas.id,
});
