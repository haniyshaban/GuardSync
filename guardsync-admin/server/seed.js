import db from './db.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { hashPassword } from './auth.js';
import { encrypt } from './encryption.js';
import logger from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INITIAL_JSON = path.join(__dirname, 'initialData.json');

// Generate secure random password
function generateSecurePassword(length = 16) {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  const randomBytes = crypto.randomBytes(length);
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset[randomBytes[i] % charset.length];
  }
  return password;
}

/**
 * The demo guards' timestamps (lastSeen, clockInTime, location history) were written on fixed
 * days. This maps them into the last hour, keeping their order, so a fresh demo agrees with
 * today: guards seeded as on duty checked in today, and nobody was "last seen months ago".
 */
function demoTimeShifter(guards, now = Date.now()) {
  const times = guards
    .flatMap((g) => [g.lastSeen, g.clockInTime, ...(g.locationHistory || []).map((h) => h.at || h.timestamp)])
    .map((t) => Date.parse(t))
    .filter(Number.isFinite);
  if (times.length === 0) return (t) => t;
  const newest = Math.max(...times);
  const oldest = Math.min(...times);
  const startOfToday = new Date(now);
  startOfToday.setUTCHours(0, 0, 0, 0);
  // The whole spread fits in the last hour (or in what there is of today so far)
  const window = Math.min(60 * 60 * 1000, now - startOfToday.getTime());
  const scale = newest > oldest ? Math.min(1, window / (newest - oldest)) : 0;
  return (t) => {
    const ms = Date.parse(t);
    return Number.isFinite(ms) ? new Date(now - (newest - ms) * scale).toISOString() : t;
  };
}

