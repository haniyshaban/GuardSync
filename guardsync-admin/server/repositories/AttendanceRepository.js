import { randomUUID } from 'crypto';
import { BaseRepository } from './BaseRepository.js';

export class AttendanceRepository extends BaseRepository {
  constructor(db) {
    super(db, 'guard_attendance');
  }

  /**
   * Find attendance records by guard ID
   */
  findByGuardId(guardId, orderBy = 'date DESC') {
    return this.query(
      `SELECT * FROM guard_attendance WHERE guardId = ? ORDER BY ${orderBy}`,
      [guardId]
    );
  }

  /**
   * Find attendance records by site ID
   */
  findBySiteId(siteId, orderBy = 'date DESC') {
    return this.query(
      `SELECT * FROM guard_attendance WHERE siteId = ? ORDER BY ${orderBy}`,
      [siteId]
    );
  }

  /**
   * Find attendance records by date
   */
  findByDate(date) {
    return this.query('SELECT * FROM guard_attendance WHERE date = ?', [date]);
  }

  /**
   * Find attendance records by date range
   */
  findByDateRange(startDate, endDate, guardId = null) {
    if (guardId) {
      return this.query(
        'SELECT * FROM guard_attendance WHERE guardId = ? AND date >= ? AND date <= ? ORDER BY date DESC',
        [guardId, startDate, endDate]
      );
    }
    return this.query(
      'SELECT * FROM guard_attendance WHERE date >= ? AND date <= ? ORDER BY date DESC',
      [startDate, endDate]
    );
  }

  /**
   * Find active (clocked-in) attendance record for guard
   */
  findActiveClockin(guardId) {
    return this.queryOne(
      'SELECT * FROM guard_attendance WHERE guardId = ? AND clockOut IS NULL ORDER BY clockIn DESC LIMIT 1',
      [guardId]
    );
  }

  /**
   * Create attendance record with clock-in
   */
  clockIn(guardId, siteId, lat, lng, withinGeofence) {
    const id = randomUUID();
    const clockIn = new Date().toISOString();
    const date = new Date().toISOString().split('T')[0];
    
    return this.execute(
      `INSERT INTO guard_attendance (id, guardId, siteId, clockIn, clockOut, withinGeofence, lat, lng, date)
       VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?)`,
      [id, guardId, siteId || null, clockIn, withinGeofence ? 1 : 0, lat || null, lng || null, date]
    );
  }

  /**
   * Update attendance record with clock-out
   */
  clockOut(attendanceId, clockOut) {
    return this.update(attendanceId, { clockOut });
  }

  /**
   * Get attendance statistics for a guard in a date range
   */
  getGuardStats(guardId, startDate, endDate) {
    return this.queryOne(
      `SELECT 
        COUNT(*) as totalDays,
        SUM(CASE WHEN clockOut IS NOT NULL THEN 1 ELSE 0 END) as completedDays,
        SUM(withinGeofence) as daysWithinGeofence
       FROM guard_attendance 
       WHERE guardId = ? AND date >= ? AND date <= ?`,
      [guardId, startDate, endDate]
    );
  }

  /**
   * Find all attendance records with optional filters
   */
  findWithFilters(filters) {
    let query = 'SELECT * FROM guard_attendance WHERE 1=1';
    const params = [];

    if (filters.guardId) {
      query += ' AND guardId = ?';
      params.push(filters.guardId);
    }

    if (filters.siteId) {
      query += ' AND siteId = ?';
      params.push(filters.siteId);
    }

    if (filters.startDate) {
      query += ' AND date >= ?';
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ' AND date <= ?';
      params.push(filters.endDate);
    }

    query += ' ORDER BY date DESC, clockIn DESC';

    return this.query(query, params);
  }
}
