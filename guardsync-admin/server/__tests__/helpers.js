import Database from 'better-sqlite3';
import { hashPassword } from '../auth.js';
import { encrypt } from '../encryption.js';
import path from 'path';
import fs from 'fs';

// Create a test database in memory
export function createTestDb() {
  const db = new Database(':memory:');
  
  // Run the schema creation
  const schemaPath = path.join(process.cwd(), 'server', 'db.js');
  
  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS sites (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      geofenceRadius INTEGER DEFAULT 0,
      geofenceType TEXT DEFAULT 'radius',
      geofencePolygon TEXT,
      assignedGuards TEXT DEFAULT '[]',
      isActive INTEGER DEFAULT 1,
      createdAt TEXT NOT NULL,
      patrolRoute TEXT
    );

    CREATE TABLE IF NOT EXISTS guards (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT,
      employeeId TEXT UNIQUE NOT NULL,
      siteId TEXT,
      status TEXT DEFAULT 'pending',
      lastSeen TEXT,
      lat REAL,
      lng REAL,
      locationHistory TEXT DEFAULT '[]',
      clockedIn INTEGER DEFAULT 0,
      clockInTime TEXT,
      currentShiftId TEXT,
      address TEXT,
      emergencyContact TEXT,
      dateOfJoining TEXT,
      dailyRate INTEGER DEFAULT 750,
      aadharNumber TEXT,
      panNumber TEXT,
      photographUrl TEXT,
      aadharDocUrl TEXT,
      panDocUrl TEXT,
      relievingLetterUrl TEXT,
      bankAccountNumber TEXT,
      bankIfsc TEXT,
      bankName TEXT,
      accountHolderName TEXT,
      shiftType TEXT DEFAULT 'day',
      shiftStartTime TEXT DEFAULT '08:00',
      shiftEndTime TEXT DEFAULT '20:00',
      faceDescriptor TEXT,
      FOREIGN KEY (siteId) REFERENCES sites(id)
    );

    CREATE TABLE IF NOT EXISTS staff (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      isActive INTEGER DEFAULT 1,
      status TEXT DEFAULT 'offline',
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id TEXT PRIMARY KEY,
      guardId TEXT NOT NULL,
      siteId TEXT NOT NULL,
      date TEXT NOT NULL,
      clockIn TEXT NOT NULL,
      clockOut TEXT,
      lat REAL,
      lng REAL,
      withinGeofence INTEGER DEFAULT 0,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (guardId) REFERENCES guards(id),
      FOREIGN KEY (siteId) REFERENCES sites(id)
    );

    CREATE TABLE IF NOT EXISTS schedules (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      siteId TEXT NOT NULL,
      guardId TEXT NOT NULL,
      startTime TEXT NOT NULL,
      endTime TEXT NOT NULL,
      date TEXT NOT NULL,
      shiftType TEXT DEFAULT 'day',
      notes TEXT,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (siteId) REFERENCES sites(id),
      FOREIGN KEY (guardId) REFERENCES guards(id)
    );

    -- The tables below match db.js; routes that use the real repositories need them
    CREATE TABLE IF NOT EXISTS site_guards (
      id TEXT PRIMARY KEY,
      site_id TEXT NOT NULL,
      guard_id TEXT NOT NULL,
      UNIQUE(site_id, guard_id),
      FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE,
      FOREIGN KEY (guard_id) REFERENCES guards(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS site_patrol_points (
      id TEXT PRIMARY KEY,
      site_id TEXT NOT NULL,
      name TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      radius_meters REAL DEFAULT 50,
      point_order INTEGER NOT NULL,
      FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS site_shifts (
      id TEXT PRIMARY KEY,
      site_id TEXT NOT NULL,
      label TEXT,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      days_of_week TEXT NOT NULL,
      FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS site_geofence_points (
      id TEXT PRIMARY KEY,
      site_id TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      point_order INTEGER NOT NULL,
      FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS guard_attendance (
      id TEXT PRIMARY KEY,
      guardId TEXT NOT NULL,
      siteId TEXT,
      clockIn TEXT NOT NULL,
      clockOut TEXT,
      withinGeofence INTEGER DEFAULT 1,
      lat REAL,
      lng REAL,
      date TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS guard_notifications (
      id TEXT PRIMARY KEY,
      guardId TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      isRead INTEGER DEFAULT 0,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sos_alerts (
      id TEXT PRIMARY KEY,
      guardId TEXT NOT NULL,
      guardName TEXT,
      siteId TEXT,
      siteName TEXT,
      lat REAL,
      lng REAL,
      message TEXT,
      status TEXT DEFAULT 'active',
      createdAt TEXT NOT NULL,
      resolvedAt TEXT,
      resolvedBy TEXT,
      resolvedNotes TEXT
    );

    CREATE TABLE IF NOT EXISTS leave_requests (
      id TEXT PRIMARY KEY,
      guardId TEXT NOT NULL,
      startDate TEXT NOT NULL,
      endDate TEXT NOT NULL,
      reason TEXT,
      leaveType TEXT DEFAULT 'casual',
      status TEXT DEFAULT 'pending',
      appliedAt TEXT,
      reviewedAt TEXT,
      reviewedBy TEXT,
      adminNotes TEXT
    );

    CREATE TABLE IF NOT EXISTS system_config (
      id TEXT PRIMARY KEY DEFAULT 'main',
      usePremiumAPIs INTEGER DEFAULT 0,
      faceRecognition TEXT DEFAULT 'local',
      mapProvider TEXT DEFAULT 'openstreetmap',
      locationUpdateInterval INTEGER DEFAULT 30,
      geofenceStrictness TEXT DEFAULT 'medium',
      autoClockOut INTEGER DEFAULT 1,
      updatedAt TEXT
    );
    INSERT INTO system_config (id) VALUES ('main');
  `);

  return db;
}

// Seed test data
export async function seedTestData(db) {
  const now = new Date().toISOString();
  const date = now.split('T')[0];

  // Create test site
  const siteId = 'test-site-1';
  db.prepare(`INSERT INTO sites (id, name, address, lat, lng, geofenceRadius, createdAt, isActive)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    siteId,
    'Test Site',
    '123 Test Street',
    40.7128,
    -74.0060,
    100,
    now,
    1
  );

  // Create test guard with encrypted PII
  const guardId = 'test-guard-1';
  const guardPassword = await hashPassword('password123');
  const encryptedAddress = encrypt('123 Guard Street');
  const encryptedEmergency = encrypt('+91-9876543210');
  const encryptedAadhar = encrypt('123456789012');
  const encryptedPan = encrypt('ABCDE1234F');
  
  db.prepare(`INSERT INTO guards (
    id, name, phone, email, password, employeeId, siteId, status,
    lastSeen, address, emergencyContact, dateOfJoining, dailyRate,
    aadharNumber, panNumber, clockedIn
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    guardId,
    'Test Guard',
    '+91-1234567890',
    'guard@test.com',
    guardPassword,
    'GW-2026-0001',
    siteId,
    'active',
    now,
    encryptedAddress,
    encryptedEmergency,
    date,
    750,
    encryptedAadhar,
    encryptedPan,
    0
  );

  // Create test staff/admin
  const staffId = 'test-staff-1';
  const staffPassword = await hashPassword('admin123');
  db.prepare(`INSERT INTO staff (id, name, email, phone, password, role, isActive, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    staffId,
    'Test Admin',
    'admin@test.com',
    '+91-9999999999',
    staffPassword,
    'admin',
    1,
    now
  );

  return {
    siteId,
    guardId,
    staffId,
    guardEmail: 'guard@test.com',
    guardPassword: 'password123',
    adminEmail: 'admin@test.com',
    adminPassword: 'admin123',
  };
}

// Clean up test database
export function cleanupTestDb(db) {
  if (db) {
    db.close();
  }
}
