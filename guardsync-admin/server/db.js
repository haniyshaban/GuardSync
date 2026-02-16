import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import logger from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, 'data', 'gw.db');

// Ensure data directory exists
fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });

const db = new Database(DB_PATH);

// Initialize all tables
db.prepare(`CREATE TABLE IF NOT EXISTS sites (
  id TEXT PRIMARY KEY,
  name TEXT,
  address TEXT,
  lat REAL,
  lng REAL,
  geofenceRadius INTEGER,
  geofenceType TEXT,
  geofencePolygon TEXT, -- DEPRECATED: Use site_geofence_points table instead
  assignedGuards TEXT, -- DEPRECATED: Use site_guards table instead
  isActive INTEGER,
  createdAt TEXT,
  patrolRoute TEXT -- DEPRECATED: Use site_patrol_points table instead
)`).run();

// ========================================
// NORMALIZED SITE RELATION TABLES
// ========================================

// Site-Guard Junction Table
db.prepare(`CREATE TABLE IF NOT EXISTS site_guards (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  guard_id TEXT NOT NULL,
  UNIQUE(site_id, guard_id),
  FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE,
  FOREIGN KEY (guard_id) REFERENCES guards(id) ON DELETE CASCADE
)`).run();

// Site Shifts Table
db.prepare(`CREATE TABLE IF NOT EXISTS site_shifts (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  label TEXT,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  days_of_week TEXT NOT NULL,
  FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
)`).run();

// Site Patrol Points Table
db.prepare(`CREATE TABLE IF NOT EXISTS site_patrol_points (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  name TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  radius_meters REAL DEFAULT 50,
  point_order INTEGER NOT NULL,
  FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
)`).run();

// Site Geofence Points Table
db.prepare(`CREATE TABLE IF NOT EXISTS site_geofence_points (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  point_order INTEGER NOT NULL,
  FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
)`).run();

// Guards table
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

// Leave requests table
db.prepare(`CREATE TABLE IF NOT EXISTS leave_requests (
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
  adminNotes TEXT,
  FOREIGN KEY (guardId) REFERENCES guards(id)
)`).run();

// Conveyance requests table
db.prepare(`CREATE TABLE IF NOT EXISTS conveyance_requests (
  id TEXT PRIMARY KEY,
  guardId TEXT NOT NULL,
  guardName TEXT,
  siteId TEXT,
  siteName TEXT,
  reason TEXT NOT NULL,
  estimatedDuration INTEGER,
  currentLat REAL,
  currentLng REAL,
  requestedAt TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  respondedAt TEXT,
  respondedBy TEXT,
  staffNotes TEXT,
  FOREIGN KEY (guardId) REFERENCES guards(id)
)`).run();

// Field reports table (for staff voice notes and video reports)
db.prepare(`CREATE TABLE IF NOT EXISTS field_reports (
  id TEXT PRIMARY KEY,
  staffId TEXT NOT NULL,
  staffName TEXT,
  reportType TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  mediaUrl TEXT,
  mediaType TEXT,
  siteId TEXT,
  siteName TEXT,
  lat REAL,
  lng REAL,
  createdAt TEXT NOT NULL,
  tags TEXT
)`).run();

// SOS alerts table
db.prepare(`CREATE TABLE IF NOT EXISTS sos_alerts (
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
  resolvedNotes TEXT,
  FOREIGN KEY (guardId) REFERENCES guards(id)
)`).run();

// Staff table for field officers
db.prepare(`CREATE TABLE IF NOT EXISTS staff (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  password TEXT,
  phone TEXT,
  employeeId TEXT,
  role TEXT DEFAULT 'field_officer',
  assignedArea TEXT,
  status TEXT DEFAULT 'offline',
  createdAt TEXT
)`).run();

// Staff attendance table
db.prepare(`CREATE TABLE IF NOT EXISTS staff_attendance (
  id TEXT PRIMARY KEY,
  staffId TEXT NOT NULL,
  clockInTime TEXT NOT NULL,
  clockOutTime TEXT,
  shiftType TEXT,
  lat REAL,
  lng REAL,
  date TEXT NOT NULL,
  FOREIGN KEY (staffId) REFERENCES staff(id)
)`).run();

