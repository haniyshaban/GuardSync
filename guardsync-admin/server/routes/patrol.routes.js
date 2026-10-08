import express from 'express';
import { randomUUID } from 'crypto';
import db from '../db.js';
import { authMiddleware } from '../auth.js';
import { actAsSelf, ownParam, ownSiteParam } from '../middleware/access.js';
import { validate, validateQuery } from '../validation/index.js';
import { createPatrolLogSchema, patrolLogQuerySchema } from '../validation/patrol.schemas.js';
import { success, created, error, badRequest, notFound, unauthorized, forbidden, conflict, serverError, noContent } from '../utils/responses.js';

const router = express.Router();

// GET /api/patrol-logs/:guardId - Get patrol logs for a guard
router.get('/:guardId', authMiddleware(true, ['guard', 'staff', 'admin']), ownParam('guardId'), validateQuery(patrolLogQuerySchema), (req, res) => {
  try {
    const { date, shiftId } = req.query;
    let query = 'SELECT * FROM patrol_logs WHERE guardId = ?';
    const params = [req.params.guardId];

    if (date) {
      query += ' AND DATE(timestamp) = ?';
      params.push(date);
    }
    if (shiftId) {
      query += ' AND shiftId = ?';
      params.push(shiftId);
    }

    query += ' ORDER BY timestamp DESC';
    const rows = db.prepare(query).all(...params);
    
    return success(res, rows.map(row => ({
      ...row,
      latitude: row.lat,
      longitude: row.lng,
      withinRadius: !!row.withinRadius,
    })));
  } catch (err) {
    return serverError(res, String(err));
  }
});

// POST /api/patrol-logs - Create a patrol log entry
router.post('/', authMiddleware(true, ['guard', 'admin']), actAsSelf, validate(createPatrolLogSchema), (req, res) => {
  try {
    const { guardId, siteId, patrolPointId, patrolPointName, shiftId, lat, lng, withinRadius, distanceFromPoint } = req.body;
    const id = randomUUID();
    const timestamp = new Date().toISOString();

    db.prepare(`
      INSERT INTO patrol_logs (id, guardId, siteId, patrolPointId, patrolPointName, shiftId, lat, lng, withinRadius, distanceFromPoint, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, guardId, siteId || null, patrolPointId, patrolPointName, shiftId || null, lat || null, lng || null, withinRadius ? 1 : 0, distanceFromPoint || null, timestamp);

    return created(res, { 
      id, guardId, siteId, patrolPointId, patrolPointName, shiftId, 
      latitude: lat, longitude: lng, withinRadius: !!withinRadius, 
      distanceFromPoint, timestamp 
    }, 'Patrol log created successfully');
  } catch (err) {
    return serverError(res, String(err));
  }
});

// GET /api/patrol-logs/site/:siteId - Get patrol logs for a site
router.get('/site/:siteId', authMiddleware(true, ['guard', 'staff', 'admin']), ownSiteParam('siteId'), validateQuery(patrolLogQuerySchema.pick({ date: true })), (req, res) => {
  try {
    const { date } = req.query;
    let query = 'SELECT * FROM patrol_logs WHERE siteId = ?';
    const params = [req.params.siteId];

    if (date) {
      query += ' AND DATE(timestamp) = ?';
      params.push(date);
    }

    query += ' ORDER BY timestamp DESC LIMIT 100';
    const rows = db.prepare(query).all(...params);
    
    return success(res, rows.map(row => ({
      ...row,
      latitude: row.lat,
      longitude: row.lng,
      withinRadius: !!row.withinRadius,
    })));
  } catch (err) {
    return serverError(res, String(err));
  }
});

export default router;