export async function seedDatabase() {
  try {
    const raw = fs.readFileSync(INITIAL_JSON, 'utf-8');
    const parsed = JSON.parse(raw);
    
    // Demo data (sample sites, guards and staff) is only loaded when asked for.
    // Without it the system starts empty with a single admin account.
    const seedDemo = process.env.SEED_DEMO === 'true';

    // Track if this is the initial seed (for printing credentials)
    const isInitialSeed = db.prepare('SELECT COUNT(*) as c FROM staff').get().c === 0;
    const generatedCredentials = [];
    
    // Seed sites if empty
    const sitesCount = db.prepare('SELECT COUNT(*) as c FROM sites').get().c;
    if (seedDemo && sitesCount === 0 && Array.isArray(parsed.sites)) {
        const insert = db.prepare(`INSERT INTO sites (id,name,address,lat,lng,geofenceRadius,geofenceType,geofencePolygon,assignedGuards,isActive,createdAt,patrolRoute)
          VALUES (@id,@name,@address,@lat,@lng,@geofenceRadius,@geofenceType,@geofencePolygon,@assignedGuards,@isActive,@createdAt,@patrolRoute)`);
        const insertMany = db.transaction((sites) => {
          for (const s of sites) {
            insert.run({
              id: s.id,
              name: s.name,
              address: s.address,
              lat: s.location.lat,
              lng: s.location.lng,
              geofenceRadius: s.geofenceRadius || 0,
              geofenceType: s.geofenceType || 'radius',
              geofencePolygon: s.geofencePolygon ? JSON.stringify(s.geofencePolygon) : null,
              assignedGuards: s.assignedGuards ? JSON.stringify(s.assignedGuards) : '[]',
              isActive: s.isActive ? 1 : 0,
              createdAt: s.createdAt || new Date().toISOString(),
              patrolRoute: s.patrolRoute ? JSON.stringify(s.patrolRoute) : null,
            });
          }
      });
        insertMany(parsed.sites);
        logger.info({ count: parsed.sites.length }, 'Seeded sites from initialData.json');
      }
      
      // Seed guards with generated passwords if empty
      const guardsCount = db.prepare('SELECT COUNT(*) as c FROM guards').get().c;
      if (seedDemo && guardsCount === 0 && Array.isArray(parsed.guards)) {
        // Get default guard password from env or generate one random password for all guards
        const defaultGuardPassword = process.env.DEFAULT_GUARD_PASSWORD || generateSecurePassword();
        if (isInitialSeed && !process.env.DEFAULT_GUARD_PASSWORD) {
          generatedCredentials.push({
            title: 'Default Guard Credentials',
            email: 'Any guard email from initialData.json',
            password: defaultGuardPassword
          });
        }
        const insertGuard = db.prepare(`INSERT INTO guards (
          id, name, phone, email, password, employeeId, siteId, status, lastSeen,
          lat, lng, locationHistory, clockedIn, clockInTime, currentShiftId,
          address, emergencyContact, dateOfJoining, dailyRate,
          aadharNumber, panNumber, photographUrl, aadharDocUrl, panDocUrl, relievingLetterUrl,
          bankAccountNumber, bankIfsc, bankName, accountHolderName,
          shiftType, shiftStartTime, shiftEndTime, faceDescriptor
        ) VALUES (
          @id, @name, @phone, @email, @password, @employeeId, @siteId, @status, @lastSeen,
          @lat, @lng, @locationHistory, @clockedIn, @clockInTime, @currentShiftId,
          @address, @emergencyContact, @dateOfJoining, @dailyRate,
          @aadharNumber, @panNumber, @photographUrl, @aadharDocUrl, @panDocUrl, @relievingLetterUrl,
          @bankAccountNumber, @bankIfsc, @bankName, @accountHolderName,
          @shiftType, @shiftStartTime, @shiftEndTime, @faceDescriptor
        )`);
        
        const shiftTime = demoTimeShifter(parsed.guards);
        const seededNow = new Date().toISOString();

        for (const g of parsed.guards) {
          // Use provided password, env var, or generated default
          const plainPassword = g.password || defaultGuardPassword;
          const hashedPassword = plainPassword ? await hashPassword(plainPassword) : null;
          
          // Encrypt PII fields (Aadhar is protected under India's Aadhaar Act)
          const encryptedAadhar = g.aadharNumber ? encrypt(g.aadharNumber) : null;
          const encryptedPan = g.panNumber ? encrypt(g.panNumber) : null;
          const encryptedBankAccount = (g.bankDetails?.accountNumber || g.bankAccountNumber) ? 
            encrypt(g.bankDetails?.accountNumber || g.bankAccountNumber) : null;
          const encryptedBankIfsc = (g.bankDetails?.ifsc || g.bankIfsc) ? 
            encrypt(g.bankDetails?.ifsc || g.bankIfsc) : null;
          const encryptedBankName = (g.bankDetails?.bankName || g.bankName) ? 
            encrypt(g.bankDetails?.bankName || g.bankName) : null;
          const encryptedAccountHolder = (g.bankDetails?.accountHolderName || g.accountHolderName) ? 
            encrypt(g.bankDetails?.accountHolderName || g.accountHolderName) : null;
          const encryptedAddress = g.address ? encrypt(g.address) : null;
          const encryptedEmergencyContact = g.emergencyContact ? encrypt(g.emergencyContact) : null;
          
          insertGuard.run({
            id: g.id,
            name: g.name,
            // NOTE: phone is NOT encrypted - required for login lookup
            phone: g.phone,
            email: g.email || null,
            password: hashedPassword,
            employeeId: g.employeeId,
            siteId: g.siteId || null,
            status: g.status || 'offline',
            lastSeen: g.lastSeen ? shiftTime(g.lastSeen) : seededNow,
            lat: g.location?.lat || null,
            lng: g.location?.lng || null,
            locationHistory: g.locationHistory
              ? JSON.stringify(g.locationHistory.map((h) => ({
                ...h,
                ...(h.at ? { at: shiftTime(h.at) } : {}),
                ...(h.timestamp ? { timestamp: shiftTime(h.timestamp) } : {}),
              })))
              : '[]',
            clockedIn: g.clockedIn ? 1 : 0,
            clockInTime: g.clockInTime ? shiftTime(g.clockInTime) : (g.clockedIn ? seededNow : null),
            currentShiftId: g.currentShiftId || null,
            address: encryptedAddress,
            emergencyContact: encryptedEmergencyContact,
            dateOfJoining: g.dateOfJoining || null,
            dailyRate: g.dailyRate || null,
            aadharNumber: encryptedAadhar,
            panNumber: encryptedPan,
            photographUrl: g.documents?.photographUrl || null,
            aadharDocUrl: g.documents?.aadharDocUrl || null,
            panDocUrl: g.documents?.panDocUrl || null,
            relievingLetterUrl: g.documents?.relievingLetterUrl || null,
            bankAccountNumber: encryptedBankAccount,
            bankIfsc: encryptedBankIfsc,
            bankName: encryptedBankName,
            accountHolderName: encryptedAccountHolder,
            shiftType: g.shiftType || 'day',
            shiftStartTime: g.shiftStartTime || '08:00',
            shiftEndTime: g.shiftEndTime || '20:00',
            faceDescriptor: g.faceDescriptor || null,
          });
        }
        logger.info({ count: parsed.guards.length }, 'Seeded guards with hashed passwords');

        // Make the rest of the demo agree with the guards:
        // - a guard seeded as on duty has an open attendance row (so they can check out, and
        //   the dashboard counts them as checked in today)
        // - each site's guard list (site_guards, and the older assignedGuards copy) is the
        //   guards whose siteId is that site
        db.transaction(() => {
          const guardRows = db.prepare('SELECT id, siteId, clockedIn, clockInTime, lat, lng FROM guards').all();
          const siteIds = new Set(db.prepare('SELECT id FROM sites').all().map((row) => row.id));
          const insertAttendance = db.prepare(`INSERT INTO guard_attendance (id, guardId, siteId, clockIn, clockOut, withinGeofence, lat, lng, date)
            VALUES (?, ?, ?, ?, NULL, 1, ?, ?, ?)`);
          const insertSiteGuard = db.prepare('INSERT OR IGNORE INTO site_guards (id, site_id, guard_id) VALUES (?, ?, ?)');
          const guardsBySite = new Map([...siteIds].map((siteId) => [siteId, []]));
          for (const row of guardRows) {
            if (row.clockedIn && row.clockInTime) {
              insertAttendance.run(crypto.randomUUID(), row.id, row.siteId || null, row.clockInTime, row.lat, row.lng, row.clockInTime.slice(0, 10));
            }
            if (row.siteId && siteIds.has(row.siteId)) {
              insertSiteGuard.run(crypto.randomUUID(), row.siteId, row.id);
              guardsBySite.get(row.siteId).push(row.id);
            }
          }
          const updateSiteGuards = db.prepare('UPDATE sites SET assignedGuards = ? WHERE id = ?');
          for (const [siteId, guardIds] of guardsBySite) updateSiteGuards.run(JSON.stringify(guardIds), siteId);
        })();
        logger.info('Seeded demo attendance for guards on duty, and site guard lists');
      }
      
      // Seed staff with generated passwords if empty  
      const staffCount = db.prepare('SELECT COUNT(*) as c FROM staff').get().c;
      if (staffCount === 0 && Array.isArray(parsed.staff)) {
        const insertStaff = db.prepare(`INSERT INTO staff (
          id, name, email, password, phone, employeeId, role, assignedArea, status, createdAt
        ) VALUES (
          @id, @name, @email, @password, @phone, @employeeId, @role, @assignedArea, @status, @createdAt
        )`);
        
        // Clean start: only the first admin, with the email from ADMIN_EMAIL if one is set
        const staffToSeed = seedDemo
          ? parsed.staff
          : parsed.staff
              .filter((member) => member.role === 'admin')
              .slice(0, 1)
              .map((member) => ({ ...member, name: 'Administrator', email: process.env.ADMIN_EMAIL || member.email }));

        for (const s of staffToSeed) {
          let plainPassword = s.password;
          
          // Generate password from env var or random
          if (!plainPassword) {
            if (s.role === 'admin' && process.env.ADMIN_PASSWORD) {
              plainPassword = process.env.ADMIN_PASSWORD;
            } else if (s.role === 'admin' && process.env.ADMIN_EMAIL === s.email) {
              plainPassword = process.env.ADMIN_PASSWORD || generateSecurePassword();
            } else {
              plainPassword = generateSecurePassword();
            }
          }
          
          const hashedPassword = plainPassword ? await hashPassword(plainPassword) : null;
          
          // Track generated credentials for initial seed
          if (isInitialSeed && !s.password) {
            generatedCredentials.push({
              title: s.role === 'admin' ? 'Admin Credentials' : `${s.role} Credentials - ${s.name}`,
              email: s.email,
              password: plainPassword
            });
          }
          
          insertStaff.run({
            id: s.id,
            name: s.name,
            email: s.email,
            password: hashedPassword,
            phone: s.phone || null,
            employeeId: s.employeeId || null,
            role: s.role || 'staff',
            assignedArea: s.assignedArea || null,
            status: s.status || 'active',
            createdAt: s.createdAt || new Date().toISOString(),
          });
        }
        logger.info({ count: staffToSeed.length, demo: seedDemo }, 'Seeded staff with hashed passwords');
      }
      
      // Print generated credentials if this was initial seed
      if (isInitialSeed && generatedCredentials.length > 0) {
        // Logs get copied, shipped and kept, so passwords are written to a local file instead
        const file = path.join(__dirname, 'data', 'initial-credentials.txt');
        const lines = [
          'GuardSync - first-time logins',
          'Created ' + new Date().toISOString(),
          'Log in, change these passwords, then delete this file.',
          '',
          ...generatedCredentials.flatMap((cred) => [cred.title, '  Email:    ' + cred.email, '  Password: ' + cred.password, '']),
        ];
        fs.writeFileSync(file, lines.join('\n'), { mode: 0o600 });
        logger.warn({ file, accounts: generatedCredentials.length }, 'First-time logins were written to a file. Read it, change the passwords, then delete it.');
      }
  } catch (err) {
    logger.error({ err }, 'Failed to seed database');
  }
}
