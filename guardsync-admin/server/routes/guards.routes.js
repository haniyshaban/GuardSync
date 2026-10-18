import express from 'express';
import { hashPassword, authMiddleware } from '../auth.js';
import { validate } from '../validation/index.js';
import { enrollGuardSchema, updateGuardSchema, rejectGuardSchema, updateGuardProfileSchema, updateGuardLocationSchema } from '../validation/guard.schemas.js';
import { guardRowToObj } from './auth.routes.js';
import { encrypt } from '../encryption.js';
import { randomUUID } from 'crypto';
import { guardRepo } from '../repositories/index.js';
import { ownParam } from '../middleware/access.js';
import { faceCheckLimiter } from '../middleware/rateLimiter.js';
import { parseDescriptor, facesMatch } from '../utils/face.js';
import db from '../db.js'; // Still needed for complex operations not yet migrated
import { success, created, error, badRequest, notFound, conflict, forbidden, serverError } from '../utils/responses.js';
import logger from '../logger.js';

const router = express.Router();

// POST /api/guards/enroll - New guard enrollment (creates a new guard record)
router.post('/enroll', validate(enrollGuardSchema), async (req, res) => {
  const {
    full_name, email, phone, address, emergency_contact,
    aadhar_number, pan_number, bank_account_number, bank_ifsc,
    bank_name, account_holder_name, face_descriptor, password,
    photograph_url, aadhar_doc_url, pan_doc_url, relieving_letter_url
  } = req.body;

  // Check if email already exists using repository
  const existingGuard = guardRepo.findByEmail(email);
  if (existingGuard) {
    return conflict(res, 'A guard with this email already exists');
  }

  // Generate unique ID and employee ID using crypto-safe random values
  const id = randomUUID();
  const empSuffix = randomUUID().replace(/-/g, '').substring(0, 6).toUpperCase();
  const employeeId = `GW-${new Date().getFullYear()}-${empSuffix}`;
  const dateOfJoining = new Date().toISOString().split('T')[0];
  const createdAt = new Date().toISOString();

  try {
    const insert = db.prepare(`INSERT INTO guards (
      id, name, phone, email, password, employeeId, siteId, status, lastSeen, lat, lng, 
      locationHistory, clockedIn, clockInTime, currentShiftId,
      address, emergencyContact, dateOfJoining, dailyRate,
      aadharNumber, panNumber, photographUrl, aadharDocUrl, panDocUrl, relievingLetterUrl,
      bankAccountNumber, bankIfsc, bankName, accountHolderName,
      shiftType, shiftStartTime, shiftEndTime, faceDescriptor
    ) VALUES (
      @id, @name, @phone, @email, @password, @employeeId, @siteId, @status, @lastSeen, @lat, @lng,
      @locationHistory, @clockedIn, @clockInTime, @currentShiftId,
      @address, @emergencyContact, @dateOfJoining, @dailyRate,
      @aadharNumber, @panNumber, @photographUrl, @aadharDocUrl, @panDocUrl, @relievingLetterUrl,
      @bankAccountNumber, @bankIfsc, @bankName, @accountHolderName,
      @shiftType, @shiftStartTime, @shiftEndTime, @faceDescriptor
    )`);

    // Encrypt PII fields before storing (Aadhar is protected under India's Aadhaar Act)
    const encryptedAadhar = aadhar_number ? encrypt(aadhar_number.replace(/\D/g, '')) : null;
    const encryptedPan = pan_number ? encrypt(pan_number.toUpperCase()) : null;
    const encryptedBankAccount = bank_account_number ? encrypt(bank_account_number) : null;
    const encryptedBankIfsc = bank_ifsc ? encrypt(bank_ifsc.toUpperCase()) : null;
    const encryptedBankName = bank_name ? encrypt(bank_name) : null;
    const encryptedAccountHolder = account_holder_name ? encrypt(account_holder_name) : null;
    const encryptedAddress = address ? encrypt(address) : null;
    const encryptedEmergencyContact = emergency_contact ? encrypt(emergency_contact) : null;

    insert.run({
      id,
      name: full_name,
      // NOTE: phone is NOT encrypted - required for login lookup
      phone,
      email,
      password: password ? await hashPassword(password) : null,
      employeeId,
      siteId: null, // Will be assigned later by admin
      status: 'pending', // New guards start as pending
      lastSeen: createdAt,
      lat: null,
      lng: null,
      locationHistory: '[]',
      clockedIn: 0,
      clockInTime: null,
      currentShiftId: null,
      address: encryptedAddress,
      emergencyContact: encryptedEmergencyContact,
      dateOfJoining,
      dailyRate: 750, // Default daily rate
      aadharNumber: encryptedAadhar,
      panNumber: encryptedPan,
      photographUrl: photograph_url || null,
      aadharDocUrl: aadhar_doc_url || null,
      panDocUrl: pan_doc_url || null,
      relievingLetterUrl: relieving_letter_url || null,
      bankAccountNumber: encryptedBankAccount,
      bankIfsc: encryptedBankIfsc,
      bankName: encryptedBankName,
      accountHolderName: encryptedAccountHolder,
      shiftType: 'day',
      shiftStartTime: '08:00',
      shiftEndTime: '20:00',
      faceDescriptor: face_descriptor || null,
    });

    const row = guardRepo.findById(id);
    
    logger.info({ guardId: id, employeeId, email, name: full_name }, 'New guard enrolled');
    
    return created(res, { guard: guardRowToObj(row, { id: row.id, role: 'guard' }) }, 'Guard enrolled successfully');
  } catch (err) {
    logger.error({ err }, 'Guard enrollment failed');
    return serverError(res, String(err));
  }
});

