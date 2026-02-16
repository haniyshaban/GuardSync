import { randomUUID } from 'crypto';
import { BaseRepository } from './BaseRepository.js';

export class PayrollRepository extends BaseRepository {
  constructor(db) {
    super(db, 'payroll');
  }

  /**
   * Find payroll records by guard ID
   */
  findByGuardId(guardId) {
    return this.query(
      'SELECT * FROM payroll WHERE guardId = ? ORDER BY year DESC, month DESC',
      [guardId]
    );
  }

  /**
   * Find payroll record by guard ID, month, and year
   */
  findByGuardMonthYear(guardId, month, year) {
    return this.queryOne(
      'SELECT * FROM payroll WHERE guardId = ? AND month = ? AND year = ?',
      [guardId, parseInt(month), parseInt(year)]
    );
  }

  /**
   * Find payroll records by month and year
   */
  findByMonthYear(month, year) {
    return this.query(
      'SELECT * FROM payroll WHERE month = ? AND year = ? ORDER BY guardName',
      [parseInt(month), parseInt(year)]
    );
  }

  /**
   * Find payroll records by status
   */
  findByStatus(status) {
    return this.query(
      'SELECT * FROM payroll WHERE status = ? ORDER BY year DESC, month DESC',
      [status]
    );
  }

  /**
   * Find pending payroll records
   */
  findPending() {
    return this.findByStatus('pending');
  }

  /**
   * Find finalized payroll records
   */
  findFinalized() {
    return this.findByStatus('finalized');
  }

  /**
   * Find paid payroll records
   */
  findPaid() {
    return this.findByStatus('paid');
  }

  /**
   * Update payroll deductions
   */
  updateDeductions(id, uniformDeduction, otherDeductions) {
    const existing = this.findById(id);
    if (!existing) return null;

    const netPay = existing.grossPay - existing.pfDeduction - uniformDeduction - otherDeductions;
    
    return this.update(id, {
      uniformDeduction,
      otherDeductions,
      netPay
    });
  }

  /**
   * Mark payroll as finalized
   */
  finalize(id) {
    return this.update(id, {
      status: 'finalized',
      finalizedAt: new Date().toISOString()
    });
  }

  /**
   * Mark payroll as paid
   */
  markAsPaid(id) {
    return this.update(id, {
      status: 'paid',
      paidAt: new Date().toISOString()
    });
  }

  /**
   * Update payroll status
   */
  updateStatus(id, status) {
    const data = { status };
    
    if (status === 'finalized') {
      data.finalizedAt = new Date().toISOString();
    } else if (status === 'paid') {
      data.paidAt = new Date().toISOString();
    }
    
    return this.update(id, data);
  }

  /**
   * Generate payroll record
   */
  generate(payrollData) {
    const id = randomUUID();
    return this.create({
      id,
      guardId: payrollData.guardId,
      guardName: payrollData.guardName,
      month: parseInt(payrollData.month),
      year: parseInt(payrollData.year),
      totalDaysWorked: payrollData.totalDaysWorked || 0,
      dailyRate: payrollData.dailyRate || 800,
      grossPay: payrollData.grossPay || 0,
      uniformDeduction: payrollData.uniformDeduction || 0,
      pfDeduction: payrollData.pfDeduction || 0,
      otherDeductions: payrollData.otherDeductions || 0,
      netPay: payrollData.netPay || 0,
      status: 'pending',
      generatedAt: new Date().toISOString()
    });
  }

  /**
   * Get total payout for a month/year
   */
  getTotalPayoutByMonthYear(month, year) {
    const result = this.queryOne(
      'SELECT SUM(netPay) as totalPayout FROM payroll WHERE month = ? AND year = ? AND status = ?',
      [parseInt(month), parseInt(year), 'paid']
    );
    return result.totalPayout || 0;
  }
}