// Guard attendance table (for tracking clock in/out of guards)
db.prepare(`CREATE TABLE IF NOT EXISTS guard_attendance (
  id TEXT PRIMARY KEY,
  guardId TEXT NOT NULL,
  siteId TEXT,
  clockIn TEXT NOT NULL,
  clockOut TEXT,
  withinGeofence INTEGER DEFAULT 1,
  lat REAL,
  lng REAL,
  date TEXT NOT NULL,
  FOREIGN KEY (guardId) REFERENCES guards(id)
)`).run();

// System configuration table
db.prepare(`CREATE TABLE IF NOT EXISTS system_config (
  id TEXT PRIMARY KEY DEFAULT 'main',
  usePremiumAPIs INTEGER DEFAULT 0,
  faceRecognition TEXT DEFAULT 'local',
  mapProvider TEXT DEFAULT 'openstreetmap',
  locationUpdateInterval INTEGER DEFAULT 30,
  geofenceStrictness TEXT DEFAULT 'medium',
  autoClockOut INTEGER DEFAULT 1,
  updatedAt TEXT
)`).run();

// Support tickets table
db.prepare(`CREATE TABLE IF NOT EXISTS support_tickets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'open',
  createdAt TEXT NOT NULL,
  resolvedAt TEXT,
  resolvedBy TEXT,
  response TEXT
)`).run();

// Guard notifications table
db.prepare(`CREATE TABLE IF NOT EXISTS guard_notifications (
  id TEXT PRIMARY KEY,
  guardId TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  isRead INTEGER DEFAULT 0,
  createdAt TEXT NOT NULL,
  FOREIGN KEY (guardId) REFERENCES guards(id)
)`).run();

// Guard schedules table
db.prepare(`CREATE TABLE IF NOT EXISTS guard_schedules (
  id TEXT PRIMARY KEY,
  guardId TEXT NOT NULL,
  siteId TEXT,
  siteName TEXT,
  date TEXT NOT NULL,
  startTime TEXT NOT NULL,
  endTime TEXT NOT NULL,
  isNightShift INTEGER DEFAULT 0,
  status TEXT DEFAULT 'scheduled',
  createdAt TEXT NOT NULL,
  FOREIGN KEY (guardId) REFERENCES guards(id)
)`).run();

// Patrol logs table
db.prepare(`CREATE TABLE IF NOT EXISTS patrol_logs (
  id TEXT PRIMARY KEY,
  guardId TEXT NOT NULL,
  siteId TEXT,
  patrolPointId TEXT NOT NULL,
  patrolPointName TEXT NOT NULL,
  shiftId TEXT,
  lat REAL,
  lng REAL,
  withinRadius INTEGER DEFAULT 1,
  distanceFromPoint REAL,
  timestamp TEXT NOT NULL,
  FOREIGN KEY (guardId) REFERENCES guards(id)
)`).run();

// Payroll table for guard salaries
db.prepare(`CREATE TABLE IF NOT EXISTS payroll (
  id TEXT PRIMARY KEY,
  guardId TEXT NOT NULL,
  guardName TEXT,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  totalDaysWorked INTEGER DEFAULT 0,
  dailyRate REAL DEFAULT 800,
  grossPay REAL DEFAULT 0,
  uniformDeduction REAL DEFAULT 0,
  pfDeduction REAL DEFAULT 0,
  otherDeductions REAL DEFAULT 0,
  netPay REAL DEFAULT 0,
  status TEXT DEFAULT 'pending',
  generatedAt TEXT,
  finalizedAt TEXT,
  paidAt TEXT,
  FOREIGN KEY (guardId) REFERENCES guards(id)
)`).run();

// ========================================
// CREATE INDEXES FOR QUERY OPTIMIZATION
// ========================================

