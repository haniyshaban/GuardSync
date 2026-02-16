import express from 'express';
import { randomUUID } from 'crypto';
import db from '../db.js';
import { authMiddleware } from '../auth.js';
import { validate } from '../validation/index.js';
import { createNotificationSchema } from '../validation/notification.schemas.js';
import { success, created, error, badRequest, notFound, unauthorized, forbidden, conflict, serverError, noContent } from '../utils/responses.js';

const router = express.Router();

// GET /api/notifications/:guardId - Get notifications for a guard
router.get('/:guardId', authMiddleware(true, ['guard', 'staff', 'admin']), (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT * FROM guard_notifications 
      WHERE guardId = ? 
      ORDER BY createdAt DESC
      LIMIT 50
    `).all(req.params.guardId);
    
    return success(res, rows.map(row => ({
      ...row,
      read: !!row.isRead,
      timestamp: row.createdAt,
    })));
  } catch (err) {
    return serverError(res, String(err));
  }
});

// POST /api/notifications - Create a notification
router.post('/', authMiddleware(true, ['staff', 'admin']), validate(createNotificationSchema), (req, res) => {
  try {
    const { guardId, type, title, message } = req.body;
    const id = randomUUID();
    const createdAt = new Date().toISOString();

    db.prepare(`
      INSERT INTO guard_notifications (id, guardId, type, title, message, isRead, createdAt)
      VALUES (?, ?, ?, ?, ?, 0, ?)
    `).run(id, guardId, type || 'info', title, message, createdAt);

    return created(res, { id, guardId, type, title, message, read: false, timestamp: createdAt }, 'Notification created successfully');
  } catch (err) {
    return serverError(res, String(err));
  }
});

// PUT /api/notifications/:id/read - Mark notification as read
router.put('/:id/read', authMiddleware(true, ['guard', 'admin']), (req, res) => {
  try {
    db.prepare('UPDATE guard_notifications SET isRead = 1 WHERE id = ?').run(req.params.id);
    return success(res, { ok: true }, 200, 'Notification marked as read');
  } catch (err) {
    return serverError(res, String(err));
  }
});

// PUT /api/notifications/:guardId/read-all - Mark all notifications as read
router.put('/:guardId/read-all', authMiddleware(true, ['guard', 'admin']), (req, res) => {
  try {
    db.prepare('UPDATE guard_notifications SET isRead = 1 WHERE guardId = ?').run(req.params.guardId);
    return success(res, { ok: true }, 200, 'All notifications marked as read');
  } catch (err) {
    return serverError(res, String(err));
  }
});

export default router;
