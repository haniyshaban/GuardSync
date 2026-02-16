import express from 'express';
import { randomUUID } from 'crypto';
import db from '../db.js';
import { authMiddleware } from '../auth.js';
import { validate, validateQuery } from '../validation/index.js';
import { createFieldReportSchema, fieldReportQuerySchema } from '../validation/report.schemas.js';
import { success, created, error, badRequest, notFound, unauthorized, forbidden, conflict, serverError, noContent } from '../utils/responses.js';

const router = express.Router();

// Helper to transform field report row with business logic
const fieldReportRowToObj = (row) => ({
  ...row,
  location: (row.lat !== null && row.lng !== null) 
    ? { lat: row.lat, lng: row.lng } 
    : undefined,
  tags: row.tags ? JSON.parse(row.tags) : [],
});

// POST /api/reports/field - Staff uploads a field report
router.post('/field', authMiddleware(true, ['staff', 'admin']), validate(createFieldReportSchema), (req, res) => {
  const { staffId, staffName, reportType, title, description, mediaUrl, mediaType, siteId, siteName, location, tags } = req.body;

  const id = randomUUID();
  const createdAt = new Date().toISOString();

  try {
    const insert = db.prepare(`INSERT INTO field_reports (
      id, staffId, staffName, reportType, title, description, mediaUrl, mediaType, 
      siteId, siteName, lat, lng, createdAt, tags
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    insert.run(
      id,
      staffId,
      staffName || null,
      reportType,
      title,
      description || null,
      mediaUrl || null,
      mediaType || null,
      siteId || null,
      siteName || null,
      location?.lat || null,
      location?.lng || null,
      createdAt,
      tags ? JSON.stringify(tags) : null
    );

    const row = db.prepare('SELECT * FROM field_reports WHERE id = ?').get(id);
    return created(res, fieldReportRowToObj(row), 'Field report created successfully');
  } catch (err) {
    return serverError(res, String(err));
  }
});

// GET /api/reports/field - Get field reports (optionally filter by staffId)
router.get('/field', authMiddleware(true, ['staff', 'admin']), validateQuery(fieldReportQuerySchema), (req, res) => {
  try {
    const { staffId } = req.query;
    let rows;
    if (staffId) {
      rows = db.prepare('SELECT * FROM field_reports WHERE staffId = ? ORDER BY createdAt DESC').all(staffId);
    } else {
      rows = db.prepare('SELECT * FROM field_reports ORDER BY createdAt DESC LIMIT 100').all();
    }
    return success(res, rows.map(fieldReportRowToObj));
  } catch (err) {
    return serverError(res, String(err));
  }
});

// GET /api/reports/field/:id - Get a single field report
router.get('/field/:id', authMiddleware(true, ['staff', 'admin']), (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM field_reports WHERE id = ?').get(req.params.id);
    if (!row) {
      return notFound(res, 'report', req.params.id);
    }
    return success(res, fieldReportRowToObj(row));
  } catch (err) {
    return serverError(res, String(err));
  }
});

export default router;