// Site relation tables indexes
db.prepare('CREATE INDEX IF NOT EXISTS idx_site_guards_site_id ON site_guards(site_id)').run();
db.prepare('CREATE INDEX IF NOT EXISTS idx_site_guards_guard_id ON site_guards(guard_id)').run();
db.prepare('CREATE INDEX IF NOT EXISTS idx_site_shifts_site_id ON site_shifts(site_id)').run();
db.prepare('CREATE INDEX IF NOT EXISTS idx_site_patrol_points_site_id ON site_patrol_points(site_id)').run();
db.prepare('CREATE INDEX IF NOT EXISTS idx_site_patrol_points_order ON site_patrol_points(site_id, point_order)').run();
db.prepare('CREATE INDEX IF NOT EXISTS idx_site_geofence_points_site_id ON site_geofence_points(site_id)').run();
db.prepare('CREATE INDEX IF NOT EXISTS idx_site_geofence_points_order ON site_geofence_points(site_id, point_order)').run();

// Guards table indexes
db.prepare('CREATE INDEX IF NOT EXISTS idx_guards_site_id ON guards(siteId)').run();
db.prepare('CREATE INDEX IF NOT EXISTS idx_guards_status ON guards(status)').run();
db.prepare('CREATE INDEX IF NOT EXISTS idx_guards_employee_id ON guards(employeeId)').run();
db.prepare('CREATE INDEX IF NOT EXISTS idx_guards_email ON guards(email)').run();
db.prepare('CREATE INDEX IF NOT EXISTS idx_guards_phone ON guards(phone)').run();

// Guard Attendance table indexes
db.prepare('CREATE INDEX IF NOT EXISTS idx_guard_attendance_guard_id ON guard_attendance(guardId)').run();
db.prepare('CREATE INDEX IF NOT EXISTS idx_guard_attendance_site_id ON guard_attendance(siteId)').run();
db.prepare('CREATE INDEX IF NOT EXISTS idx_guard_attendance_date ON guard_attendance(date)').run();
db.prepare('CREATE INDEX IF NOT EXISTS idx_guard_attendance_guard_date ON guard_attendance(guardId, date)').run();

// Staff Attendance table indexes
db.prepare('CREATE INDEX IF NOT EXISTS idx_staff_attendance_staff_id ON staff_attendance(staffId)').run();
db.prepare('CREATE INDEX IF NOT EXISTS idx_staff_attendance_date ON staff_attendance(date)').run();

// Leave Requests table indexes
db.prepare('CREATE INDEX IF NOT EXISTS idx_leave_requests_guard_id ON leave_requests(guardId)').run();
db.prepare('CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status)').run();

// Conveyance Requests table indexes
db.prepare('CREATE INDEX IF NOT EXISTS idx_conveyance_guard_id ON conveyance_requests(guardId)').run();
db.prepare('CREATE INDEX IF NOT EXISTS idx_conveyance_status ON conveyance_requests(status)').run();

// SOS Alerts table indexes
db.prepare('CREATE INDEX IF NOT EXISTS idx_sos_alerts_guard_id ON sos_alerts(guardId)').run();
db.prepare('CREATE INDEX IF NOT EXISTS idx_sos_alerts_status ON sos_alerts(status)').run();

// Guard Schedules table indexes
db.prepare('CREATE INDEX IF NOT EXISTS idx_guard_schedules_guard_id ON guard_schedules(guardId)').run();
db.prepare('CREATE INDEX IF NOT EXISTS idx_guard_schedules_site_id ON guard_schedules(siteId)').run();

// Patrol Logs table indexes
db.prepare('CREATE INDEX IF NOT EXISTS idx_patrol_logs_guard_id ON patrol_logs(guardId)').run();
db.prepare('CREATE INDEX IF NOT EXISTS idx_patrol_logs_shift_id ON patrol_logs(shiftId)').run();
db.prepare('CREATE INDEX IF NOT EXISTS idx_patrol_logs_timestamp ON patrol_logs(timestamp)').run();

// Payroll table indexes
db.prepare('CREATE INDEX IF NOT EXISTS idx_payroll_guard_id ON payroll(guardId)').run();
db.prepare('CREATE INDEX IF NOT EXISTS idx_payroll_month_year ON payroll(month, year)').run();

