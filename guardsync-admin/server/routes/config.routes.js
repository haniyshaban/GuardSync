import express from 'express';
import db from '../db.js';
import { authMiddleware } from '../auth.js';
import { validate } from '../validation/index.js';
import { updateConfigSchema } from '../validation/config.schemas.js';
import { success, serverError } from '../utils/responses.js';

const router = express.Router();

// GET /api/config - Get system configuration
router.get('/', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM system_config WHERE id = ?').get('main');
    if (!row) {
      return success(res, {
        usePremiumAPIs: false,
        faceRecognition: 'local',
        mapProvider: 'openstreetmap',
        locationUpdateInterval: 30,
        geofenceStrictness: 'medium',
        autoClockOut: true,
      });
    }
    return success(res, {
      usePremiumAPIs: !!row.usePremiumAPIs,
      faceRecognition: row.faceRecognition,
      mapProvider: row.mapProvider,
      locationUpdateInterval: row.locationUpdateInterval,
      geofenceStrictness: row.geofenceStrictness,
      autoClockOut: !!row.autoClockOut,
      updatedAt: row.updatedAt,
    });
  } catch (err) {
    return serverError(res, String(err));
  }
});

// PUT /api/config - Update system configuration
router.put('/', authMiddleware(true, ['admin']), validate(updateConfigSchema), (req, res) => {
  try {
    const { usePremiumAPIs, faceRecognition, mapProvider, locationUpdateInterval, geofenceStrictness, autoClockOut } = req.body;
    const updatedAt = new Date().toISOString();

    db.prepare(`
      UPDATE system_config 
      SET usePremiumAPIs = ?, faceRecognition = ?, mapProvider = ?, locationUpdateInterval = ?, geofenceStrictness = ?, autoClockOut = ?, updatedAt = ?
      WHERE id = 'main'
    `).run(
      usePremiumAPIs ? 1 : 0,
      faceRecognition || 'local',
      mapProvider || 'openstreetmap',
      locationUpdateInterval || 30,
      geofenceStrictness || 'medium',
      autoClockOut ? 1 : 0,
      updatedAt
    );

    return success(res, { updated: true, updatedAt });
  } catch (err) {
    return serverError(res, String(err));
  }
});

export default router;
