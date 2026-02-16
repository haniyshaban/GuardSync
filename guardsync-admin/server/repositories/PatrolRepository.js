import { randomUUID } from 'crypto';
import { BaseRepository } from './BaseRepository.js';

export class PatrolRepository extends BaseRepository {
  constructor(db) {
    super(db, 'patrol_logs');
  }

  /**
   * Find patrol logs by guard ID
   */
  findByGuardId(guardId, orderBy = 'timestamp DESC') {
    return this.query(
      `SELECT * FROM patrol_logs WHERE guardId = ? ORDER BY ${orderBy}`,
      [guardId]
    );
  }

  /**
   * Find patrol logs by site ID
   */
  findBySiteId(siteId, orderBy = 'timestamp DESC') {
    return this.query(
      `SELECT * FROM patrol_logs WHERE siteId = ? ORDER BY ${orderBy}`,
      [siteId]
    );
  }

  /**
   * Find patrol logs by shift ID
   */
  findByShiftId(shiftId) {
    return this.query(
      'SELECT * FROM patrol_logs WHERE shiftId = ? ORDER BY timestamp DESC',
      [shiftId]
    );
  }

  /**
   * Find patrol logs by date range
   */
  findByDateRange(startDate, endDate) {
    return this.query(
      'SELECT * FROM patrol_logs WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp DESC',
      [startDate, endDate]
    );
  }

  /**
   * Find patrol logs by guard and date range
   */
  findByGuardAndDateRange(guardId, startDate, endDate) {
    return this.query(
      'SELECT * FROM patrol_logs WHERE guardId = ? AND timestamp >= ? AND timestamp <= ? ORDER BY timestamp DESC',
      [guardId, startDate, endDate]
    );
  }

  /**
   * Log a patrol checkpoint
   */
  logCheckpoint(data) {
    const id = randomUUID();
    return this.create({
      id,
      guardId: data.guardId,
      siteId: data.siteId || null,
      patrolPointId: data.patrolPointId,
      patrolPointName: data.patrolPointName,
      shiftId: data.shiftId || null,
      lat: data.lat || null,
      lng: data.lng || null,
      withinRadius: data.withinRadius ? 1 : 0,
      distanceFromPoint: data.distanceFromPoint || null,
      timestamp: data.timestamp || new Date().toISOString()
    });
  }

  /**
   * Get patrol statistics for a guard
   */
  getGuardPatrolStats(guardId, startDate, endDate) {
    return this.queryOne(
      `SELECT 
        COUNT(*) as totalCheckpoints,
        SUM(withinRadius) as checkpointsWithinRadius,
        COUNT(DISTINCT DATE(timestamp)) as totalPatrolDays
       FROM patrol_logs 
       WHERE guardId = ? AND timestamp >= ? AND timestamp <= ?`,
      [guardId, startDate, endDate]
    );
  }

  /**
   * Find recent patrol logs
   */
  findRecent(limit = 50) {
    return this.query(
      'SELECT * FROM patrol_logs ORDER BY timestamp DESC LIMIT ?',
      [limit]
    );
  }

  /**
   * Count patrol logs by guard ID
   */
  countByGuardId(guardId) {
    const result = this.queryOne(
      'SELECT COUNT(*) as count FROM patrol_logs WHERE guardId = ?',
      [guardId]
    );
    return result.count;
  }
}