// GET /api/guards - Get all guards
router.get('/', authMiddleware(true, ['staff', 'admin']), (req, res) => {
  try {
    const rows = guardRepo.findAll('id');
    logger.debug({ count: rows.length }, 'Fetching all guards');
    const mapped = rows.map((row) => guardRowToObj(row, req.user));
    return success(res, mapped);
  } catch (err) {
    logger.error({ err }, 'Failed to fetch guards');
    return serverError(res, String(err));
  }
});

// GET /api/guards/:id - Get single guard by ID
router.get('/:id', authMiddleware(true, ['guard', 'staff', 'admin']), ownParam('id'), (req, res) => {
  try {
    const row = guardRepo.findById(req.params.id);
    if (!row) return notFound(res, 'guard', req.params.id);
    return success(res, guardRowToObj(row, req.user));
  } catch (err) {
    return serverError(res, String(err));
  }
});

// PUT /api/guards/:id - Update guard (partial update)
router.put('/:id', authMiddleware(true, ['staff', 'admin']), validate(updateGuardSchema), (req, res) => {
  const g = req.body;
  try {
    // Get current guard data first
    const currentGuard = db.prepare('SELECT * FROM guards WHERE id = ?').get(req.params.id);
    if (!currentGuard) {
      return notFound(res, 'guard', req.params.id);
    }

    // An enrolment only becomes an account through the admin-only approve route, so this route
    // cannot move a guard into or out of 'pending'. (Sending the status unchanged is fine:
    // the dashboard sends the whole guard back when it saves an edit.)
    if (g.status !== undefined && g.status !== currentGuard.status
        && (currentGuard.status === 'pending' || g.status === 'pending')) {
      return forbidden(res, 'Pending enrolments are approved or rejected with their own actions');
    }

    // The email is the guard's login, so it has to stay unique
    if (g.email !== undefined && g.email.toLowerCase() !== String(currentGuard.email || '').toLowerCase()) {
      const taken = db.prepare('SELECT id FROM guards WHERE lower(email) = lower(?) AND id != ?').get(g.email, req.params.id);
      if (taken) return conflict(res, 'Another guard already uses this email');
    }

    // A guard can only be assigned to a site that exists
    if (g.siteId && !db.prepare('SELECT id FROM sites WHERE id = ?').get(g.siteId)) {
      return badRequest(res, 'Unknown site');
    }

    // Merge with existing data - only update fields that are provided
    const merged = {
      name: g.name !== undefined ? g.name : currentGuard.name,
      phone: g.phone !== undefined ? g.phone : currentGuard.phone,
      email: g.email !== undefined ? g.email : currentGuard.email,
      employeeId: g.employeeId !== undefined ? g.employeeId : currentGuard.employeeId,
      siteId: g.siteId !== undefined ? (g.siteId || null) : currentGuard.siteId,
      status: g.status !== undefined ? g.status : currentGuard.status,
      lastSeen: g.lastSeen !== undefined ? g.lastSeen : (currentGuard.lastSeen || new Date().toISOString()),
      lat: g.location !== undefined ? (g.location ? g.location.lat : null) : currentGuard.lat,
      lng: g.location !== undefined ? (g.location ? g.location.lng : null) : currentGuard.lng,
      locationHistory: g.locationHistory !== undefined ? JSON.stringify(g.locationHistory) : currentGuard.locationHistory,
      clockedIn: g.clockedIn !== undefined ? (g.clockedIn ? 1 : 0) : currentGuard.clockedIn,
      clockInTime: g.clockInTime !== undefined ? (g.clockInTime || null) : currentGuard.clockInTime,
      currentShiftId: g.currentShiftId !== undefined ? (g.currentShiftId || null) : currentGuard.currentShiftId,
      dailyRate: g.dailyRate !== undefined ? g.dailyRate : currentGuard.dailyRate,
      dateOfJoining: g.dateOfJoining !== undefined ? g.dateOfJoining : currentGuard.dateOfJoining,
      shiftType: g.shiftType !== undefined ? g.shiftType : currentGuard.shiftType,
      shiftStartTime: g.shiftStartTime !== undefined ? g.shiftStartTime : currentGuard.shiftStartTime,
      shiftEndTime: g.shiftEndTime !== undefined ? g.shiftEndTime : currentGuard.shiftEndTime,
    };
    
    // Determine status: if siteId is being set to null and guard isn't pending, set to unassigned
    if (currentGuard.status !== 'pending') {
      if (g.siteId !== undefined && !g.siteId) {
        // siteId is explicitly being set to null/empty - mark as unassigned
        merged.status = 'unassigned';
      } else if (g.siteId && currentGuard.status === 'unassigned') {
        // Being assigned to a site from unassigned - set to offline (will go online when clocked in)
        merged.status = 'offline';
      }
    }
    
    // Use transaction to update both guards table and site_guards table
    const transaction = db.transaction(() => {
      const update = db.prepare(`UPDATE guards SET name=@name,phone=@phone,email=@email,employeeId=@employeeId,siteId=@siteId,status=@status,lastSeen=@lastSeen,lat=@lat,lng=@lng,locationHistory=@locationHistory,clockedIn=@clockedIn,clockInTime=@clockInTime,currentShiftId=@currentShiftId,
        dailyRate=@dailyRate,dateOfJoining=@dateOfJoining,shiftType=@shiftType,shiftStartTime=@shiftStartTime,shiftEndTime=@shiftEndTime WHERE id=@id`);
      update.run({
        id: req.params.id,
        ...merged
      });
      
      // Update site_guards table if siteId changed
      if (g.siteId !== undefined && g.siteId !== currentGuard.siteId) {
        // Remove guard from all sites in site_guards table
        db.prepare('DELETE FROM site_guards WHERE guard_id = ?').run(req.params.id);
        
        // If assigning to a new site, add to site_guards table
        if (g.siteId) {
          db.prepare('INSERT OR IGNORE INTO site_guards (id, site_id, guard_id) VALUES (?, ?, ?)')
            .run(randomUUID(), g.siteId, req.params.id);
          
          // Also update the site's assignedGuards JSON column for backwards compatibility
          const siteRow = db.prepare('SELECT assignedGuards FROM sites WHERE id = ?').get(g.siteId);
          if (siteRow) {
            const guards = siteRow.assignedGuards ? JSON.parse(siteRow.assignedGuards) : [];
            if (!guards.includes(req.params.id)) {
              guards.push(req.params.id);
              db.prepare('UPDATE sites SET assignedGuards = ? WHERE id = ?')
                .run(JSON.stringify(guards), g.siteId);
            }
          }
        }
        
        // If unassigning from old site, update old site's assignedGuards JSON column
        if (currentGuard.siteId) {
          const oldSiteRow = db.prepare('SELECT assignedGuards FROM sites WHERE id = ?').get(currentGuard.siteId);
          if (oldSiteRow) {
            const guards = oldSiteRow.assignedGuards ? JSON.parse(oldSiteRow.assignedGuards) : [];
            const filtered = guards.filter(gid => gid !== req.params.id);
            db.prepare('UPDATE sites SET assignedGuards = ? WHERE id = ?')
              .run(JSON.stringify(filtered), currentGuard.siteId);
          }
        }
      }
    });
    
    transaction();
    
    const row = db.prepare('SELECT * FROM guards WHERE id = ?').get(req.params.id);
    return success(res, guardRowToObj(row, req.user));
  } catch (err) {
    return serverError(res, String(err));
  }
});

