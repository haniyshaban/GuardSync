import express from 'express';
import { authMiddleware } from '../auth.js';
import { validate } from '../validation/index.js';
import { updatePayrollSchema } from '../validation/payroll.schemas.js';
import { payrollRepo, guardRepo, attendanceRepo } from '../repositories/index.js';
import { success, created, error, badRequest, notFound, unauthorized, forbidden, conflict, serverError, noContent } from '../utils/responses.js';

const router = express.Router();

// GET /api/payroll/:guardId - Get all payroll records for a guard
router.get('/:guardId', authMiddleware(true, ['guard', 'staff', 'admin']), (req, res) => {
  try {
    const guardId = req.params.guardId;
    const records = payrollRepo.findByGuardId(guardId);
    return success(res, records);
  } catch (err) {
    return serverError(res, String(err));
  }
});

// GET /api/payroll/:guardId/:month/:year - Get specific month payroll for a guard
router.get('/:guardId/:month/:year', authMiddleware(true, ['guard', 'staff', 'admin']), (req, res) => {
  try {
    const { guardId, month, year } = req.params;
    let record = payrollRepo.findByGuardMonthYear(guardId, month, year);
    
    // If no record exists, generate one based on attendance data
    if (!record) {
      const guard = guardRepo.findById(guardId);
      if (!guard) {
        return notFound(res, 'guard', guardId);
      }
      
      // Get attendance records for this month
      const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
      const endDate = `${year}-${month.toString().padStart(2, '0')}-31`;
      const attendance = attendanceRepo.getGuardStats(guardId, startDate, endDate);
      
      const totalDaysWorked = attendance?.completedDays || 0;
      const dailyRate = guard.dailyRate || 800;
      const grossPay = totalDaysWorked * dailyRate;
      const pfDeduction = Math.round(grossPay * 0.12); // 12% PF
      const uniformDeduction = 0; // Can be set per guard
      const netPay = grossPay - pfDeduction - uniformDeduction;
      
      // Create the payroll record using repository
      const generatedRecord = payrollRepo.generate({
        guardId,
        guardName: guard.name,
        month,
        year,
        totalDaysWorked,
        dailyRate,
        grossPay,
        uniformDeduction,
        pfDeduction,
        otherDeductions: 0,
        netPay
      });
      
      record = payrollRepo.findById(generatedRecord.id);
    }
    
    return success(res, record);
  } catch (err) {
    return serverError(res, String(err));
  }
});

// PUT /api/payroll/:id - Update payroll record (finalize, mark as paid)
router.put('/:id', authMiddleware(true, ['staff', 'admin']), validate(updatePayrollSchema), (req, res) => {
  try {
    const { status, uniformDeduction, otherDeductions } = req.body;
    const payrollId = req.params.id;
    
    const existing = payrollRepo.findById(payrollId);
    if (!existing) {
      return notFound(res, 'payroll record', payrollId);
    }
    
    // Recalculate if deductions changed
    if (uniformDeduction !== undefined || otherDeductions !== undefined) {
      const newUniform = uniformDeduction !== undefined ? uniformDeduction : existing.uniformDeduction;
      const newOther = otherDeductions !== undefined ? otherDeductions : existing.otherDeductions;
      payrollRepo.updateDeductions(payrollId, newUniform, newOther);
    }
    
    // Update status
    if (status) {
      payrollRepo.updateStatus(payrollId, status);
    }
    
    const updated = payrollRepo.findById(payrollId);
    return success(res, updated, 200, 'Payroll record updated successfully');
  } catch (err) {
    return serverError(res, String(err));
  }
});

export default router;
