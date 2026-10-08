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
  // The face template captured on the device: 128 numbers, or the same as a JSON string
  descriptor: z.union([z.string().min(10).max(20000), z.array(z.number()).length(128)]),
});
