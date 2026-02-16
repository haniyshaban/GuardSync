import { z } from 'zod';

export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: 'Validation failed', details: result.error.flatten() });
    }
    req.body = result.data;
    next();
  };
}

export const schemas = {
  login: z.object({ email: z.string().email(), password: z.string().min(6) }),
  staffLogin: z.object({ email: z.string().email(), password: z.string().min(6) }),
  enrollGuard: z.object({
    fullName: z.string().min(1),
    email: z.string().email(),
    phone: z.string().min(6),
    address: z.string().optional().nullable(),
    emergencyContact: z.string().optional().nullable(),
    aadharNumber: z.string().optional().nullable(),
    panNumber: z.string().optional().nullable(),
    bankAccountNumber: z.string().optional().nullable(),
    bankIfsc: z.string().optional().nullable(),
    bankName: z.string().optional().nullable(),
    accountHolderName: z.string().optional().nullable(),
    faceDescriptor: z.any().optional().nullable(),
    password: z.string().min(6).optional().nullable(),
    photographUrl: z.string().optional().nullable(),
    aadharDocUrl: z.string().optional().nullable(),
    panDocUrl: z.string().optional().nullable(),
    relievingLetterUrl: z.string().optional().nullable(),
  }),
};
