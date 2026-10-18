import express from 'express';
import { authMiddleware } from '../auth.js';
import { actAsSelf, scopeQueryToSelf } from '../middleware/access.js';
import { validate, validateQuery } from '../validation/index.js';
import { clockInSchema, clockOutSchema, attendanceQuerySchema } from '../validation/attendance.schemas.js';
import { attendanceRepo, guardRepo, siteRepo, notificationRepo } from '../repositories/index.js';
import { facesMatch } from '../utils/face.js';
import { success, created, error, badRequest, notFound, unauthorized, forbidden, conflict, serverError, noContent } from '../utils/responses.js';
import logger from '../logger.js';

const router = express.Router();

// GET /api/attendance - Get guard attendance records with optional filters
// Consolidated route supporting multiple query parameter formats
router.get('/', authMiddleware(true, ['guard', 'staff', 'admin']), scopeQueryToSelf, validateQuery(attendanceQuerySchema), (req, res) => {
  try {
    const { from, to, site_id, guard_id, date, start_date, end_date } = req.query;
    
    // Build filters object for repository
    const filters = {};
    
    // Support both parameter styles for date filtering
    if (date) {
      filters.startDate = date;
      filters.endDate = date;
    } else if (start_date && end_date) {
      filters.startDate = start_date;
      filters.endDate = end_date;
    } else if (from || to) {
      if (from) filters.startDate = from;
      if (to) filters.endDate = to;
    }
    
    if (site_id && site_id !== 'all') {
      filters.siteId = site_id;
    }
    
    if (guard_id) {
      filters.guardId = guard_id;
    }

    const rows = attendanceRepo.findWithFilters(filters);
    
    // Transform response with business logic (middleware handles case conversion)
    return success(res, rows.map(row => ({
      ...row,
      withinGeofence: !!row.withinGeofence,
      location: (row.lat && row.lng) ? { lat: row.lat, lng: row.lng } : undefined,
    })));
  } catch (err) {
    return serverError(res, String(err));
  }
});

// POST /api/attendance/clock-in - Guard clock in
router.post('/clock-in', authMiddleware(true, ['guard', 'admin']), actAsSelf, validate(clockInSchema), (req, res) => {
  try {
    const { guard_id, site_id, lat, lng, within_geofence, face_descriptor } = req.body;

    // The site must be a real one. The id is stored and shown back in admin reports,
    // so it cannot be free text.
    const site = siteRepo.findById(site_id);
    if (!site) {
      return badRequest(res, 'Unknown site');
    }

    // Checking in again while on duty would replace the start of the shift
    if (attendanceRepo.findActiveClockin(guard_id)) {
      return error(res, 409, 'ALREADY_CLOCKED_IN', 'You are already checked in. Check out first.');
    }

    // A guard with an enrolled face must present a matching one. The comparison happens here,
    // so a modified app cannot skip it. (An admin clocking a guard in is not face-checked.)
    if (req.user?.role === 'guard') {
      const guard = guardRepo.findById(guard_id);
      if (guard?.faceDescriptor && !facesMatch(face_descriptor, guard.faceDescriptor)) {
        return forbidden(res, 'Face check failed. Please scan your face again.');
      }
    }

    const clockIn = new Date().toISOString();
    const date = clockIn.slice(0, 10);

    // Create attendance record using repository
    attendanceRepo.clockIn(guard_id, site_id, lat, lng, within_geofence);

    // Update guard status using repository
    guardRepo.updateClockInStatus(guard_id, true, clockIn, 'online');

    // The confirmation in the guard's Alerts (guards cannot create notifications themselves).
    // The check-in is already saved, so a failure here is only logged.
    try {
      notificationRepo.createNotification(guard_id, 'success', 'Check-in confirmed', `Successfully checked in at ${site.name || 'your site'}.`);
    } catch (err) {
      logger.warn({ err, guardId: guard_id }, 'Could not create the check-in notification');
    }

    return created(res, { guardId: guard_id, siteId: site_id, clockIn, withinGeofence: !!within_geofence, date }, 'Clocked in successfully');
  } catch (err) {
    return serverError(res, String(err));
  }
});

// POST /api/attendance/clock-out - Guard clock out
router.post('/clock-out', authMiddleware(true, ['guard', 'admin']), actAsSelf, validate(clockOutSchema), (req, res) => {
  try {
    const { guard_id } = req.body;
    const clockOut = new Date().toISOString();

    // Find active attendance record using repository
    const attendance = attendanceRepo.findActiveClockin(guard_id);

    if (!attendance) {
      return notFound(res, 'active clock-in', guard_id);
    }

    // Update attendance record using repository
    attendanceRepo.clockOut(attendance.id, clockOut);
    
    // Update guard status using repository
    guardRepo.updateClockInStatus(guard_id, false, null, 'offline');

    return success(res, { ...attendance, clockOut }, 200, 'Clocked out successfully');
  } catch (err) {
    return serverError(res, String(err));
  }
});

export default router;
