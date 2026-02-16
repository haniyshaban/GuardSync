import { BaseRepository } from './BaseRepository.js';

export class ConveyanceRepository extends BaseRepository {
  constructor(db) {
    super(db, 'conveyance_requests');
  }

  /**
   * Find conveyance requests by guard ID
   */
  findByGuardId(guardId) {
    return this.query(
      'SELECT * FROM conveyance_requests WHERE guardId = ? ORDER BY requestedAt DESC',
      [guardId]
    );
  }

  /**
   * Find conveyance requests by status
   */
  findByStatus(status) {
    return this.query(
      'SELECT * FROM conveyance_requests WHERE status = ? ORDER BY requestedAt DESC',
      [status]
    );
  }

  /**
   * Find pending conveyance requests
   */
  findPending() {
    return this.findByStatus('pending');
  }

  /**
   * Find active (approved) conveyance requests
   */
  findActive() {
    return this.findByStatus('approved');
  }

  /**
   * Approve conveyance request
   */
  approve(id, respondedBy, staffNotes = null) {
    return this.update(id, {
      status: 'approved',
      respondedAt: new Date().toISOString(),
      respondedBy,
      staffNotes
    });
  }

  /**
   * Reject conveyance request
   */
  reject(id, respondedBy, staffNotes = null) {
    return this.update(id, {
      status: 'rejected',
      respondedAt: new Date().toISOString(),
      respondedBy,
      staffNotes
    });
  }

  /**
   * Complete conveyance request
   */
  complete(id, respondedBy, staffNotes = null) {
    return this.update(id, {
      status: 'completed',
      respondedAt: new Date().toISOString(),
      respondedBy,
      staffNotes
    });
  }

  /**
   * Find conveyance requests by site ID
   */
  findBySiteId(siteId) {
    return this.query(
      'SELECT * FROM conveyance_requests WHERE siteId = ? ORDER BY requestedAt DESC',
      [siteId]
    );
  }
}
