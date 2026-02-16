import { randomUUID } from 'crypto';
import { BaseRepository } from './BaseRepository.js';

export class NotificationRepository extends BaseRepository {
  constructor(db) {
    super(db, 'guard_notifications');
  }

  /**
   * Find notifications by guard ID
   */
  findByGuardId(guardId, orderBy = 'createdAt DESC') {
    return this.query(
      `SELECT * FROM guard_notifications WHERE guardId = ? ORDER BY ${orderBy}`,
      [guardId]
    );
  }

  /**
   * Find unread notifications by guard ID
   */
  findUnreadByGuardId(guardId) {
    return this.query(
      'SELECT * FROM guard_notifications WHERE guardId = ? AND isRead = 0 ORDER BY createdAt DESC',
      [guardId]
    );
  }

  /**
   * Find notifications by type
   */
  findByType(type) {
    return this.query(
      'SELECT * FROM guard_notifications WHERE type = ? ORDER BY createdAt DESC',
      [type]
    );
  }

  /**
   * Mark notification as read
   */
  markAsRead(id) {
    return this.update(id, { isRead: 1 });
  }

  /**
   * Mark all notifications as read for a guard
   */
  markAllAsRead(guardId) {
    return this.execute(
      'UPDATE guard_notifications SET isRead = 1 WHERE guardId = ? AND isRead = 0',
      [guardId]
    );
  }

  /**
   * Create notification
   */
  createNotification(guardId, type, title, message) {
    const id = randomUUID();
    return this.create({
      id,
      guardId,
      type,
      title,
      message,
      isRead: 0,
      createdAt: new Date().toISOString()
    });
  }

  /**
   * Count unread notifications for a guard
   */
  countUnread(guardId) {
    const result = this.queryOne(
      'SELECT COUNT(*) as count FROM guard_notifications WHERE guardId = ? AND isRead = 0',
      [guardId]
    );
    return result.count;
  }

  /**
   * Delete old notifications (cleanup)
   */
  deleteOlderThan(days) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffISO = cutoffDate.toISOString();
    
    return this.execute(
      'DELETE FROM guard_notifications WHERE createdAt < ?',
      [cutoffISO]
    );
  }

  /**
   * Find recent notifications
   */
  findRecent(limit = 50) {
    return this.query(
      'SELECT * FROM guard_notifications ORDER BY createdAt DESC LIMIT ?',
      [limit]
    );
  }
}
