import express from 'express';
import { randomUUID } from 'crypto';
import db from '../db.js';
import { signToken, comparePassword, authMiddleware } from '../auth.js';
import { validate } from '../validation/index.js';
import { staffLoginSchema } from '../validation/auth.schemas.js';
import { staffClockInSchema, staffClockOutSchema } from '../validation/staff.schemas.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { success, created, error, badRequest, notFound, unauthorized, forbidden, conflict, serverError, noContent } from '../utils/responses.js';

const router = express.Router();

// POST /api/staff/login - Staff login
router.post('/login', authLimiter, validate(staffLoginSchema), async (req, res) => {
  const { email, password } = req.body;
  try {
    const staff = db.prepare('SELECT * FROM staff WHERE email = ?').get(email);
    if (!staff) return unauthorized(res, 'Invalid email or password');

    const ok = await comparePassword(password, staff.password, async (newHash) => {
      db.prepare('UPDATE staff SET password = ? WHERE id = ?').run(newHash, staff.id);
    });
    if (!ok) return unauthorized(res, 'Invalid email or password');

    const token = signToken({ id: staff.id, role: staff.role || 'staff' });

    res.json({
      success: true,
      token,
      role: staff.role || 'staff',
      staff: {
        id: staff.id,
        name: staff.name,
        // NOTE: email and phone are NOT encrypted - required for login lookup
        email: staff.email,
        phone: staff.phone,
        employeeId: staff.employeeId,
        role: staff.role,
        assignedArea: staff.assignedArea,
        status: staff.status,
      },
    });
  } catch (err) {
    return serverError(res, String(err));
  }
});

// POST /api/staff/attendance/clock-in - Staff clock in
router.post('/attendance/clock-in', authMiddleware(true, ['staff', 'admin']), validate(staffClockInSchema), (req, res) => {
  const { staffId, shiftType, location } = req.body;

  const id = randomUUID();
  const clockInTime = new Date().toISOString();
  const date = new Date().toISOString().split('T')[0];

  try {
    const insert = db.prepare(`INSERT INTO staff_attendance (
      id, staffId, clockInTime, shiftType, lat, lng, date
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`);

    insert.run(
      id,
      staffId,
      clockInTime,
      shiftType || 'general',
      location?.lat || null,
      location?.lng || null,
      date
    );

    // Update staff status
    db.prepare("UPDATE staff SET status = 'on_duty' WHERE id = ?").run(staffId);

    const row = db.prepare('SELECT * FROM staff_attendance WHERE id = ?').get(id);
    return created(res, {
      ...row,
      location: (row.lat && row.lng) ? { lat: row.lat, lng: row.lng } : undefined,
    }, 'Staff clocked in successfully');
  } catch (err) {
    return serverError(res, String(err));
  }
});

// POST /api/staff/attendance/clock-out - Staff clock out
router.post('/attendance/clock-out', authMiddleware(true, ['staff', 'admin']), validate(staffClockOutSchema), (req, res) => {
  const { staffId, location } = req.body;

  try {
    // Find active attendance record
    const attendance = db.prepare(`
      SELECT * FROM staff_attendance 
      WHERE staffId = ? AND clockOutTime IS NULL 
      ORDER BY clockInTime DESC LIMIT 1
    `).get(staffId);

    if (!attendance) {
      return notFound(res, 'active clock-in', staffId);
    }

    const clockOutTime = new Date().toISOString();
    db.prepare('UPDATE staff_attendance SET clockOutTime = ? WHERE id = ?').run(clockOutTime, attendance.id);

    // Update staff status
    db.prepare("UPDATE staff SET status = 'offline' WHERE id = ?").run(staffId);

    const row = db.prepare('SELECT * FROM staff_attendance WHERE id = ?').get(attendance.id);
    return success(res, {
      ...row,
      location: (row.lat && row.lng) ? { lat: row.lat, lng: row.lng } : undefined,
    }, 200, 'Staff clocked out successfully');
  } catch (err) {
    return serverError(res, String(err));
  }
});

// GET /api/staff/attendance/status/:staffId - Get current attendance status
router.get('/attendance/status/:staffId', authMiddleware(true, ['staff', 'admin']), (req, res) => {
  try {
    const row = db.prepare(`
      SELECT * FROM staff_attendance 
      WHERE staffId = ? AND clockOutTime IS NULL 
      ORDER BY clockInTime DESC LIMIT 1
    `).get(req.params.staffId);

    if (!row) {
      return success(res, null);
    }

    return success(res, {
      ...row,
      location: (row.lat && row.lng) ? { lat: row.lat, lng: row.lng } : undefined,
    });
  } catch (err) {
    return serverError(res, String(err));
  }
});

export default router;
