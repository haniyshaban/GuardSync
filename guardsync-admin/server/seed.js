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

// Print credentials banner
function printCredentialsBanner(title, email, password) {
  const border = '═'.repeat(50);
  const banner = [
    `\n╔${border}╗`,
    `║${' '.repeat(50)}║`,
    `║  ${title.padEnd(46)}  ║`,
    `║${' '.repeat(50)}║`,
    `║  Email: ${email.padEnd(40)}║`,
    `║  Password: ${password.padEnd(36)}║`,
    `║${' '.repeat(50)}║`,
    `║  ⚠️  SAVE THESE CREDENTIALS - SHOWN ONLY ONCE  ║`,
    `║  ⚠️  Change password after first login         ║`,
    `║${' '.repeat(50)}║`,
    `╚${border}╝\n`
  ].join('\n');
  logger.info(banner);
}

export async function seedDatabase() {
  try {
    const raw = fs.readFileSync(INITIAL_JSON, 'utf-8');
    const parsed = JSON.parse(raw);
    
    // Track if this is the initial seed (for printing credentials)
    const isInitialSeed = db.prepare('SELECT COUNT(*) as c FROM staff').get().c === 0;
    const generatedCredentials = [];
    
    // Seed sites if empty
    const sitesCount = db.prepare('SELECT COUNT(*) as c FROM sites').get().c;
    if (sitesCount === 0 && Array.isArray(parsed.sites)) {
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
      if (guardsCount === 0 && Array.isArray(parsed.guards)) {
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
            lastSeen: g.lastSeen || new Date().toISOString(),
            lat: g.location?.lat || null,
            lng: g.location?.lng || null,
            locationHistory: g.locationHistory ? JSON.stringify(g.locationHistory) : '[]',
            clockedIn: g.clockedIn ? 1 : 0,
            clockInTime: g.clockInTime || null,
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
      }
      
      // Seed staff with generated passwords if empty  
      const staffCount = db.prepare('SELECT COUNT(*) as c FROM staff').get().c;
      if (staffCount === 0 && Array.isArray(parsed.staff)) {
        const insertStaff = db.prepare(`INSERT INTO staff (
          id, name, email, password, phone, employeeId, role, assignedArea, status, createdAt
        ) VALUES (
          @id, @name, @email, @password, @phone, @employeeId, @role, @assignedArea, @status, @createdAt
        )`);
        
        for (const s of parsed.staff) {
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
        logger.info({ count: parsed.staff.length }, 'Seeded staff with hashed passwords');
      }
      
      // Print generated credentials if this was initial seed
      if (isInitialSeed && generatedCredentials.length > 0) {
        logger.info('\n' + '='.repeat(60));
        logger.info('  🔐 INITIAL CREDENTIALS GENERATED');
        logger.info('='.repeat(60));
        generatedCredentials.forEach(cred => {
          printCredentialsBanner(cred.title, cred.email, cred.password);
        });
        logger.warn('⚠️  These credentials will NOT be shown again!');
        logger.warn('⚠️  Save them securely and change after first login.\n');
      }
  } catch (err) {
    logger.error({ err }, 'Failed to seed database');
  }
}
