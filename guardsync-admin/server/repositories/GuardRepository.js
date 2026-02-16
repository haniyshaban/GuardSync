import { BaseRepository } from './BaseRepository.js';

export class GuardRepository extends BaseRepository {
  constructor(db) {
    super(db, 'guards');
  }

  /**
   * Find guard by email
   */
  findByEmail(email) {
    return this.findOneBy('email', email);
  }

  /**
   * Find guard by phone
   */
  findByPhone(phone) {
    return this.findOneBy('phone', phone);
  }

  /**
   * Find guard by employee ID
   */
  findByEmployeeId(employeeId) {
    return this.findOneBy('employeeId', employeeId);
  }

  /**
   * Find all guards by site ID
   */
  findBySiteId(siteId) {
    return this.findBy('siteId', siteId);
  }

  /**
   * Find guards by status
   */
  findByStatus(status) {
    return this.findBy('status', status);
  }

  /**
   * Find all active guards
   */
  findActive() {
    return this.query('SELECT * FROM guards WHERE status IN (?, ?, ?)', ['online', 'on-duty', 'active']);
  }

  /**
   * Find currently clocked-in guards
   */
  findClockedIn() {
    return this.query('SELECT * FROM guards WHERE clockedIn = 1');
  }

  /**
   * Update guard location
   */
  updateLocation(id, lat, lng, locationHistory = null) {
    const data = {
      lat,
      lng,
      lastSeen: new Date().toISOString()
    };
    
    if (locationHistory !== null) {
      data.locationHistory = locationHistory;
    }
    
    return this.update(id, data);
  }

  /**
   * Update guard clock-in status
   */
  updateClockInStatus(id, clockedIn, clockInTime = null, status = null) {
    const data = {
      clockedIn: clockedIn ? 1 : 0
    };
    
    if (clockInTime !== null) {
      data.clockInTime = clockInTime;
    }
    
    if (status !== null) {
      data.status = status;
    }
    
    return this.update(id, data);
  }

  /**
   * Update guard shift assignment
   */
  updateShift(id, shiftId) {
    return this.update(id, { currentShiftId: shiftId });
  }

  /**
   * Search guards by name, email, or phone
   */
  search(searchTerm) {
    return this.query(
      'SELECT * FROM guards WHERE name LIKE ? OR email LIKE ? OR phone LIKE ?',
      [`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`]
    );
  }

  /**
   * Get guards with pagination
   */
  findPaginated(limit, offset, orderBy = 'createdAt DESC') {
    return this.query(
      `SELECT * FROM guards ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
      [limit, offset]
    );
  }

  /**
   * Count guards by status
   */
  countByStatus(status) {
    const result = this.queryOne('SELECT COUNT(*) as count FROM guards WHERE status = ?', [status]);
    return result.count;
  }

  /**
   * Get guard with full details including encrypted fields
   * (For admin use only - includes all PII)
   */
  findByIdWithPII(id) {
    return this.findById(id);
  }

  /**
   * Update guard face descriptor
   */
  updateFaceDescriptor(id, faceDescriptor) {
    return this.update(id, { faceDescriptor });
  }
}
