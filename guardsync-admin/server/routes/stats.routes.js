import express from 'express';
import db from '../db.js';
import { authMiddleware } from '../auth.js';
import { success, created, error, badRequest, notFound, unauthorized, forbidden, conflict, serverError, noContent } from '../utils/responses.js';

const router = express.Router();

// GET /api/stats/dashboard - Get platform dashboard stats
router.get('/dashboard', authMiddleware(true, ['staff', 'admin']), (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    
    // Get all guards and attendance for today
    const guards = db.prepare('SELECT * FROM guards').all();
    const todayAttendance = db.prepare('SELECT * FROM guard_attendance WHERE date = ?').all(today);
    
    // Calculate average clock-in time
    let avgClockInTime = '--:--';
    if (todayAttendance.length > 0) {
      const clockInTimes = todayAttendance
        .filter(a => a.clockIn)
        .map(a => {
          const d = new Date(a.clockIn);
          return d.getHours() * 60 + d.getMinutes();
        });
      if (clockInTimes.length > 0) {
        const avgMinutes = Math.round(clockInTimes.reduce((a, b) => a + b, 0) / clockInTimes.length);
        const hours = Math.floor(avgMinutes / 60);
        const mins = avgMinutes % 60;
        avgClockInTime = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
      }
    }
    
    // Calculate geofence compliance (% of clock-ins within geofence)
    let geofenceCompliance = 0;
    const attendanceWithGeofence = todayAttendance.filter(a => a.withinGeofence !== null);
    if (attendanceWithGeofence.length > 0) {
      const compliantCount = attendanceWithGeofence.filter(a => a.withinGeofence === 1).length;
      geofenceCompliance = Math.round((compliantCount / attendanceWithGeofence.length) * 100 * 10) / 10;
    }
    
    // Count guards who clocked in today
    const clockedInToday = todayAttendance.length;
    const totalGuards = guards.length;
    
    return success(res, {
      avgClockInTime,
      geofenceCompliance,
      clockedInToday,
      totalGuards,
      wakeUpResponseRate: 0, // Placeholder - would need wake alert logs table
    });
  } catch (err) {
    return serverError(res, String(err));
  }
});

// GET /api/stats/guard/:guardId - Get stats for a specific guard
router.get('/guard/:guardId', authMiddleware(true, ['guard', 'staff', 'admin']), (req, res) => {
  try {
    const guardId = req.params.guardId;
    
    // Count total shifts (attendance records)
    const totalShifts = db.prepare('SELECT COUNT(*) as count FROM guard_attendance WHERE guardId = ?').get(guardId);
    
    // Count days with clock-in in the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentAttendance = db.prepare(`
      SELECT COUNT(DISTINCT date) as worked FROM guard_attendance 
      WHERE guardId = ? AND date >= ?
    `).get(guardId, thirtyDaysAgo.toISOString().slice(0, 10));
    
    // Calculate attendance rate (days worked / 30 days * 100)
    const daysWorked = recentAttendance?.worked || 0;
    // Assume 6 working days per week = ~26 expected days in 30 days
    const expectedDays = 26;
    const attendanceRate = expectedDays > 0 ? Math.min(100, Math.round((daysWorked / expectedDays) * 100)) : 0;
    
    // Get patrol completion count
    const patrolLogs = db.prepare('SELECT COUNT(*) as count FROM patrol_logs WHERE guardId = ?').get(guardId);
    
    return success(res, {
      shiftsCompleted: totalShifts?.count || 0,
      attendanceRate,
      patrolsCompleted: patrolLogs?.count || 0,
      daysWorkedLast30: daysWorked,
    });
  } catch (err) {
    return serverError(res, String(err));
  }
});

export default router;
