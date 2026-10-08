import express from 'express';
import { randomUUID } from 'crypto';
import db from '../db.js';
import { authMiddleware } from '../auth.js';
import { ownParam } from '../middleware/access.js';
import { validate, validateQuery } from '../validation/index.js';
import { createScheduleSchema, updateScheduleSchema, scheduleQuerySchema } from '../validation/schedule.schemas.js';
import { success, created, error, badRequest, notFound, unauthorized, forbidden, conflict, serverError, noContent } from '../utils/responses.js';

const router = express.Router();

// GET /api/schedules/:guardId - Get schedules for a guard
router.get('/:guardId', authMiddleware(true, ['guard', 'staff', 'admin']), ownParam('guardId'), validateQuery(scheduleQuerySchema), (req, res) => {
  try {
    const { from, to } = req.query;
    let query = 'SELECT * FROM guard_schedules WHERE guardId = ?';
    const params = [req.params.guardId];

    if (from) {
      query += ' AND date >= ?';
      params.push(from);
    }
    if (to) {
      query += ' AND date <= ?';
      params.push(to);
    }

    query += ' ORDER BY date ASC, startTime ASC';
    const rows = db.prepare(query).all(...params);
    
    return success(res, rows.map(row => ({
      ...row,
      isNightShift: !!row.isNightShift,
    })));
  } catch (err) {
    return serverError(res, String(err));
  }
});

// POST /api/schedules - Create a schedule
router.post('/', authMiddleware(true, ['staff', 'admin']), validate(createScheduleSchema), (req, res) => {
  try {
    const { guardId, siteId, siteName, date, startTime, endTime, isNightShift } = req.body;
    const id = randomUUID();
    const createdAt = new Date().toISOString();

    db.prepare(`
      INSERT INTO guard_schedules (id, guardId, siteId, siteName, date, startTime, endTime, isNightShift, status, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?)
    `).run(id, guardId, siteId || null, siteName || null, date, startTime, endTime, isNightShift ? 1 : 0, createdAt);

    return created(res, { id, guardId, siteId, siteName, date, startTime, endTime, isNightShift: !!isNightShift, status: 'scheduled' }, 'Schedule created successfully');
  } catch (err) {
    return serverError(res, String(err));
  }
});

// PUT /api/schedules/:id - Update a schedule
router.put('/:id', authMiddleware(true, ['staff', 'admin']), validate(updateScheduleSchema), (req, res) => {
  try {
    const { siteId, siteName, date, startTime, endTime, isNightShift, status } = req.body;
    const existing = db.prepare('SELECT * FROM guard_schedules WHERE id = ?').get(req.params.id);
    if (!existing) return notFound(res, 'schedule', req.params.id);

    db.prepare(`
      UPDATE guard_schedules 
      SET siteId = ?, siteName = ?, date = ?, startTime = ?, endTime = ?, isNightShift = ?, status = ?
      WHERE id = ?
    `).run(
      siteId ?? existing.siteId,
      siteName ?? existing.siteName,
      date ?? existing.date,
      startTime ?? existing.startTime,
      endTime ?? existing.endTime,
      isNightShift !== undefined ? (isNightShift ? 1 : 0) : existing.isNightShift,
      status ?? existing.status,
      req.params.id
    );

    return success(res, { ok: true }, 200, 'Schedule updated successfully');
  } catch (err) {
    return serverError(res, String(err));
  }
});

// DELETE /api/schedules/:id - Delete a schedule
router.delete('/:id', authMiddleware(true, ['admin']), (req, res) => {
  try {
    db.prepare('DELETE FROM guard_schedules WHERE id = ?').run(req.params.id);
    return success(res, { ok: true }, 200, 'Schedule deleted successfully');
  } catch (err) {
    return serverError(res, String(err));
  }
});

export default router;
