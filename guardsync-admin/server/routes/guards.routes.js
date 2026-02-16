import express from 'express';
import { hashPassword, authMiddleware } from '../auth.js';
import { validate } from '../validation/index.js';
import { enrollGuardSchema, updateGuardSchema, rejectGuardSchema, updateGuardProfileSchema, updateGuardLocationSchema } from '../validation/guard.schemas.js';
import { guardRowToObj } from './auth.routes.js';
import { encrypt } from '../encryption.js';
import { randomUUID } from 'crypto';
import { guardRepo } from '../repositories/index.js';
import db from '../db.js'; // Still needed for complex operations not yet migrated
import { success, created, error, badRequest, notFound, conflict, serverError } from '../utils/responses.js';
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
    
    return created(res, { guard: guardRowToObj(row) }, 'Guard enrolled successfully');
  } catch (err) {
    logger.error({ err }, 'Guard enrollment failed');
    return serverError(res, String(err));
  }
});

// GET /api/guards - Get all guards
router.get('/', authMiddleware(true, ['guard', 'staff', 'admin']), (req, res) => {
  try {
    const rows = guardRepo.findAll('id');
    logger.debug({ count: rows.length }, 'Fetching all guards');
    const mapped = rows.map(guardRowToObj);
    return success(res, mapped);
  } catch (err) {
    logger.error({ err }, 'Failed to fetch guards');
    return serverError(res, String(err));
  }
});

// GET /api/guards/:id - Get single guard by ID
router.get('/:id', authMiddleware(true, ['guard', 'staff', 'admin']), (req, res) => {
  try {
    const row = guardRepo.findById(req.params.id);
    if (!row) return notFound(res, 'guard', req.params.id);
    return success(res, guardRowToObj(row));
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
    
    // Merge with existing data - only update fields that are provided
    const merged = {
      name: g.name !== undefined ? g.name : currentGuard.name,
      phone: g.phone !== undefined ? g.phone : currentGuard.phone,
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
      const update = db.prepare('UPDATE guards SET name=@name,phone=@phone,employeeId=@employeeId,siteId=@siteId,status=@status,lastSeen=@lastSeen,lat=@lat,lng=@lng,locationHistory=@locationHistory,clockedIn=@clockedIn,clockInTime=@clockInTime,currentShiftId=@currentShiftId WHERE id=@id');
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
    return success(res, guardRowToObj(row));
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
    
    return success(res, { guard: guardRowToObj(updatedRow) }, 200, 'Guard enrollment approved successfully');
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
router.put('/:id/profile', authMiddleware(true, ['guard', 'staff', 'admin']), validate(updateGuardProfileSchema), (req, res) => {
  const g = req.body;
  try {
    // Encrypt PII fields before storing (Aadhar is protected under India's Aadhaar Act)
    const encryptedAadhar = g.aadharNumber ? encrypt(g.aadharNumber) : null;
    const encryptedPan = g.panNumber ? encrypt(g.panNumber) : null;
    const encryptedBankAccount = g.bankAccountNumber ? encrypt(g.bankAccountNumber) : null;
    const encryptedBankIfsc = g.bankIfsc ? encrypt(g.bankIfsc) : null;
    const encryptedBankName = g.bankName ? encrypt(g.bankName) : null;
    const encryptedAccountHolder = g.accountHolderName ? encrypt(g.accountHolderName) : null;
    const encryptedAddress = g.address ? encrypt(g.address) : null;
    const encryptedEmergencyContact = g.emergencyContact ? encrypt(g.emergencyContact) : null;
    
    const update = db.prepare(`UPDATE guards SET 
      address = @address,
      emergencyContact = @emergencyContact,
      aadharNumber = @aadharNumber,
      panNumber = @panNumber,
      bankAccountNumber = @bankAccountNumber,
      bankIfsc = @bankIfsc,
      bankName = @bankName,
      accountHolderName = @accountHolderName,
      faceDescriptor = @faceDescriptor
      WHERE id = @id`);
    update.run({
      id: req.params.id,
      address: encryptedAddress,
      emergencyContact: encryptedEmergencyContact,
      aadharNumber: encryptedAadhar,
      panNumber: encryptedPan,
      bankAccountNumber: encryptedBankAccount,
      bankIfsc: encryptedBankIfsc,
      bankName: encryptedBankName,
      accountHolderName: encryptedAccountHolder,
      faceDescriptor: g.faceDescriptor || null,
    });
    const row = db.prepare('SELECT * FROM guards WHERE id = ?').get(req.params.id);
    return success(res, guardRowToObj(row));
  } catch (err) {
    return serverError(res, String(err));
  }
});

// PUT /api/guards/:id/location - Update guard's current location
router.put('/:id/location', authMiddleware(true, ['guard', 'admin']), validate(updateGuardLocationSchema), (req, res) => {
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
