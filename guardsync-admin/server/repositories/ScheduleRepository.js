import { randomUUID } from 'crypto';
import { BaseRepository } from './BaseRepository.js';

export class ScheduleRepository extends BaseRepository {
  constructor(db) {
    super(db, 'guard_schedules');
  }

  /**
   * Find schedules by guard ID
   */
  findByGuardId(guardId, orderBy = 'date DESC') {
    return this.query(
      `SELECT * FROM guard_schedules WHERE guardId = ? ORDER BY ${orderBy}`,
      [guardId]
    );
  }

  /**
   * Find schedules by site ID
   */
  findBySiteId(siteId, orderBy = 'date DESC') {
    return this.query(
      `SELECT * FROM guard_schedules WHERE siteId = ? ORDER BY ${orderBy}`,
      [siteId]
    );
  }

  /**
   * Find schedules by date
   */
  findByDate(date) {
    return this.query(
      'SELECT * FROM guard_schedules WHERE date = ? ORDER BY startTime',
      [date]
    );
  }

  /**
   * Find schedules by date range
   */
  findByDateRange(startDate, endDate) {
    return this.query(
      'SELECT * FROM guard_schedules WHERE date >= ? AND date <= ? ORDER BY date, startTime',
      [startDate, endDate]
    );
  }

  /**
   * Find schedules by guard and date range
   */
  findByGuardAndDateRange(guardId, startDate, endDate) {
    return this.query(
      'SELECT * FROM guard_schedules WHERE guardId = ? AND date >= ? AND date <= ? ORDER BY date',
      [guardId, startDate, endDate]
    );
  }

  /**
   * Find schedules by status
   */
  findByStatus(status) {
    return this.query(
      'SELECT * FROM guard_schedules WHERE status = ? ORDER BY date DESC',
      [status]
    );
  }

  /**
   * Find night shift schedules
   */
  findNightShifts() {
    return this.query(
      'SELECT * FROM guard_schedules WHERE isNightShift = 1 ORDER BY date DESC',
      []
    );
  }

  /**
   * Create schedule
   */
  createSchedule(scheduleData) {
    const id = randomUUID();
    return this.create({
      id,
      guardId: scheduleData.guardId,
      siteId: scheduleData.siteId || null,
      siteName: scheduleData.siteName || null,
      date: scheduleData.date,
      startTime: scheduleData.startTime,
      endTime: scheduleData.endTime,
      isNightShift: scheduleData.isNightShift ? 1 : 0,
      status: scheduleData.status || 'scheduled',
      createdAt: new Date().toISOString()
    });
  }

  /**
   * Update schedule status
   */
  updateStatus(id, status) {
    return this.update(id, { status });
  }

  /**
   * Check for schedule conflicts
   */
  findConflicts(guardId, date, startTime, endTime, excludeId = null) {
    const query = excludeId
      ? 'SELECT * FROM guard_schedules WHERE guardId = ? AND id != ? AND date = ? AND ((startTime < ? AND endTime > ?) OR (startTime < ? AND endTime > ?) OR (startTime >= ? AND endTime <= ?))'
      : 'SELECT * FROM guard_schedules WHERE guardId = ? AND date = ? AND ((startTime < ? AND endTime > ?) OR (startTime < ? AND endTime > ?) OR (startTime >= ? AND endTime <= ?))';
    
    const params = excludeId
      ? [guardId, excludeId, date, endTime, startTime, endTime, startTime, startTime, endTime]
      : [guardId, date, endTime, startTime, endTime, startTime, startTime, endTime];
    
    return this.query(query, params);
  }

  /**
   * Get today's schedules for a guard
   */
  getTodaySchedules(guardId) {
    const today = new Date().toISOString().split('T')[0];
    return this.query(
      'SELECT * FROM guard_schedules WHERE guardId = ? AND date = ? ORDER BY startTime',
      [guardId, today]
    );
  }
}
