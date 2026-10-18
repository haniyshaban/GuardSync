import { z } from 'zod';
import { commonSchemas } from './index.js';

// Login schemas. The password only has to be present: a short wrong password gets the same
// 'Invalid email or password' as any other wrong password. (New passwords have their own rules.)
export const loginSchema = z.object({
  email: commonSchemas.email,
  password: z.string().min(1, 'Password is required'),
});

export const staffLoginSchema = z.object({
  email: commonSchemas.email,
  password: z.string().min(1, 'Password is required'),
});

export const faceLoginSchema = z.object({
  guardId: commonSchemas.id,
  // The face template captured on the device: 128 numbers, or the same as a JSON string
  descriptor: z.union([z.string().min(10).max(20000), z.array(z.number()).length(128)]),
});
