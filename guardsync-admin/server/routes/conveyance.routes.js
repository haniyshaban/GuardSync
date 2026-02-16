import express from 'express';
import { randomUUID } from 'crypto';
import db from '../db.js';
import { authMiddleware } from '../auth.js';
import { validate } from '../validation/index.js';
import { conveyanceRequestSchema, conveyanceResponseSchema } from '../validation/conveyance.schemas.js';
import { success, created, badRequest, notFound, serverError } from '../utils/responses.js';

const router = express.Router();

// Helper to transform conveyance request row with business logic
const conveyanceRowToObj = (row) => ({
  ...row,
  currentLocation: (row.currentLat !== null && row.currentLng !== null) 
    ? { lat: row.currentLat, lng: row.currentLng } 
    : undefined,
});

// POST /api/conveyance/request - Guard submits a conveyance request
router.post('/request', authMiddleware(true, ['guard', 'admin']), validate(conveyanceRequestSchema), (req, res) => {
  const { guardId, siteId, reason, estimatedDuration, currentLocation } = req.body;

  // Get guard and site details
  const guard = db.prepare('SELECT name, siteId FROM guards WHERE id = ?').get(guardId);
  if (!guard) {
    return notFound(res, 'guard', guardId);
  }

  const actualSiteId = siteId || guard.siteId;
  let siteName = null;
  if (actualSiteId) {
    const site = db.prepare('SELECT name FROM sites WHERE id = ?').get(actualSiteId);
    siteName = site?.name || null;
  }

  const id = randomUUID();
  const requestedAt = new Date().toISOString();

  try {
    const insert = db.prepare(`INSERT INTO conveyance_requests (
      id, guardId, guardName, siteId, siteName, reason, estimatedDuration, 
      currentLat, currentLng, requestedAt, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    insert.run(
      id,
      guardId,
      guard.name,
      actualSiteId,
      siteName,
      reason,
      estimatedDuration || 30,
      currentLocation?.lat || null,
      currentLocation?.lng || null,
      requestedAt,
      'pending'
    );

    const row = db.prepare('SELECT * FROM conveyance_requests WHERE id = ?').get(id);
    return created(res, conveyanceRowToObj(row));
  } catch (err) {
    return serverError(res, String(err));
  }
});

// GET /api/conveyance/pending - Staff gets all pending conveyance requests
router.get('/pending', authMiddleware(true, ['staff', 'admin']), (req, res) => {
  try {
    const rows = db.prepare("SELECT * FROM conveyance_requests WHERE status = 'pending' ORDER BY requestedAt DESC").all();
    return success(res, rows.map(conveyanceRowToObj));
  } catch (err) {
    return serverError(res, String(err));
  }
});

// GET /api/conveyance/status/:guardId - Get current conveyance request status for a guard
router.get('/status/:guardId', authMiddleware(true, ['guard', 'staff', 'admin']), (req, res) => {
  try {
    // Get the most recent request (pending or approved within last 2 hours)
    const row = db.prepare(`
      SELECT * FROM conveyance_requests 
      WHERE guardId = ? 
      AND (status = 'pending' OR (status = 'approved' AND datetime(respondedAt) > datetime('now', '-2 hours')))
      ORDER BY requestedAt DESC 
      LIMIT 1
    `).get(req.params.guardId);

    if (!row) {
      return success(res, null);
    }
    return success(res, conveyanceRowToObj(row));
  } catch (err) {
    return serverError(res, String(err));
  }
});

// PUT /api/conveyance/:id/respond - Staff approves or denies a request
router.put('/:id/respond', authMiddleware(true, ['staff', 'admin']), validate(conveyanceResponseSchema), (req, res) => {
  const { action, staffId, notes } = req.body;

  try {
    const status = action === 'approve' ? 'approved' : 'denied';
    const respondedAt = new Date().toISOString();

    const update = db.prepare(`UPDATE conveyance_requests SET 
      status = ?, respondedAt = ?, respondedBy = ?, staffNotes = ? 
      WHERE id = ?`);
    update.run(status, respondedAt, staffId || null, notes || null, req.params.id);

    const row = db.prepare('SELECT * FROM conveyance_requests WHERE id = ?').get(req.params.id);
    if (!row) {
      return notFound(res, 'conveyance request', req.params.id);
    }
    return success(res, conveyanceRowToObj(row));
  } catch (err) {
    return serverError(res, String(err));
  }
});

// DELETE /api/conveyance/:id - Guard cancels a pending request
router.delete('/:id', authMiddleware(true, ['guard', 'admin']), (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM conveyance_requests WHERE id = ?').get(req.params.id);
    if (!row) {
      return notFound(res, 'conveyance request', req.params.id);
    }
    if (row.status !== 'pending') {
      return badRequest(res, 'Can only cancel pending requests');
    }

    db.prepare('DELETE FROM conveyance_requests WHERE id = ?').run(req.params.id);
    return success(res, { deleted: true });
  } catch (err) {
    return serverError(res, String(err));
  }
});

// GET /api/conveyance/history/:guardId - Get conveyance request history for a guard
router.get('/history/:guardId', authMiddleware(true, ['guard', 'staff', 'admin']), (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM conveyance_requests WHERE guardId = ? ORDER BY requestedAt DESC LIMIT 50').all(req.params.guardId);
    return success(res, rows.map(conveyanceRowToObj));
  } catch (err) {
    return serverError(res, String(err));
  }
});

export default router;