// Guard Notifications table indexes
db.prepare('CREATE INDEX IF NOT EXISTS idx_notifications_guard_id ON guard_notifications(guardId)').run();
db.prepare('CREATE INDEX IF NOT EXISTS idx_notifications_read ON guard_notifications(isRead)').run();

// Support Tickets table indexes  
// Note: support_tickets doesn't have guardId - it has name and email for generic support
db.prepare('CREATE INDEX IF NOT EXISTS idx_tickets_status ON support_tickets(status)').run();

// Field Reports table indexes
db.prepare('CREATE INDEX IF NOT EXISTS idx_field_reports_staff_id ON field_reports(staffId)').run();

// Staff table indexes
db.prepare('CREATE INDEX IF NOT EXISTS idx_staff_email ON staff(email)').run();

// Insert default system config if not exists
const configExists = db.prepare('SELECT id FROM system_config WHERE id = ?').get('main');
if (!configExists) {
  db.prepare(`INSERT INTO system_config (id, usePremiumAPIs, faceRecognition, mapProvider, locationUpdateInterval, geofenceStrictness, autoClockOut, updatedAt) 
    VALUES ('main', 0, 'local', 'openstreetmap', 30, 'medium', 1, ?)`).run(new Date().toISOString());
}

// Migrations: Add columns if they don't exist (for existing DBs - backward compatibility)
try { db.prepare('ALTER TABLE guards ADD COLUMN email TEXT').run(); } catch (e) { /* column exists */ }
try { db.prepare('ALTER TABLE guards ADD COLUMN password TEXT').run(); } catch (e) { /* column exists */ }
try { db.prepare('ALTER TABLE guards ADD COLUMN address TEXT').run(); } catch (e) { /* column exists */ }
try { db.prepare('ALTER TABLE guards ADD COLUMN emergencyContact TEXT').run(); } catch (e) { /* column exists */ }
try { db.prepare('ALTER TABLE guards ADD COLUMN dateOfJoining TEXT').run(); } catch (e) { /* column exists */ }
try { db.prepare('ALTER TABLE guards ADD COLUMN dailyRate REAL').run(); } catch (e) { /* column exists */ }
try { db.prepare('ALTER TABLE guards ADD COLUMN aadharNumber TEXT').run(); } catch (e) { /* column exists */ }
try { db.prepare('ALTER TABLE guards ADD COLUMN panNumber TEXT').run(); } catch (e) { /* column exists */ }
try { db.prepare('ALTER TABLE guards ADD COLUMN bankAccountNumber TEXT').run(); } catch (e) { /* column exists */ }
try { db.prepare('ALTER TABLE guards ADD COLUMN bankIfsc TEXT').run(); } catch (e) { /* column exists */ }
try { db.prepare('ALTER TABLE guards ADD COLUMN bankName TEXT').run(); } catch (e) { /* column exists */ }
try { db.prepare('ALTER TABLE guards ADD COLUMN accountHolderName TEXT').run(); } catch (e) { /* column exists */ }
try { db.prepare('ALTER TABLE guards ADD COLUMN shiftType TEXT DEFAULT "day"').run(); } catch (e) { /* column exists */ }
try { db.prepare('ALTER TABLE guards ADD COLUMN shiftStartTime TEXT DEFAULT "08:00"').run(); } catch (e) { /* column exists */ }
try { db.prepare('ALTER TABLE guards ADD COLUMN shiftEndTime TEXT DEFAULT "20:00"').run(); } catch (e) { /* column exists */}
try { db.prepare('ALTER TABLE guards ADD COLUMN faceDescriptor TEXT').run(); } catch (e) { /* column exists */ }
try { db.prepare('ALTER TABLE guards ADD COLUMN photographUrl TEXT').run(); } catch (e) { /* column exists */ }
try { db.prepare('ALTER TABLE guards ADD COLUMN aadharDocUrl TEXT').run(); } catch (e) { /* column exists */ }
try { db.prepare('ALTER TABLE guards ADD COLUMN panDocUrl TEXT').run(); } catch (e) { /* column exists */ }
try { db.prepare('ALTER TABLE guards ADD COLUMN relievingLetterUrl TEXT').run(); } catch (e) { /* column exists */ }
try { db.prepare('ALTER TABLE sites ADD COLUMN patrolRoute TEXT').run(); } catch (e) { /* column exists */ }