// DELETE /api/guards/:id - Delete guard
router.delete('/:id', authMiddleware(true, ['admin']), (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM guards WHERE id = ?').get(req.params.id);
    if (!row) return notFound(res, 'guard', req.params.id);
    
    // Disable foreign key checks temporarily
    db.pragma('foreign_keys = OFF');
    
    // Delete all related records from all tables with guardId foreign key
    try { db.prepare('DELETE FROM leave_requests WHERE guardId = ?').run(req.params.id); } catch(e) { logger.debug({ table: 'leave_requests', error: e.message }, 'Cascade delete'); }
    try { db.prepare('DELETE FROM conveyance_requests WHERE guardId = ?').run(req.params.id); } catch(e) { logger.debug({ table: 'conveyance_requests', error: e.message }, 'Cascade delete'); }
    try { db.prepare('DELETE FROM sos_alerts WHERE guardId = ?').run(req.params.id); } catch(e) { logger.debug({ table: 'sos_alerts', error: e.message }, 'Cascade delete'); }
    try { db.prepare('DELETE FROM guard_attendance WHERE guardId = ?').run(req.params.id); } catch(e) { logger.debug({ table: 'guard_attendance', error: e.message }, 'Cascade delete'); }
    try { db.prepare('DELETE FROM guard_schedules WHERE guardId = ?').run(req.params.id); } catch(e) { logger.debug({ table: 'guard_schedules', error: e.message }, 'Cascade delete'); }
    try { db.prepare('DELETE FROM guard_notifications WHERE guardId = ?').run(req.params.id); } catch(e) { logger.debug({ table: 'guard_notifications', error: e.message }, 'Cascade delete'); }
    try { db.prepare('DELETE FROM patrol_logs WHERE guardId = ?').run(req.params.id); } catch(e) { logger.debug({ table: 'patrol_logs', error: e.message }, 'Cascade delete'); }
    try { db.prepare('DELETE FROM payroll WHERE guardId = ?').run(req.params.id); } catch(e) { logger.debug({ table: 'payroll', error: e.message }, 'Cascade delete'); }
    
    // Delete from site_guards table (normalized relation)
    try { db.prepare('DELETE FROM site_guards WHERE guard_id = ?').run(req.params.id); } catch(e) { logger.debug({ table: 'site_guards', error: e.message }, 'Cascade delete'); }

    // ...and from the sites' assignedGuards column (the older copy of that list, which is still
    // shown for a site that has no site_guards rows)
    try {
      for (const site of db.prepare('SELECT id, assignedGuards FROM sites').all()) {
        const guardIds = site.assignedGuards ? JSON.parse(site.assignedGuards) : [];
        if (Array.isArray(guardIds) && guardIds.includes(req.params.id)) {
          db.prepare('UPDATE sites SET assignedGuards = ? WHERE id = ?')
            .run(JSON.stringify(guardIds.filter((gid) => gid !== req.params.id)), site.id);
        }
      }
    } catch(e) { logger.debug({ table: 'sites', error: e.message }, 'Cascade delete'); }
    
    // Delete the guard
    db.prepare('DELETE FROM guards WHERE id = ?').run(req.params.id);
    
    // Re-enable foreign key checks
    db.pragma('foreign_keys = ON');
    
    logger.info({ guardId: row.id, employeeId: row.employeeId, name: row.name }, 'Guard deleted');
    
    // Return minimal guard info - middleware will handle any needed case conversion
    return success(res, {
      deletedGuard: {
        id: row.id,
        name: row.name,
        employeeId: row.employeeId,
      }
    }, 200, 'Guard deleted successfully');
  } catch (err) {
    // Re-enable foreign key checks even on error
    try { db.pragma('foreign_keys = ON'); } catch(e) {}
    logger.error({ err, guardId: req.params.id }, 'Failed to delete guard');
    return serverError(res, String(err));
  }
});

