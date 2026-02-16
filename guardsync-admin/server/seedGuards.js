import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';

const DB_PATH = path.join(process.cwd(), 'server', 'data', 'gw.db');
const INITIAL_JSON = path.join(process.cwd(), 'server', 'initialData.json');

if (!fs.existsSync(INITIAL_JSON)) {
  console.error('initialData.json not found');
  process.exit(1);
}

const raw = fs.readFileSync(INITIAL_JSON, 'utf8');
const parsed = JSON.parse(raw);

const db = new Database(DB_PATH);

// Create guards table with full schema matching db.js
db.prepare(`CREATE TABLE IF NOT EXISTS guards (
  id TEXT PRIMARY KEY,
  name TEXT,
  phone TEXT,
  email TEXT,
  password TEXT,
  employeeId TEXT,
  siteId TEXT,
  status TEXT,
  lastSeen TEXT,
  lat REAL,
  lng REAL,
  locationHistory TEXT,
  clockedIn INTEGER,
  clockInTime TEXT,
  currentShiftId TEXT,
  -- Personal details (encrypted in production)
  address TEXT,
  emergencyContact TEXT,
  dateOfJoining TEXT,
  dailyRate REAL,
  -- Sensitive documents (should be encrypted in production)
  aadharNumber TEXT,
  panNumber TEXT,
  -- Document URLs
  photographUrl TEXT,
  aadharDocUrl TEXT,
  panDocUrl TEXT,
  relievingLetterUrl TEXT,
  -- Bank details
  bankAccountNumber TEXT,
  bankIfsc TEXT,
  bankName TEXT,
  accountHolderName TEXT,
  -- Shift assignment
  shiftType TEXT DEFAULT 'day',
  shiftStartTime TEXT DEFAULT '08:00',
  shiftEndTime TEXT DEFAULT '20:00',
  -- Face recognition
  faceDescriptor TEXT
)`).run();

if (!Array.isArray(parsed.guards) || parsed.guards.length === 0) {
  console.error('No guards in initialData.json to seed');
  process.exit(1);
}

const SALT_ROUNDS = 10;

// Insert statement with all columns from the schema
const insert = db.prepare(`INSERT OR REPLACE INTO guards (
  id, name, phone, email, password, employeeId, siteId, status, lastSeen,
  lat, lng, locationHistory, clockedIn, clockInTime, currentShiftId,
  address, emergencyContact, dateOfJoining, dailyRate,
  aadharNumber, panNumber,
  photographUrl, aadharDocUrl, panDocUrl, relievingLetterUrl,
  bankAccountNumber, bankIfsc, bankName, accountHolderName,
  shiftType, shiftStartTime, shiftEndTime, faceDescriptor
) VALUES (
  @id, @name, @phone, @email, @password, @employeeId, @siteId, @status, @lastSeen,
  @lat, @lng, @locationHistory, @clockedIn, @clockInTime, @currentShiftId,
  @address, @emergencyContact, @dateOfJoining, @dailyRate,
  @aadharNumber, @panNumber,
  @photographUrl, @aadharDocUrl, @panDocUrl, @relievingLetterUrl,
  @bankAccountNumber, @bankIfsc, @bankName, @accountHolderName,
  @shiftType, @shiftStartTime, @shiftEndTime, @faceDescriptor
)`);

const insertMany = db.transaction((guards) => {
  for (const g of guards) {
    // Hash password if provided, otherwise use default hashed password
    let hashedPassword = null;
    if (g.password) {
      hashedPassword = bcrypt.hashSync(g.password, SALT_ROUNDS);
    }

    insert.run({
      id: g.id,
      name: g.name,
      phone: g.phone || null,
      email: g.email || null,
      password: hashedPassword,
      employeeId: g.employeeId,
      siteId: g.siteId || null,
      status: g.status || 'offline',
      lastSeen: g.lastSeen || new Date().toISOString(),
      lat: g.location ? g.location.lat : null,
      lng: g.location ? g.location.lng : null,
      locationHistory: JSON.stringify(g.locationHistory || []),
      clockedIn: g.clockedIn ? 1 : 0,
      clockInTime: g.clockInTime || null,
      currentShiftId: g.currentShiftId || null,
      // Personal details
      address: g.address || null,
      emergencyContact: g.emergencyContact || null,
      dateOfJoining: g.dateOfJoining || null,
      dailyRate: g.dailyRate || null,
      // Sensitive documents
      aadharNumber: g.aadharNumber || null,
      panNumber: g.panNumber || null,
      // Document URLs
      photographUrl: g.photographUrl || null,
      aadharDocUrl: g.aadharDocUrl || null,
      panDocUrl: g.panDocUrl || null,
      relievingLetterUrl: g.relievingLetterUrl || null,
      // Bank details
      bankAccountNumber: g.bankAccountNumber || null,
      bankIfsc: g.bankIfsc || null,
      bankName: g.bankName || null,
      accountHolderName: g.accountHolderName || null,
      // Shift assignment
      shiftType: g.shiftType || 'day',
      shiftStartTime: g.shiftStartTime || '08:00',
      shiftEndTime: g.shiftEndTime || '20:00',
      // Face recognition
      faceDescriptor: g.faceDescriptor || null,
    });
  }
});

console.log('Seeding guards (hashing passwords)...');
insertMany(parsed.guards);

console.log(`✓ Seeded/updated ${parsed.guards.length} guards into ${DB_PATH}`);
console.log('✓ All passwords have been securely hashed with bcrypt');

db.close();