// Helper functions for data transformation
export const siteRowToObj = (row) => {
  // Fetch related data from normalized tables
  const assignedGuards = db.prepare('SELECT guard_id FROM site_guards WHERE site_id = ? ORDER BY guard_id').all(row.id).map(r => r.guard_id);
  
  const patrolRoute = db.prepare('SELECT * FROM site_patrol_points WHERE site_id = ? ORDER BY point_order').all(row.id).map(p => ({
    id: p.id,
    name: p.name,
    latitude: p.latitude,
    longitude: p.longitude,
    radiusMeters: p.radius_meters,
    order: p.point_order
  }));
  
  const geofencePolygon = db.prepare('SELECT latitude, longitude FROM site_geofence_points WHERE site_id = ? ORDER BY point_order').all(row.id).map(p => ({
    lat: p.latitude,
    lng: p.longitude
  }));

  // Fallback to JSON columns if normalized tables are empty (for backwards compatibility during migration)
  const finalAssignedGuards = assignedGuards.length > 0 
    ? assignedGuards 
    : (row.assignedGuards ? JSON.parse(row.assignedGuards) : []);
  
  const finalPatrolRoute = patrolRoute.length > 0 
    ? patrolRoute 
    : (row.patrolRoute ? JSON.parse(row.patrolRoute) : null);
  
  const finalGeofencePolygon = geofencePolygon.length > 0 
    ? geofencePolygon 
    : (row.geofencePolygon ? JSON.parse(row.geofencePolygon) : undefined);

  return {
    id: row.id,
    name: row.name,
    address: row.address,
    location: { lat: row.lat, lng: row.lng },
    geofenceRadius: Number(row.geofenceRadius),
    geofenceType: row.geofenceType,
    geofencePolygon: finalGeofencePolygon,
    assignedGuards: finalAssignedGuards,
    isActive: !!row.isActive,
    createdAt: row.createdAt,
    patrolRoute: finalPatrolRoute,
  };
};

// ========================================
// SCHEMA VALIDATION
// ========================================

/**
 * Validates that the guards table has all expected columns
 * Logs warnings for any missing columns that should be present
 */
function validateGuardsSchema() {
  try {
    const tableInfo = db.prepare("PRAGMA table_info(guards)").all();
    
    const expectedColumns = [
      'id', 'name', 'phone', 'email', 'password', 'employeeId', 'siteId',
      'status', 'lastSeen', 'lat', 'lng', 'locationHistory',
      'clockedIn', 'clockInTime', 'currentShiftId',
      'address', 'emergencyContact', 'dateOfJoining', 'dailyRate',
      'aadharNumber', 'panNumber',
      'photographUrl', 'aadharDocUrl', 'panDocUrl', 'relievingLetterUrl',
      'bankAccountNumber', 'bankIfsc', 'bankName', 'accountHolderName',
      'shiftType', 'shiftStartTime', 'shiftEndTime',
      'faceDescriptor'
    ];
    
    const actualColumns = tableInfo.map(c => c.name);
    const missingColumns = expectedColumns.filter(c => !actualColumns.includes(c));
    
    if (missingColumns.length > 0) {
      logger.warn({ missingColumns }, 'Guards table is missing expected columns - consider running migrations');
    } else {
      logger.info('Guards table schema validation passed');
    }
    
    // Check for extra columns that might indicate schema drift
    const extraColumns = actualColumns.filter(c => !expectedColumns.includes(c));
    if (extraColumns.length > 0) {
      logger.warn({ extraColumns }, 'Guards table has additional columns not in expected schema');
    }
  } catch (error) {
    logger.error({ error: error.message }, 'Error validating guards schema');
  }
}

// Run schema validation on startup
validateGuardsSchema();

export default db;