// POST /api/guards/:id/approve - Approve a pending guard enrollment
router.post('/:id/approve', authMiddleware(true, ['admin']), (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM guards WHERE id = ?').get(req.params.id);
    if (!row) return notFound(res, 'guard', req.params.id);
    
    if (row.status !== 'pending') {
      return badRequest(res, 'Guard is not in pending status');
    }
    
    // Determine the new status based on clock-in state
    // If guard hasn't clocked in, they go to 'offline', otherwise based on activity
    const newStatus = row.clockedIn ? 'online' : 'offline';
    
    db.prepare('UPDATE guards SET status = ? WHERE id = ?').run(newStatus, req.params.id);
    
    const updatedRow = db.prepare('SELECT * FROM guards WHERE id = ?').get(req.params.id);
    
    logger.info({ guardId: req.params.id, name: row.name, status: newStatus }, 'Guard approved');
    
    return success(res, { guard: guardRowToObj(updatedRow, req.user) }, 200, 'Guard enrollment approved successfully');
  } catch (err) {
    logger.error({ err, guardId: req.params.id }, 'Failed to approve guard');
    return serverError(res, String(err));
  }
});

// POST /api/guards/:id/reject - Reject a pending guard enrollment
router.post('/:id/reject', authMiddleware(true, ['admin']), validate(rejectGuardSchema), (req, res) => {
  try {
    const { reason } = req.body;
    const row = db.prepare('SELECT * FROM guards WHERE id = ?').get(req.params.id);
    if (!row) return notFound(res, 'guard', req.params.id);
    
    if (row.status !== 'pending') {
      return badRequest(res, 'Guard is not in pending status');
    }
    
    // Delete the guard record (rejection means they're not enrolled)
    db.prepare('DELETE FROM guards WHERE id = ?').run(req.params.id);
    
    logger.info({ guardId: req.params.id, name: row.name, reason }, 'Guard enrollment rejected');
    
    return success(res, {
      rejectedGuard: {
        id: row.id,
        name: row.name,
        email: row.email,
        reason: reason || null,
      }
    }, 200, 'Guard enrollment rejected');
  } catch (err) {
    logger.error({ err, guardId: req.params.id }, 'Failed to reject guard enrollment');
    return serverError(res, String(err));
  }
});

