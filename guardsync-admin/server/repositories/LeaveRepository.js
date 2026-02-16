import { BaseRepository } from './BaseRepository.js';

export class LeaveRepository extends BaseRepository {
  constructor(db) {
    super(db, 'leave_requests');
  }

  /**
   * Find leave requests by guard ID
   */
  findByGuardId(guardId) {
    return this.query(
      'SELECT * FROM leave_requests WHERE guardId = ? ORDER BY appliedAt DESC',
      [guardId]
    );
  }

  /**
   * Find leave requests by status
   */
  findByStatus(status) {
    return this.query(
      'SELECT * FROM leave_requests WHERE status = ? ORDER BY appliedAt DESC',
      [status]
    );
  }

  /**
   * Find pending leave requests
   */
  findPending() {
    return this.findByStatus('pending');
  }

  /**
   * Find approved leave requests
   */
  findApproved() {
    return this.findByStatus('approved');
  }

  /**
   * Approve leave request
   */
  approve(id, reviewedBy, adminNotes = null) {
    return this.update(id, {
      status: 'approved',
      reviewedAt: new Date().toISOString(),
      reviewedBy,
      adminNotes
    });
  }

  /**
   * Reject leave request
   */
  reject(id, reviewedBy, adminNotes = null) {
    return this.update(id, {
      status: 'rejected',
      reviewedAt: new Date().toISOString(),
      reviewedBy,
      adminNotes
    });
  }

  /**
   * Find leave requests by date range
   */
  findByDateRange(startDate, endDate) {
    return this.query(
      'SELECT * FROM leave_requests WHERE (startDate <= ? AND endDate >= ?) ORDER BY appliedAt DESC',
      [endDate, startDate]
    );
  }

  /**
   * Find overlapping leave requests for a guard
   */
  findOverlapping(guardId, startDate, endDate, excludeId = null) {
    const query = excludeId
      ? 'SELECT * FROM leave_requests WHERE guardId = ? AND id != ? AND status = ? AND ((startDate <= ? AND endDate >= ?) OR (startDate <= ? AND endDate >= ?))'
      : 'SELECT * FROM leave_requests WHERE guardId = ? AND status = ? AND ((startDate <= ? AND endDate >= ?) OR (startDate <= ? AND endDate >= ?))';
    
    const params = excludeId
      ? [guardId, excludeId, 'approved', endDate, startDate, startDate, endDate]
      : [guardId, 'approved', endDate, startDate, startDate, endDate];
    
    return this.query(query, params);
  }

  /**
   * Count leave requests by guard ID and status
   */
  countByGuardAndStatus(guardId, status) {
    const result = this.queryOne(
      'SELECT COUNT(*) as count FROM leave_requests WHERE guardId = ? AND status = ?',
      [guardId, status]
    );
    return result.count;
  }
}
