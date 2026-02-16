import { randomUUID } from 'crypto';
import { BaseRepository } from './BaseRepository.js';

export class SOSRepository extends BaseRepository {
  constructor(db) {
    super(db, 'sos_alerts');
  }

  /**
   * Find SOS alerts by guard ID
   */
  findByGuardId(guardId) {
    return this.query(
      'SELECT * FROM sos_alerts WHERE guardId = ? ORDER BY createdAt DESC',
      [guardId]
    );
  }

  /**
   * Find SOS alerts by status
   */
  findByStatus(status) {
    return this.query(
      'SELECT * FROM sos_alerts WHERE status = ? ORDER BY createdAt DESC',
      [status]
    );
  }

  /**
   * Find active SOS alerts
   */
  findActive() {
    return this.findByStatus('active');
  }

  /**
   * Find resolved SOS alerts
   */
  findResolved() {
    return this.findByStatus('resolved');
  }

  /**
   * Create SOS alert
   */
  createAlert(alertData) {
    const id = randomUUID();
    return this.create({
      id,
      guardId: alertData.guardId,
      guardName: alertData.guardName || null,
      siteId: alertData.siteId || null,
      siteName: alertData.siteName || null,
      lat: alertData.lat || null,
      lng: alertData.lng || null,
      message: alertData.message || null,
      status: 'active',
      createdAt: new Date().toISOString()
    });
  }

  /**
   * Resolve SOS alert
   */
  resolve(id, resolvedBy, resolvedNotes = null) {
    return this.update(id, {
      status: 'resolved',
      resolvedAt: new Date().toISOString(),
      resolvedBy,
      resolvedNotes
    });
  }

  /**
   * Find SOS alerts by site ID
   */
  findBySiteId(siteId) {
    return this.query(
      'SELECT * FROM sos_alerts WHERE siteId = ? ORDER BY createdAt DESC',
      [siteId]
    );
  }

  /**
   * Find recent SOS alerts
   */
  findRecent(limit = 50) {
    return this.query(
      'SELECT * FROM sos_alerts ORDER BY createdAt DESC LIMIT ?',
      [limit]
    );
  }

  /**
   * Find SOS alerts within date range
   */
  findByDateRange(startDate, endDate) {
    return this.query(
      'SELECT * FROM sos_alerts WHERE createdAt >= ? AND createdAt <= ? ORDER BY createdAt DESC',
      [startDate, endDate]
    );
  }

  /**
   * Count active SOS alerts
   */
  countActive() {
    const result = this.queryOne(
      'SELECT COUNT(*) as count FROM sos_alerts WHERE status = ?',
      ['active']
    );
    return result.count;
  }

  /**
   * Count SOS alerts by guard ID
   */
  countByGuardId(guardId) {
    const result = this.queryOne(
      'SELECT COUNT(*) as count FROM sos_alerts WHERE guardId = ?',
      [guardId]
    );
    return result.count;
  }
}