// PUT /api/guards/:id/profile - Update guard profile/personal details
router.put('/:id/profile', authMiddleware(true, ['guard', 'staff', 'admin']), ownParam('id'), validate(updateGuardProfileSchema), (req, res) => {
  const g = req.body;
  try {
    // Only the fields that were actually sent are changed; everything else is left as it is.
    // PII is encrypted before storing (Aadhaar is protected under India's Aadhaar Act).
    // The face template is not accepted here: it has its own route (PUT /:id/face) with its own rules.
    const fields = ['address', 'emergencyContact', 'aadharNumber', 'panNumber', 'bankAccountNumber', 'bankIfsc', 'bankName', 'accountHolderName'];
    const snake = (k) => k.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
    const changes = {};
    for (const field of fields) {
      const value = g[field] ?? g[snake(field)];
      if (value !== undefined && value !== null && value !== '') changes[field] = encrypt(String(value));
    }
    if (!db.prepare('SELECT id FROM guards WHERE id = ?').get(req.params.id)) return notFound(res, 'guard', req.params.id);
    if (Object.keys(changes).length > 0) {
      const sets = Object.keys(changes).map((field) => `${field} = @${field}`).join(', ');
      db.prepare(`UPDATE guards SET ${sets} WHERE id = @id`).run({ ...changes, id: req.params.id });
    }
    const row = db.prepare('SELECT * FROM guards WHERE id = ?').get(req.params.id);
    return success(res, guardRowToObj(row, req.user));
  } catch (err) {
    return serverError(res, String(err));
  }
});

