import { z } from 'zod';

// Update payroll schema
export const updatePayrollSchema = z.object({
  status: z.enum(['draft', 'finalized', 'paid', 'cancelled']).optional(),
  uniformDeduction: z.number().min(0).optional(),
  otherDeductions: z.number().min(0).optional(),
});
