import express from 'express';
import { randomUUID } from 'crypto';
import db from '../db.js';
import { authMiddleware } from '../auth.js';
import { validate, validateQuery } from '../validation/index.js';
import { createSOSAlertSchema, resolveSOSAlertSchema, sosQuerySchema } from '../validation/sos.schemas.js';
import { success, created, error, badRequest, notFound, unauthorized, forbidden, conflict, serverError, noContent } from '../utils/responses.js';

const router = express.Router();

// Helper to transform SOS alert row with business logic
const sosAlertRowToObj = (row) => ({
  ...row,
  location: (row.lat && row.lng) ? { lat: row.lat, lng: row.lng } : undefined,
});

// GET /api/sos-alerts - Get all SOS alerts (optionally filter by status)
router.get('/', authMiddleware(true, ['guard', 'staff', 'admin']), validateQuery(sosQuerySchema), (req, res) => {
  try {
    const { status } = req.query;
    let rows;
    if (status) {
      rows = db.prepare('SELECT * FROM sos_alerts WHERE status = ? ORDER BY createdAt DESC').all(status);
    } else {
      rows = db.prepare('SELECT * FROM sos_alerts ORDER BY createdAt DESC').all();
    }
    return success(res, rows.map(sosAlertRowToObj));
  } catch (err) {
    return serverError(res, String(err));
  }
});

// GET /api/sos-alerts/:id - Get a specific SOS alert
router.get('/:id', authMiddleware(true, ['guard', 'staff', 'admin']), (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM sos_alerts WHERE id = ?').get(req.params.id);
    if (!row) return notFound(res, 'SOS alert', req.params.id);
    return success(res, sosAlertRowToObj(row));
  } catch (err) {
    return serverError(res, String(err));
  }
});

// POST /api/sos-alerts - Create a new SOS alert
router.post('/', authMiddleware(true, ['guard', 'admin']), validate(createSOSAlertSchema), (req, res) => {
  try {
    const { guardId, guardName, siteId, siteName, lat, lng, message } = req.body;
    const id = randomUUID();
    const createdAt = new Date().toISOString();

    db.prepare(`
      INSERT INTO sos_alerts (id, guardId, guardName, siteId, siteName, lat, lng, message, status, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
    `).run(id, guardId, guardName, siteId, siteName, lat || null, lng || null, message || null, createdAt);

    // Also update the guard's status to 'alert'
    if (guardId) {
      db.prepare('UPDATE guards SET status = ? WHERE id = ?').run('alert', guardId);
    }

    return created(res, {
      id,
      guardId,
      guardName,
      siteId,
      siteName,
      location: (lat && lng) ? { lat, lng } : undefined,
      message,
      status: 'active',
      createdAt,
    }, 'SOS alert created successfully');
  } catch (err) {
    return serverError(res, String(err));
  }
});

// PUT /api/sos-alerts/:id/resolve - Resolve an SOS alert
router.put('/:id/resolve', authMiddleware(true, ['staff', 'admin']), validate(resolveSOSAlertSchema), (req, res) => {
  try {
    const { resolvedBy, resolvedNotes } = req.body;
    const resolvedAt = new Date().toISOString();

    // Get the alert first to get guardId
    const alert = db.prepare('SELECT * FROM sos_alerts WHERE id = ?').get(req.params.id);
    if (!alert) return notFound(res, 'SOS alert', req.params.id);

    db.prepare(`
      UPDATE sos_alerts 
      SET status = 'resolved', resolvedAt = ?, resolvedBy = ?, resolvedNotes = ?
      WHERE id = ?
    `).run(resolvedAt, resolvedBy || null, resolvedNotes || null, req.params.id);

    // Update guard status back to 'idle'
    if (alert.guardId) {
      db.prepare('UPDATE guards SET status = ? WHERE id = ?').run('idle', alert.guardId);
    }

    return success(res, { ok: true, resolvedAt }, 200, 'SOS alert resolved successfully');
  } catch (err) {
    return serverError(res, String(err));
  }
});

// DELETE /api/sos-alerts/:id - Delete an SOS alert
router.delete('/:id', authMiddleware(true, ['admin']), (req, res) => {
  try {
    db.prepare('DELETE FROM sos_alerts WHERE id = ?').run(req.params.id);
    return success(res, { ok: true }, 200, 'SOS alert deleted successfully');
  } catch (err) {
    return serverError(res, String(err));
  }
});

export default router;
