/**
 * Payroll type definitions
 */

import type { PayrollStatus } from './common';

export interface PayrollRecord {
  id: string;
  guardId: string;
  guardName?: string;
  month: number;
  year: number;
  totalDaysWorked: number;
  dailyRate: number;
  grossPay: number;
  uniformDeduction: number;
  otherDeductions: number;
  netPay: number;
  generatedAt: string;
  status: PayrollStatus;
}