// PUT /api/guards/:id/face - Save a guard's face descriptor (first-time enrolment)
// Only the guard can enrol, only their own face, and only once. Nobody else can set a face for
// a guard: whoever chooses the enrolled face can log in as that guard with face login.
router.put('/:id/face', authMiddleware(true, ['guard']), ownParam('id'), (req, res) => {
  try {
    const descriptor = req.body?.face_descriptor ?? req.body?.faceDescriptor;
    if (!parseDescriptor(descriptor)) {
      return badRequest(res, 'A face descriptor is required');
    }

    const row = db.prepare('SELECT id, faceDescriptor FROM guards WHERE id = ?').get(req.params.id);
    if (!row) return notFound(res, 'guard', req.params.id);
    if (row.faceDescriptor) return conflict(res, 'A face is already enrolled. Ask an admin to reset it.');

    guardRepo.updateFaceDescriptor(req.params.id, typeof descriptor === 'string' ? descriptor : JSON.stringify(descriptor));
    logger.info({ guardId: req.params.id }, 'Guard face descriptor saved');
    return success(res, { guardId: req.params.id, enrolled: true }, 200, 'Face enrolled');
  } catch (err) {
    logger.error({ err, guardId: req.params.id }, 'Failed to save face descriptor');
    return serverError(res, String(err));
  }
});

// DELETE /api/guards/:id/face - Reset a guard's face (admin only).
// This clears the enrolled face; the guard then enrols again from their own phone.
router.delete('/:id/face', authMiddleware(true, ['admin']), (req, res) => {
  try {
    if (!guardRepo.findById(req.params.id)) return notFound(res, 'guard', req.params.id);
    guardRepo.updateFaceDescriptor(req.params.id, null);
    logger.info({ guardId: req.params.id, by: req.user.id }, 'Guard face reset');
    return success(res, { guardId: req.params.id, enrolled: false }, 200, 'Face reset. The guard will enrol again at their next check-in.');
  } catch (err) {
    logger.error({ err, guardId: req.params.id }, 'Failed to reset face');
    return serverError(res, String(err));
  }
});

// POST /api/guards/:id/face/verify - Does this scan match the guard's enrolled face?
// The app asks here instead of comparing on the phone, so the enrolled face never has to leave the server.
router.post('/:id/face/verify', faceCheckLimiter, authMiddleware(true, ['guard']), ownParam('id'), (req, res) => {
  try {
    const descriptor = req.body?.face_descriptor ?? req.body?.faceDescriptor;
    if (!parseDescriptor(descriptor)) return badRequest(res, 'A face descriptor is required');
    const row = db.prepare('SELECT faceDescriptor FROM guards WHERE id = ?').get(req.params.id);
    if (!row) return notFound(res, 'guard', req.params.id);
    if (!row.faceDescriptor) return badRequest(res, 'No face is enrolled yet');
    return success(res, { match: facesMatch(descriptor, row.faceDescriptor) });
  } catch (err) {
    return serverError(res, String(err));
  }
});

// PUT /api/guards/:id/location - Update guard's current location
router.put('/:id/location', authMiddleware(true, ['guard', 'admin']), ownParam('id'), validate(updateGuardLocationSchema), (req, res) => {
  try {
    const { lat, lng } = req.body;
    const guardId = req.params.id;
    
    // Update guard's location
    db.prepare(`
      UPDATE guards SET lat = ?, lng = ?, lastSeen = ? WHERE id = ?
    `).run(lat, lng, new Date().toISOString(), guardId);
    
    // Get the guard to append to location history
    const guard = db.prepare('SELECT * FROM guards WHERE id = ?').get(guardId);
    if (guard) {
      let history = [];
      try {
        history = guard.locationHistory ? JSON.parse(guard.locationHistory) : [];
      } catch (e) {}
      
      // Keep last 50 positions
      history.push({ lat, lng, timestamp: new Date().toISOString() });
      if (history.length > 50) history = history.slice(-50);
      
      db.prepare('UPDATE guards SET locationHistory = ? WHERE id = ?')
        .run(JSON.stringify(history), guardId);
    }
    
    return success(res, { updated: true });
  } catch (err) {
    return serverError(res, String(err));
  }
});

export default router;
