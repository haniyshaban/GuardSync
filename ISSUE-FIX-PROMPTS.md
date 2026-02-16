# GuardSync — AI Agent Fix Prompts & Validation Guide

> Each section below contains:
> 1. **Fix Prompt** — copy-paste this into an AI agent to implement the fix
> 2. **Validation Prompt** — copy-paste this to verify the fix was applied correctly
> 3. **Manual Test Steps** — how to test it yourself in the running apps

---

## Issue #1 — Monolith Server File (CRITICAL)

### Fix Prompt

```
TASK: Refactor the monolith `guardsync-admin/server/index.js` (2300+ lines) into a modular Express project structure.

CURRENT STATE:
- `guardsync-admin/server/index.js` contains ALL route handlers, ALL table creation DDL, ALL middleware, and ALL seeding logic in a single file.
- Tables: sites, guards, leave_requests, conveyance_requests, field_reports, sos_alerts, staff, staff_attendance, guard_attendance, system_config, support_tickets, guard_notifications, guard_schedules, patrol_logs, payroll.
- Auth helpers are already extracted to `server/auth.js` and validation to `server/validate.js`.

TARGET STRUCTURE:
```
server/
  index.js              ← app bootstrap only (~50 lines): imports, middleware, mount routers, listen
  db.js                 ← SQLite connection + all CREATE TABLE / ALTER TABLE / migrations
  seed.js               ← seeding logic (reads initialData.json, populates tables)
  middleware/
    upload.js           ← multer config
    rateLimiter.js      ← rate limiter configs (authLimiter, uploadLimiter)
    errorHandler.js     ← global error handler + consistent error shape
  routes/
    auth.routes.js      ← /api/auth/* (guard login, face-login)
    guards.routes.js    ← /api/guards/* (CRUD, enroll, approve, reject, location, profile)
    sites.routes.js     ← /api/sites/*
    attendance.routes.js← /api/attendance/* (clock-in, clock-out, logs) — REMOVE the duplicate GET /api/attendance route
    leave.routes.js     ← /api/leave/*
    conveyance.routes.js← /api/conveyance/*
    reports.routes.js   ← /api/reports/*
    sos.routes.js       ← /api/sos/*
    staff.routes.js     ← /api/staff/* (login, attendance, CRUD)
    schedule.routes.js  ← /api/schedules/*
    patrol.routes.js    ← /api/patrol/*
    payroll.routes.js   ← /api/payroll/*
    notifications.routes.js ← /api/notifications/*
    tickets.routes.js   ← /api/tickets/*
    config.routes.js    ← /api/config/*
    uploads.routes.js   ← /uploads/:filename (file serving)
```

RULES:
1. Each route file exports an Express Router.
2. `db.js` exports the `db` instance so route files can import it.
3. Do NOT change any API endpoint paths or request/response shapes — this must be a pure refactor.
4. The duplicate `GET /api/attendance` route (currently at ~line 1591 and ~line 2340 in index.js) must be consolidated into ONE handler in attendance.routes.js.
5. Keep all existing middleware (helmet, cors, express.json, rate limiters) — just organize them.
6. Preserve the ALTER TABLE migration logic in db.js so existing databases still work.
7. Keep the file upload serving route behind the same auth check.
8. After refactoring, `index.js` should be ≤80 lines.
```

### Validation Prompt

```
TASK: Validate the server refactor of guardsync-admin/server/.

CHECK ALL OF THE FOLLOWING:
1. `server/index.js` is ≤80 lines and only bootstraps the app (no route handlers in it).
2. `server/db.js` exists and exports a `db` instance. All CREATE TABLE and ALTER TABLE statements are here.
3. Each file in `server/routes/` exports an Express Router.
4. Every API endpoint that existed before still exists (search for all `app.get`, `app.post`, `app.put`, `app.delete` in the old file and confirm each has a corresponding `router.*` in the new files).
5. There is NO duplicate `GET /api/attendance` handler.
6. `server/middleware/` contains upload.js, rateLimiter.js, and errorHandler.js.
7. No circular imports exist between modules.
8. The seed logic is in its own file and is called from index.js at startup.
9. Run `node server/index.js` and confirm it starts without errors on port 4000.
10. List every endpoint path and HTTP method from the old file vs the new structure and flag any missing ones.
```

### Manual Test Steps

1. Run `docker-compose up --build -d` and check the `api` container starts cleanly.
2. Open `http://localhost:4000/api/sites` — should return sites JSON.
3. Hit `POST /api/auth/login` with valid credentials — should return a JWT.
4. Verify all 3 frontends (admin :8080, staff :8081, guard :8082) still function normally.
5. Check the Docker logs: `docker logs guardsync-api` — no crash/restart loops.

---

## Issue #2 — Unauthenticated API Routes (CRITICAL)

### Fix Prompt

```
TASK: Add JWT authentication to ALL API routes in guardsync-admin/server that currently lack it.

CURRENT STATE:
- `server/auth.js` exports `authMiddleware(required, roles)` which checks `Authorization: Bearer <token>` headers.
- Auth routes (`/api/auth/login`, `/api/auth/face-login`, `/api/staff/login`) correctly skip auth.
- Almost ALL other routes (guards CRUD, sites CRUD, attendance, leave, conveyance, SOS, payroll, schedules, patrol, notifications, tickets, config, reports) have NO auth middleware applied.
- The guard-app and staff-app `ApiService` classes do NOT attach auth tokens to requests.

CHANGES NEEDED:

### Backend (guardsync-admin/server):
1. Apply `authMiddleware()` to ALL route groups EXCEPT:
   - `POST /api/auth/login`
   - `POST /api/auth/face-login`
   - `POST /api/staff/login`
   - `POST /api/guards/enroll` (public enrollment)
   - `GET /api/config` (public config read)
2. For admin-only routes (DELETE guards, manage payroll, system config PUT), use `authMiddleware(true, ['admin'])`.
3. For staff routes, use `authMiddleware(true, ['staff', 'admin'])`.
4. For guard routes, use `authMiddleware(true, ['guard', 'admin'])`.
5. Ensure login endpoints return the JWT token AND user role in the response so clients can store and use it:
   ```json
   { "token": "eyJ...", "role": "guard", "user": { ... } }
   ```
6. Make sure the `signToken` payload includes `{ id, role }` at minimum.

### Frontend — Guard App (guardsync-guard-app/src/services/api.ts):
1. Add a `setToken(token: string)` method to `ApiService` that stores the JWT.
2. Modify the `request()` method to automatically attach `Authorization: Bearer <token>` headers when a token is set.
3. Add a `clearToken()` method for logout.
4. After successful login in the app, call `api.setToken(response.data.token)`.
5. Store the token in localStorage for persistence across refreshes.

### Frontend — Staff App (guardsync-staff-app/src/services/api.ts):
1. Apply the exact same token management changes as the guard app.
2. After `staffLogin()` succeeds, store the token.

### Frontend — Admin App (guardsync-admin/src):
1. If the admin app makes API calls, ensure they also attach auth tokens.
2. Check all pages that call the API and ensure the token is included.

DO NOT change any endpoint paths or response data shapes beyond adding the `token` field to login responses.
```

### Validation Prompt

```
TASK: Verify that all API routes now require authentication.

1. List every route in the server. For each one, confirm whether authMiddleware is applied.
2. The ONLY routes that should NOT have auth: POST /api/auth/login, POST /api/auth/face-login, POST /api/staff/login, POST /api/guards/enroll, GET /api/config.
3. Verify login responses include a `token` field.
4. In guard-app api.ts: confirm `setToken()`, `clearToken()` exist and that `request()` attaches Bearer header.
5. In staff-app api.ts: confirm the same token management.
6. Test with curl:
   - `curl http://localhost:4000/api/guards` → should return 401
   - `curl -X POST http://localhost:4000/api/auth/login -H "Content-Type: application/json" -d '{"email":"...","password":"..."}'` → should return token
   - `curl http://localhost:4000/api/guards -H "Authorization: Bearer <token>"` → should return data
```

### Manual Test Steps

1. Without logging in, try accessing `http://localhost:4000/api/guards` → should get `401 Unauthorized`.
2. Log in via the guard app → should succeed and subsequent API calls should work.
3. Log in via the staff app → should succeed.
4. Try accessing a guard-only endpoint with a staff token → should get `403 Forbidden` (if role-restricted).
5. Clear localStorage/token and refresh → should redirect to login.

---

## Issue #3 — Plaintext PII Storage (CRITICAL)

### Fix Prompt

```
TASK: Encrypt all Personally Identifiable Information (PII) stored in the SQLite database.

CURRENT STATE:
- The `guards` table stores sensitive data in plaintext: `aadhar_number`, `pan_number`, `bank_account_number`, `bank_ifsc`, `bank_name`, `bank_account_holder`, `address`, `emergency_contact`, `email`, `phone`.
- The `staff` table stores `email` and `phone` in plaintext.
- Passwords are hashed with bcrypt (this is fine, keep it).

CHANGES NEEDED:

1. Install `crypto` (built-in Node.js) — use AES-256-GCM for field-level encryption.

2. Create `server/encryption.js` exporting:
   - `encrypt(plaintext)` → returns `iv:authTag:ciphertext` (base64)
   - `decrypt(encryptedString)` → returns plaintext
   - Uses `ENCRYPTION_KEY` from `process.env.ENCRYPTION_KEY` (must be 32 bytes / 64 hex chars)
   - Throws a clear error at startup if `ENCRYPTION_KEY` is not set in production (`NODE_ENV=production`)
   - In development, falls back to a hardcoded dev key with a console warning

3. Encrypt on WRITE — in every INSERT/UPDATE that touches these fields:
   - Guards: `aadhar_number`, `pan_number`, `bank_account_number`, `bank_ifsc`, `bank_name`, `bank_account_holder`, `address`, `emergency_contact`
   - Staff: (keep as-is for now since email is used for login lookup — but add a NOTE comment)

4. Decrypt on READ — in every SELECT that returns these fields, decrypt before sending to the client.

5. Create a ONE-TIME migration script `server/migrate-encrypt-pii.js` that:
   - Reads all existing guards rows
   - Encrypts the PII fields
   - Updates the rows
   - Prints progress
   - Is idempotent (skips already-encrypted values by checking for the `iv:authTag:ciphertext` format)

6. Add `ENCRYPTION_KEY` to:
   - `docker-compose.yml` as an environment variable for the `api` service (use a generated key for dev)
   - `.env.example` with a placeholder

7. Do NOT encrypt `name` or `employeeId` (needed for display/search).
8. Do NOT encrypt `phone` in guards table (needed for login lookup). Add a code comment explaining why.
9. Keep `email` in staff unencrypted (needed for login lookup). Add a code comment explaining why.

IMPORTANT: Aadhar numbers are protected under India's Aadhaar Act — this is a legal compliance requirement.
```

### Validation Prompt

```
TASK: Verify PII encryption is implemented correctly.

1. Check `server/encryption.js` exists with `encrypt()` and `decrypt()` functions using AES-256-GCM.
2. Verify `ENCRYPTION_KEY` env var is required in production mode.
3. In the guard enrollment route, confirm `aadhar_number`, `pan_number`, `bank_account_number` etc. are encrypted before INSERT.
4. In guard GET routes, confirm these fields are decrypted before being sent in the response.
5. Check `server/migrate-encrypt-pii.js` exists and is idempotent.
6. Check `docker-compose.yml` has `ENCRYPTION_KEY` in the api service environment.
7. Read the raw SQLite database and confirm PII fields contain encrypted strings (format: `base64:base64:base64`), not plaintext.
8. Call `GET /api/guards/:id` via API and confirm the response contains readable (decrypted) values.
```

### Manual Test Steps

1. Enroll a new guard with an Aadhar number through the guard app.
2. Open the SQLite database directly: `sqlite3 server/data/gw.db "SELECT aadhar_number FROM guards LIMIT 1;"` — should show encrypted gibberish, NOT a readable number.
3. Call `GET /api/guards/:id` — should show the readable Aadhar number in the JSON response.
4. Run the migration script on existing data: `node server/migrate-encrypt-pii.js` — should encrypt existing plaintext records.

---

## Issue #4 — Hardcoded JWT Secret (CRITICAL)

### Fix Prompt

```
TASK: Remove the hardcoded JWT secret and require it via environment variable.

CURRENT STATE:
- `guardsync-admin/server/auth.js` line 4: `const JWT_SECRET = process.env.JWT_SECRET || 'dev-insecure-secret-change-me';`
- This fallback means production deployments that forget to set the env var silently use an insecure, publicly known secret.

CHANGES:
1. In `server/auth.js`:
   - In production (`NODE_ENV === 'production'`): require `JWT_SECRET` env var, throw an error at import time if missing.
   - In development: keep the fallback but log a warning: `⚠️  Using insecure default JWT secret. Set JWT_SECRET env var for production.`
   - Generate a cryptographically random fallback for dev instead of a string literal:
     ```js
     const DEV_SECRET = require('crypto').randomBytes(64).toString('hex');
     ```
     Note: this means dev tokens expire on server restart, which is acceptable for dev.

2. In `docker-compose.yml`:
   - Add `JWT_SECRET` as an environment variable for the `api` service.
   - Use a strong random value (generate one with `openssl rand -hex 64`).

3. Create or update `.env.example` at the project root with:
   ```
   JWT_SECRET=<generate-with-openssl-rand-hex-64>
   ENCRYPTION_KEY=<generate-64-hex-chars>
   NODE_ENV=development
   ```

4. Add `.env` to `.gitignore` if not already there.
```

### Validation Prompt

```
TASK: Verify the hardcoded JWT secret is removed.

1. In `server/auth.js`, confirm there is NO hardcoded string fallback like `'dev-insecure-secret-change-me'` or similar.
2. Confirm that if `NODE_ENV=production` and `JWT_SECRET` is not set, the server throws an error at startup.
3. Confirm `docker-compose.yml` sets `JWT_SECRET` for the api service.
4. Confirm `.env.example` exists with placeholder values.
5. Confirm `.env` is in `.gitignore`.
6. Start the server with `NODE_ENV=production` and without `JWT_SECRET` — it should crash with a clear error.
7. Start the server with `NODE_ENV=development` and without `JWT_SECRET` — it should start with a warning.
```

### Manual Test Steps

1. Remove `JWT_SECRET` from your env and set `NODE_ENV=production`. Start the server → should crash.
2. Set `NODE_ENV=development`, remove `JWT_SECRET`. Start the server → should start with a warning.
3. Set both `NODE_ENV=production` and a proper `JWT_SECRET`. Start → should work normally.
4. Login, get a token, use it → should work.

---

## Issue #5 — No Database Indexes (HIGH)

### Fix Prompt

```
TASK: Add database indexes to all SQLite tables for common query patterns.

CURRENT STATE:
- The SQLite database in `guardsync-admin/server/` has 15+ tables with NO indexes beyond the implicit rowid/primary key.
- As data grows, queries filtering by guardId, siteId, staffId, date ranges, and status will degrade significantly.

ADD THESE INDEXES (in db.js or wherever table creation happens):

```sql
-- Guards
CREATE INDEX IF NOT EXISTS idx_guards_site_id ON guards(site_id);
CREATE INDEX IF NOT EXISTS idx_guards_status ON guards(status);
CREATE INDEX IF NOT EXISTS idx_guards_employee_id ON guards(employee_id);
CREATE INDEX IF NOT EXISTS idx_guards_email ON guards(email);
CREATE INDEX IF NOT EXISTS idx_guards_phone ON guards(phone);

-- Guard Attendance
CREATE INDEX IF NOT EXISTS idx_guard_attendance_guard_id ON guard_attendance(guard_id);
CREATE INDEX IF NOT EXISTS idx_guard_attendance_site_id ON guard_attendance(site_id);
CREATE INDEX IF NOT EXISTS idx_guard_attendance_date ON guard_attendance(date);
CREATE INDEX IF NOT EXISTS idx_guard_attendance_guard_date ON guard_attendance(guard_id, date);

-- Staff Attendance
CREATE INDEX IF NOT EXISTS idx_staff_attendance_staff_id ON staff_attendance(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_date ON staff_attendance(date);

-- Leave Requests
CREATE INDEX IF NOT EXISTS idx_leave_requests_guard_id ON leave_requests(guard_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);

-- Conveyance Requests
CREATE INDEX IF NOT EXISTS idx_conveyance_guard_id ON conveyance_requests(guard_id);
CREATE INDEX IF NOT EXISTS idx_conveyance_status ON conveyance_requests(status);

-- SOS Alerts
CREATE INDEX IF NOT EXISTS idx_sos_alerts_guard_id ON sos_alerts(guard_id);
CREATE INDEX IF NOT EXISTS idx_sos_alerts_status ON sos_alerts(status);

-- Guard Schedules
CREATE INDEX IF NOT EXISTS idx_guard_schedules_guard_id ON guard_schedules(guard_id);
CREATE INDEX IF NOT EXISTS idx_guard_schedules_site_id ON guard_schedules(site_id);

-- Patrol Logs
CREATE INDEX IF NOT EXISTS idx_patrol_logs_guard_id ON patrol_logs(guard_id);
CREATE INDEX IF NOT EXISTS idx_patrol_logs_shift_id ON patrol_logs(shift_id);
CREATE INDEX IF NOT EXISTS idx_patrol_logs_timestamp ON patrol_logs(timestamp);

-- Payroll
CREATE INDEX IF NOT EXISTS idx_payroll_guard_id ON payroll(guard_id);
CREATE INDEX IF NOT EXISTS idx_payroll_month_year ON payroll(month, year);

-- Notifications
CREATE INDEX IF NOT EXISTS idx_notifications_guard_id ON guard_notifications(guard_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON guard_notifications(is_read);

-- Support Tickets
CREATE INDEX IF NOT EXISTS idx_tickets_guard_id ON support_tickets(guard_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON support_tickets(status);

-- Field Reports
CREATE INDEX IF NOT EXISTS idx_field_reports_staff_id ON field_reports(staff_id);

-- Staff
CREATE INDEX IF NOT EXISTS idx_staff_email ON staff(email);
```

Place all `CREATE INDEX IF NOT EXISTS` statements right after the table creation statements. Using `IF NOT EXISTS` makes them safe to run on existing databases.
```

### Validation Prompt

```
TASK: Verify all database indexes were created.

1. Search the server code for all CREATE INDEX statements. List them.
2. Confirm each table has appropriate indexes on foreign keys and common filter columns.
3. Connect to the SQLite database and run: `.indexes` — it should list all the new indexes.
4. Run `EXPLAIN QUERY PLAN SELECT * FROM guard_attendance WHERE guard_id = 'test'` — should show "USING INDEX idx_guard_attendance_guard_id".
5. Confirm all indexes use `IF NOT EXISTS` for idempotency.
```

### Manual Test Steps

1. Restart the API container: `docker-compose restart api`.
2. Enter the container: `docker exec -it guardsync-api sh`.
3. Run `sqlite3 /app/server/data/gw.db ".indexes"` — should show all new indexes.
4. Run a query plan check: `sqlite3 /app/server/data/gw.db "EXPLAIN QUERY PLAN SELECT * FROM guards WHERE site_id = 'test';"` — should show index usage.

---

## Issue #6 — JSON Arrays in SQL Columns (HIGH)

### Fix Prompt

```
TASK: Normalize JSON array columns in SQLite tables into proper relational tables.

CURRENT STATE:
- The `sites` table stores `assigned_guards` as a JSON array string (e.g., `'["guard1","guard2"]'`).
- The `sites` table stores `shifts` as a JSON array string.
- The `sites` table stores `patrol_route` as a JSON array string.
- The `sites` table may store `geofence_polygon` as a JSON array string.
- These are queried/filtered by parsing JSON in JavaScript, which prevents SQL-level querying and breaks referential integrity.

CHANGES:

1. Create new junction/child tables:

```sql
CREATE TABLE IF NOT EXISTS site_guards (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  guard_id TEXT NOT NULL REFERENCES guards(id) ON DELETE CASCADE,
  UNIQUE(site_id, guard_id)
);

CREATE TABLE IF NOT EXISTS site_shifts (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  label TEXT,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  days_of_week TEXT NOT NULL  -- keep as JSON array of ints since it's a fixed small set
);

CREATE TABLE IF NOT EXISTS site_patrol_points (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  radius_meters REAL DEFAULT 50,
  point_order INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS site_geofence_points (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  point_order INTEGER NOT NULL
);
```

2. Create indexes on foreign keys for these new tables.

3. Write a migration script `server/migrate-normalize-json.js` that:
   - Reads all sites
   - Parses their JSON columns
   - Inserts rows into the new junction tables
   - Is idempotent (checks if migration already ran)

4. Update ALL route handlers that:
   - READ sites: JOIN with the new tables and assemble the response object
   - CREATE sites: Insert into the new tables instead of storing JSON
   - UPDATE sites: Update the new tables
   - DELETE sites: Cascade deletes handle child rows

5. Update guard assignment/unassignment to use `site_guards` table instead of modifying a JSON array.

6. Keep the old JSON columns in the `sites` table for now (don't drop them) to avoid breaking anything during transition. Add a comment marking them as deprecated.

7. Do NOT change the API response format — the frontend should receive the same shaped objects.
```

### Validation Prompt

```
TASK: Verify JSON columns have been normalized into relational tables.

1. Confirm tables `site_guards`, `site_shifts`, `site_patrol_points`, `site_geofence_points` exist in the DB schema.
2. Confirm these tables have proper foreign key references and indexes.
3. Check all site-related route handlers — they should read from/write to the new tables, not JSON columns.
4. Call `GET /api/sites` — the response should still include `assignedGuards`, `shifts`, `patrolRoute` arrays as before.
5. Call `POST /api/sites` with assigned guards and shifts — verify data goes into junction tables.
6. Verify the migration script exists and is idempotent.
7. Assign a guard to a site, then query `site_guards` directly — should have the row.
```

### Manual Test Steps

1. Create a site via the admin app with 2 guards assigned.
2. Check the database: `sqlite3 gw.db "SELECT * FROM site_guards;"` — should have 2 rows.
3. Remove a guard from the site → `site_guards` row should be deleted.
4. Verify the admin dashboard shows sites with correct guard counts.

---

## Issue #7 — Duplicated API Service Layer (HIGH)

### Fix Prompt

```
TASK: Create a shared API service package used by both the guard app and staff app.

CURRENT STATE:
- `guardsync-guard-app/src/services/api.ts` and `guardsync-staff-app/src/services/api.ts` contain nearly identical `ApiService` classes (~90 lines each).
- Both have the same `request()`, `get()`, `post()`, `put()`, `delete()`, `uploadFile()` methods.
- Both define the same `ApiResponse<T>` interface.
- Any bug fix or feature (like adding auth token headers) must be applied in both places.

SOLUTION — Create a shared package:

1. Create `shared/api-client/` at the project root:
```
shared/
  api-client/
    package.json       ← { "name": "@guardsync/api-client", "main": "index.ts", "types": "index.ts" }
    index.ts           ← exports ApiService class and ApiResponse type
    tsconfig.json
```

2. `shared/api-client/index.ts` should contain:
   - The `ApiResponse<T>` interface
   - The `ApiService` class with all methods (get, post, put, delete, uploadFile)
   - `setToken(token)` and `clearToken()` methods for auth
   - Automatic `Authorization: Bearer <token>` header injection

3. In both apps' `package.json`, add a workspace dependency:
   ```json
   "@guardsync/api-client": "file:../../shared/api-client"
   ```

4. In both apps' `tsconfig.json`, add a path alias:
   ```json
   "paths": {
     "@guardsync/api-client": ["../../shared/api-client/index"]
   }
   ```

5. In both apps' `vite.config.ts`, add an alias:
   ```ts
   resolve: {
     alias: {
       '@guardsync/api-client': path.resolve(__dirname, '../../shared/api-client/index.ts'),
     }
   }
   ```

6. Update `guardsync-guard-app/src/services/api.ts` and `guardsync-staff-app/src/services/api.ts` to re-export from the shared package:
   ```ts
   import { ApiService, ApiResponse } from '@guardsync/api-client';
   export type { ApiResponse };
   const api = new ApiService(API_BASE_URL + '/api');
   export { api };
   export default api;
   ```

7. Delete the duplicated class code from both apps' api.ts files.
8. Verify all imports throughout both apps still resolve correctly.
```

### Validation Prompt

```
TASK: Verify the shared API client is properly set up and used.

1. Confirm `shared/api-client/index.ts` exists with `ApiService` class and `ApiResponse` type.
2. Confirm both `guardsync-guard-app/package.json` and `guardsync-staff-app/package.json` reference `@guardsync/api-client`.
3. Confirm both apps' `api.ts` files import from the shared package, not define their own class.
4. Confirm both apps' `vite.config.ts` have the alias configured.
5. Run `npm install` in both apps — no errors.
6. Run `npm run build` in both apps — no TypeScript or build errors.
7. Confirm `setToken()` and `clearToken()` are available on the imported api instance.
```

### Manual Test Steps

1. Run `cd guardsync-guard-app && npm run build` — should succeed.
2. Run `cd guardsync-staff-app && npm run build` — should succeed.
3. Login via guard app → API calls should work (shared client handles token).
4. Login via staff app → API calls should work.

---

## Issue #8 — Divergent Type Definitions (HIGH)

### Fix Prompt

```
TASK: Unify the three divergent type definition files across the apps into a single shared types package.

CURRENT STATE:
Three separate type files define overlapping but DIFFERENT shapes:

- `guardsync-admin/src/types/index.ts` — Guard has: id, name, phone, employeeId, siteId, status (6 values), lastSeen, location, avatar, clockedIn, clockInTime, currentShiftId, shiftType, shiftStartTime, shiftEndTime, locationHistory, lastPinged
- `guardsync-guard-app/src/types/guard.ts` — Guard has: id, name, email, employeeId, phone, photoUrl, status (3 values: active/on-break/off-duty), isActive, onboardingStatus, documents, bankDetails, uniformInstallments, currentShift (different shape), dailyRate, dateOfJoining, address, emergencyContact, faceDescriptor
- `guardsync-staff-app/src/types/index.ts` — Staff, StaffAttendance, ConveyanceRequest, FieldReport

Key divergences:
- Guard.status: admin uses 'online'|'offline'|'idle'|'alert'|'panic'|'pending', guard-app uses 'active'|'on-break'|'off-duty'
- AttendanceLog shapes are completely different between admin and guard app
- Shift interface is different between admin and guard app
- Site is only defined in admin
- LeaveRequest, PatrolLog, PayrollRecord, etc. only in guard app

SOLUTION:

1. Create `shared/types/` at the project root:
```
shared/
  types/
    package.json   ← { "name": "@guardsync/types", "main": "index.ts", "types": "index.ts" }
    index.ts       ← re-exports all
    guard.ts       ← unified Guard type with ALL fields from both apps (optional fields for app-specific ones)
    site.ts        ← Site, PatrolCheckpoint
    attendance.ts  ← AttendanceLog (unified), StaffAttendance
    leave.ts       ← LeaveRequest
    shift.ts       ← Shift (unified)
    staff.ts       ← Staff
    conveyance.ts  ← ConveyanceRequest
    report.ts      ← FieldReport
    patrol.ts      ← PatrolLog, PatrolPoint
    payroll.ts     ← PayrollRecord
    alert.ts       ← SOSAlert, WakeAlert
    config.ts      ← SystemConfig
    common.ts      ← shared enums, GuardStatus, OnboardingStatus, etc.
    tsconfig.json
```

2. The unified `Guard` interface should be a SUPERSET:
   ```ts
   export type GuardStatus = 'online' | 'offline' | 'idle' | 'alert' | 'panic' | 'pending' | 'active' | 'on-break' | 'off-duty';

   export interface Guard {
     id: string;
     name: string;
     email?: string;
     phone: string;
     employeeId: string;
     siteId?: string | null;
     status: GuardStatus;
     // ... all fields from both apps, with app-specific ones marked optional
   }
   ```

3. Use the same workspace dependency pattern as issue #7:
   - Both apps add `"@guardsync/types": "file:../../shared/types"` to package.json
   - Add path aliases in tsconfig and vite config
   
4. Update ALL import statements in all 3 apps to use `@guardsync/types`.

5. Delete the old per-app type files (or replace them with re-exports from the shared package for backward compat).

6. Ensure no TypeScript errors after the migration.
```

### Validation Prompt

```
TASK: Verify type definitions are unified.

1. Confirm `shared/types/` exists with all the type files listed above.
2. Confirm there is ONE `Guard` interface that is a superset of all three apps' versions.
3. Confirm `GuardStatus` includes all values from both admin and guard-app.
4. All three apps import from `@guardsync/types` (search for old import paths).
5. No duplicate type definitions remain in the individual apps' `src/types/` directories (or they are thin re-exports).
6. Run `npm run build` in all 3 apps — no TypeScript errors.
7. Verify `Shift`, `AttendanceLog`, `LeaveRequest` types are unified and used everywhere.
```

### Manual Test Steps

1. Build all three apps — no type errors.
2. Open any component that uses `Guard` type — editor shows the unified type with full intellisense.
3. Test guard enrollment → guard profile display → admin dashboard — data flows correctly.

---

## Issue #9 — Duplicate Route Handlers (HIGH)

### Fix Prompt

```
TASK: Remove the duplicate GET /api/attendance route handler in the server.

CURRENT STATE:
- `guardsync-admin/server/index.js` has TWO handlers for `GET /api/attendance`:
  - First one at approximately line 1591 
  - Second one at approximately line 2340
- Express will always execute the FIRST matching handler, meaning the second one is dead code that's never reached.
- This can cause silent bugs if someone edits the wrong handler thinking it's the active one.

CHANGES:
1. Compare both handlers. Determine which one has the more complete/correct implementation.
2. Keep the correct one, delete the other.
3. If they have different logic, merge the best parts into a single handler.
4. Add a comment above the handler noting it was deduplicated.
5. Search the entire server file for any OTHER duplicate route registrations (same HTTP method + same path). Remove any found.

Look specifically for:
- Duplicate `app.get('/api/attendance', ...)`
- Any other routes registered twice with the same method+path
```

### Validation Prompt

```
TASK: Verify no duplicate route handlers exist.

1. Search the entire server codebase for all route registrations (app.get, app.post, app.put, app.delete, router.get, router.post, etc.).
2. Group them by HTTP method + path.
3. Confirm every method+path combination appears EXACTLY once.
4. Specifically confirm only ONE handler for GET /api/attendance.
5. Test `GET /api/attendance` with appropriate parameters — should return correct data.
```

### Manual Test Steps

1. Call `GET /api/attendance?guardId=<id>` — should return attendance records.
2. Check the admin dashboard attendance view — should display data correctly.

---

## Issue #10 — Zero Test Coverage (MEDIUM)

### Fix Prompt

```
TASK: Set up a testing framework and write foundational tests for the GuardSync server API.

CURRENT STATE:
- No test files, no test framework, no test scripts, no CI test pipeline exist anywhere in the project.

SETUP:

1. Install testing dependencies in `guardsync-admin/`:
   ```
   npm install --save-dev vitest supertest @types/supertest
   ```

2. Create `guardsync-admin/vitest.config.ts` for the server tests:
   ```ts
   import { defineConfig } from 'vitest/config';
   export default defineConfig({
     test: {
       include: ['server/**/*.test.js', 'server/**/*.test.ts'],
       environment: 'node',
       globals: true,
     }
   });
   ```

3. Add test scripts to `guardsync-admin/package.json`:
   ```json
   "scripts": {
     "test": "vitest run",
     "test:watch": "vitest",
     "test:coverage": "vitest run --coverage"
   }
   ```

4. Create `server/app.js` that exports the Express app WITHOUT calling `app.listen()` (so tests can use supertest without starting a real server). Move the `app.listen()` call to `server/index.js` which imports app from `server/app.js`.

5. Write these foundational test files:

   `server/__tests__/auth.test.js`:
   - POST /api/auth/login with valid credentials → 200 + token
   - POST /api/auth/login with invalid password → 401
   - POST /api/auth/login with missing fields → 400
   - Accessing protected route without token → 401
   - Accessing protected route with valid token → 200

   `server/__tests__/guards.test.js`:
   - GET /api/guards → returns array (with auth)
   - GET /api/guards/:id → returns guard object
   - POST /api/guards/enroll → creates guard
   - PUT /api/guards/:id → updates guard
   - DELETE /api/guards/:id → removes guard (admin only)

   `server/__tests__/sites.test.js`:
   - GET /api/sites → returns array
   - POST /api/sites → creates site
   - PUT /api/sites/:id → updates site
   - DELETE /api/sites/:id → removes site

   `server/__tests__/attendance.test.js`:
   - POST /api/attendance/clock-in → creates attendance record
   - POST /api/attendance/clock-out → updates attendance record
   - GET /api/attendance → returns records filtered by guardId

6. Each test file should:
   - Use a separate test database (e.g., `:memory:` or a temp file)
   - Clean up after itself
   - Test both happy path and error cases
   - Test auth requirements (401 without token)

7. For frontend apps, create a basic Vitest setup in each app and write at least one smoke test for App.tsx rendering.
```

### Validation Prompt

```
TASK: Verify test infrastructure is properly set up.

1. Confirm vitest is installed in guardsync-admin.
2. Confirm `vitest.config.ts` exists with correct configuration.
3. Confirm `package.json` has "test", "test:watch", "test:coverage" scripts.
4. Confirm `server/app.js` exports the Express app without `.listen()`.
5. Confirm test files exist under `server/__tests__/`.
6. Run `npm test` — all tests should pass.
7. Confirm tests use a separate test database, not the production one.
8. Confirm tests cover auth requirements (401 without token).
9. Count the number of test cases — should be at least 15.
```

### Manual Test Steps

1. Run `cd guardsync-admin && npm test` — all tests should pass.
2. Run `npm run test:coverage` — check coverage report.
3. Break a route handler on purpose → re-run tests → test should fail.
4. Fix the handler → re-run → tests pass again.

---

## Issue #11 — Manual FE-BE Data Mapping (MEDIUM)

### Fix Prompt

```
TASK: Create a shared data contract layer that eliminates manual frontend-backend field mapping.

CURRENT STATE:
- The server stores data with snake_case columns (e.g., `employee_id`, `site_id`, `clock_in_time`).
- The frontend types use camelCase (e.g., `employeeId`, `siteId`, `clockInTime`).
- Every route handler manually maps between the two: `employeeId: row.employee_id`.
- Every frontend consumer manually maps API responses.
- This is error-prone and a maintenance burden.

CHANGES:

1. Create `server/utils/caseConverter.js`:
   ```js
   // snakeToCamel: converts { employee_id: 'x' } → { employeeId: 'x' }
   export function snakeToCamel(obj) { ... }
   
   // camelToSnake: converts { employeeId: 'x' } → { employee_id: 'x' }
   export function camelToSnake(obj) { ... }
   
   // Handle nested objects and arrays recursively
   ```

2. Create Express middleware `server/middleware/caseConverter.js`:
   ```js
   // Request middleware: converts incoming camelCase JSON body to snake_case
   // Response middleware: wraps res.json() to convert snake_case output to camelCase
   ```

3. Apply this middleware globally so:
   - All incoming request bodies are auto-converted from camelCase to snake_case
   - All outgoing JSON responses are auto-converted from snake_case to camelCase
   
4. Remove ALL manual field mapping from route handlers. They should work directly with snake_case DB columns and let the middleware handle conversion.

5. This should be transparent to the frontend — it continues to send/receive camelCase as before.

6. Write tests for the case converter utility covering edge cases (nested objects, arrays, null values, dates).
```

### Validation Prompt

```
TASK: Verify the case converter is working.

1. Confirm `server/utils/caseConverter.js` exists with `snakeToCamel()` and `camelToSnake()`.
2. Confirm middleware is applied in the Express app.
3. Search route handlers for manual field mapping like `employeeId: row.employee_id` — should be ZERO instances.
4. Call `GET /api/guards` — response should have camelCase keys (`employeeId`, not `employee_id`).
5. Call `POST /api/sites` with camelCase body — should work correctly.
6. Confirm edge cases: null values, arrays, nested objects all convert correctly.
```

### Manual Test Steps

1. Call `GET /api/guards` → check response keys are camelCase.
2. Create a guard via POST with camelCase body → should be stored correctly in DB with snake_case.
3. Frontend apps should work without any changes.

---

## Issue #12 — Staff App Bypasses API Layer (MEDIUM)

### Fix Prompt

```
TASK: Ensure the staff app routes all data through the centralized API service layer.

CURRENT STATE:
- `guardsync-staff-app/src/services/staffApi.ts` correctly uses the `api` service for most calls.
- However, check all pages and components in the staff app for any direct `fetch()` calls or inline API calls that bypass the `staffApi.ts` or `api.ts` layers.
- This creates inconsistency because the centralized API service handles error formatting, auth token injection, and base URL configuration.

CHANGES:
1. Search ALL files in `guardsync-staff-app/src/` for:
   - Direct `fetch(` calls (not going through `api.ts`)
   - Direct `XMLHttpRequest` usage
   - Hardcoded API URLs like `http://localhost:4000`
   - Any inline API logic that should be in `staffApi.ts`

2. Move any discovered direct API calls into `staffApi.ts` as properly named functions.

3. Update the components/pages to use the `staffApi` functions instead of direct fetch calls.

4. Ensure ALL API interactions go through: Component → staffApi.ts → api.ts → server.

5. Apply the same check to `guardsync-guard-app/src/` — search for direct `fetch()` calls bypassing `GuardAPI.ts` / `api.ts`.

6. Apply the same check to `guardsync-admin/src/` — search for direct `fetch()` calls.
```

### Validation Prompt

```
TASK: Verify no direct API calls bypass the service layer.

1. Search for `fetch(` in all files under `guardsync-staff-app/src/` EXCLUDING `services/api.ts`.
2. Search for `fetch(` in all files under `guardsync-guard-app/src/` EXCLUDING `services/api.ts`.
3. Search for `fetch(` in all files under `guardsync-admin/src/`.
4. Search for `http://localhost` in all frontend source files.
5. Any results from steps 1-4 are violations that need to be moved to the service layer.
6. Confirm all API calls in components go through the service layer functions.
```

### Manual Test Steps

1. In browser dev tools Network tab, perform every action in the staff app.
2. Every request should go through the same base URL and have consistent headers.
3. Intentionally break `api.ts` (e.g., wrong base URL) — ALL features should break, confirming everything routes through it.

---

## Issue #13 — SQLite Scalability Ceiling (MEDIUM)

### Fix Prompt

```
TASK: Abstract the database layer to support swapping SQLite for PostgreSQL in the future.

CURRENT STATE:
- `guardsync-admin/server/index.js` (or db.js after refactor) uses `better-sqlite3` with raw SQL queries scattered across all route handlers.
- Queries use SQLite-specific syntax in some places.
- A production deployment with many guards/sites will hit SQLite's write-concurrency limits.

CHANGES (this is a PREPARATION step, not a full migration):

1. Create `server/repositories/` with one repository per entity:
```
server/repositories/
  BaseRepository.js     ← common CRUD methods
  GuardRepository.js
  SiteRepository.js
  AttendanceRepository.js
  LeaveRepository.js
  ConveyanceRepository.js
  StaffRepository.js
  PayrollRepository.js
  PatrolRepository.js
  NotificationRepository.js
  ScheduleRepository.js
  TicketRepository.js
  SOSRepository.js
  ReportRepository.js
  ConfigRepository.js
```

2. Each repository encapsulates ALL SQL queries for that entity. Example:
   ```js
   // GuardRepository.js
   export class GuardRepository {
     constructor(db) { this.db = db; }
     
     findAll() { return this.db.prepare('SELECT * FROM guards').all(); }
     findById(id) { return this.db.prepare('SELECT * FROM guards WHERE id = ?').get(id); }
     findByEmail(email) { ... }
     create(data) { ... }
     update(id, data) { ... }
     delete(id) { ... }
   }
   ```

3. Route handlers should call repository methods instead of writing raw SQL:
   ```js
   // Before: db.prepare('SELECT * FROM guards WHERE id = ?').get(id)
   // After: guardRepo.findById(id)
   ```

4. This way, swapping to PostgreSQL later only requires changing the repository implementations, not the route handlers.

5. Add a comment at the top of `BaseRepository.js`:
   ```
   // To migrate to PostgreSQL:
   // 1. Create PostgreSQL-specific repository implementations
   // 2. Update the db connection in db.js
   // 3. Route handlers need zero changes
   ```

6. Do NOT actually migrate to PostgreSQL — this is just the abstraction layer.
```

### Validation Prompt

```
TASK: Verify the repository pattern is properly implemented.

1. Confirm `server/repositories/` directory exists with one file per entity.
2. Each repository has standard CRUD methods (findAll, findById, create, update, delete).
3. Route handlers call repository methods, NOT raw `db.prepare()` calls directly.
4. Search for `db.prepare(` in route files — should be ZERO (all moved to repositories).
5. The database connection is injected into repositories via constructor, not imported directly.
6. All existing API functionality still works after the refactor.
```

### Manual Test Steps

1. Test all CRUD operations via the API (create guard, read, update, delete).
2. Test filtered queries (get attendance by guard ID, get leave by status).
3. Verify the admin dashboard loads all data correctly.

---

## Issue #14 — Hardcoded Demo Credentials (MEDIUM)

### Fix Prompt

```
TASK: Remove all hardcoded demo/default credentials from the codebase.

CURRENT STATE:
- `server/initialData.json` or the seed logic contains default passwords for demo guards and staff.
- These credentials may be well-known / committed to git.
- The seed logic creates users with these passwords, which can be used to access the system.

CHANGES:

1. Search the ENTIRE codebase for:
   - Hardcoded passwords (strings like `'password'`, `'123456'`, `'admin'`, `'guard123'`, etc.)
   - Default credentials in seed files, initialData.json, or inline in server code
   - Demo login credentials in frontend code (pre-filled form values)

2. For the SEED DATA / initial setup:
   - Replace hardcoded passwords with environment variables or auto-generated passwords
   - On first run/seed, generate random passwords and print them to the console:
     ```
     ┌──────────────────────────────────────────┐
     │ Initial Admin Credentials                │
     │ Email: admin@guardsync.com               │
     │ Password: <randomly-generated>           │
     │ ⚠️ Change this password after first login │
     └──────────────────────────────────────────┘
     ```
   - Hash all seeded passwords with bcrypt

3. For FRONTEND demo/prefilled credentials:
   - Remove any hardcoded credentials from login form components
   - Do NOT pre-fill email/password fields
   - If there's a "demo login" button, either remove it or make it configurable via env var (only show in development)

4. In `docker-compose.yml`, add `ADMIN_EMAIL` and `ADMIN_PASSWORD` env vars that the seed script uses.

5. Update the seed script to be idempotent — don't re-seed if admin already exists.
```

### Validation Prompt

```
TASK: Verify no hardcoded credentials remain.

1. Search the entire codebase for common password strings: 'password', '123456', 'admin123', 'guard123', 'Password', 'pass123'.
2. Search for pre-filled login form values with hard-coded credentials.
3. Check `initialData.json` — passwords should not be plaintext.
4. Check the seed script — passwords should be hashed with bcrypt.
5. Check frontend login components — no default email/password values.
6. Verify seeded accounts use strong, unique passwords.
7. Check docker-compose.yml for configurable admin credentials.
```

### Manual Test Steps

1. Fresh start: `docker-compose down -v && docker-compose up --build -d`.
2. Check container logs: `docker logs guardsync-api` — should show generated admin credentials.
3. Open the admin login page — email/password fields should be empty.
4. Login with the generated credentials — should work.
5. Try logging in with common passwords like "password" or "123456" — should fail.

---

## Issue #15 — Hardcoded localhost in Simulation (MEDIUM)

### Fix Prompt

```
TASK: Replace all hardcoded localhost URLs with environment-variable-driven configuration.

CURRENT STATE:
- `docker-compose.yml` sets `VITE_API_URL=http://localhost:4000` for all frontend services.
- Frontend code may contain additional hardcoded `http://localhost:4000` strings.
- The simulation/demo hooks may hardcode WebSocket or API URLs.
- This breaks portability when deploying to staging/production or when running on a different machine.

CHANGES:

1. Search ALL source files across all three apps for:
   - `http://localhost:4000`
   - `http://localhost:8080`
   - `http://localhost:8081`
   - `http://localhost:8082`
   - `ws://localhost`
   - Any hardcoded `127.0.0.1` references
   - Any hardcoded port numbers in URL strings

2. Replace ALL found instances with:
   - Frontend: `import.meta.env.VITE_API_URL` (for API calls)
   - Server: `process.env.API_URL` or appropriate env var
   - If the URL is for WebSockets: derive from the API URL

3. Create a centralized config utility in each app:
   ```ts
   // src/lib/config.ts
   export const config = {
     apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:4000',
     wsUrl: (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace('http', 'ws'),
   };
   ```

4. Update `docker-compose.yml` to document these env vars clearly.

5. Check `guardsync-admin/src/hooks/useSimulation.ts` specifically — it likely has hardcoded URLs for simulation data.

6. Check all Capacitor config files (`capacitor.config.ts`) for hardcoded URLs — these need to use env vars or build-time configuration.

NOTE: For Capacitor Android builds, the URL must be baked in at build time. Use `capacitor.config.ts` with a dynamic value:
```ts
const config: CapacitorConfig = {
  server: {
    url: process.env.VITE_API_URL || 'http://10.0.2.2:4000', // Android emulator uses 10.0.2.2 for host localhost
  }
};
```
```

### Validation Prompt

```
TASK: Verify no hardcoded localhost URLs remain.

1. Search all source files (excluding node_modules, build, .git) for: `localhost:4000`, `localhost:8080`, `localhost:8081`, `localhost:8082`, `127.0.0.1`.
2. Only acceptable locations: .env files, .env.example, docker-compose.yml (as default values), README docs.
3. Source code (*.ts, *.tsx, *.js, *.jsx) should have ZERO hardcoded localhost references.
4. Confirm each app has a centralized config.ts exporting the API URL.
5. Confirm `capacitor.config.ts` files use environment-based URLs.
6. Confirm `useSimulation.ts` uses the config utility.
```

### Manual Test Steps

1. Change `VITE_API_URL` in docker-compose.yml to a different value (e.g., `http://api:4000`).
2. Rebuild: `docker-compose up --build -d`.
3. Check that all frontends still connect to the API correctly.
4. Check browser Network tab — requests should go to the configured URL, not localhost.

---

## Issue #16 — Duplicated Utility Functions (MEDIUM)

### Fix Prompt

```
TASK: Consolidate duplicated utility functions across the three apps into a shared package.

CURRENT STATE:
- Each app has a `src/lib/utils.ts` that likely contains overlapping utility functions (cn(), date formatting, API_BASE_URL, etc.).
- Common patterns repeated across apps: className merging (cn), date formatting, distance calculation, validation helpers.

CHANGES:

1. Audit `src/lib/utils.ts` in all three apps. List every exported function.

2. Create `shared/utils/` at the project root:
```
shared/
  utils/
    package.json    ← { "name": "@guardsync/utils", "main": "index.ts" }
    index.ts        ← re-exports all
    cn.ts           ← className utility (if using tailwind-merge + clsx pattern)
    date.ts         ← date formatting utilities
    geo.ts          ← geolocation/distance calculation utilities
    format.ts       ← number/string formatting
    id.ts           ← ID generation (see issue #19)
    tsconfig.json
```

3. Move ALL shared utilities to this package.

4. In each app, update `src/lib/utils.ts` to re-export from `@guardsync/utils`:
   ```ts
   export { cn, formatDate, formatDistance, generateId } from '@guardsync/utils';
   // App-specific exports stay here
   export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
   ```

5. Add workspace dependency to each app's `package.json` and configure aliases in vite.config.ts and tsconfig.json.

6. Delete duplicated code from each app's utils.ts — keep only app-specific exports.
```

### Validation Prompt

```
TASK: Verify utility functions are consolidated.

1. Confirm `shared/utils/` exists with the utility modules.
2. Compare the function signatures in the shared package vs what was in each app's utils.ts.
3. Each app's `src/lib/utils.ts` should import from `@guardsync/utils`, not define duplicated functions.
4. Search for duplicate function definitions across all apps (e.g., `export function cn`).
5. Build all three apps — no errors.
```

### Manual Test Steps

1. Build all apps: `npm run build` in each — should succeed.
2. Use the app UI — all styles (cn), dates, and formatting should work identically.

---

## Issue #17 — No Structured Logging (LOW)

### Fix Prompt

```
TASK: Add structured logging to the server using pino.

CURRENT STATE:
- Server uses `console.log` / `console.error` with unstructured string messages.
- No request IDs, no log levels, no machine-parseable format.
- Debugging production issues requires manual log file searching.

CHANGES:

1. Install pino and pino-http:
   ```
   cd guardsync-admin && npm install pino pino-http
   npm install --save-dev pino-pretty  (for dev formatting)
   ```

2. Create `server/logger.js`:
   ```js
   import pino from 'pino';
   
   const logger = pino({
     level: process.env.LOG_LEVEL || 'info',
     transport: process.env.NODE_ENV !== 'production' 
       ? { target: 'pino-pretty', options: { colorize: true } }
       : undefined,
     // In production, output JSON for log aggregation
   });
   
   export default logger;
   ```

3. Create `server/middleware/requestLogger.js` using `pino-http`:
   - Logs every HTTP request/response with: method, url, status code, response time, request ID
   - Generates a unique request ID per request (use `crypto.randomUUID()`)
   - Attaches `req.log` for use in route handlers

4. Replace ALL `console.log()` and `console.error()` in server code with appropriate `logger.*` calls:
   - `logger.info()` for normal operations (server started, user logged in)
   - `logger.warn()` for suspicious activity (failed login, rate limit hit)
   - `logger.error()` for errors (DB errors, unhandled exceptions)
   - `logger.debug()` for development-level details

5. Add `LOG_LEVEL` env var to `docker-compose.yml` (default: `info`).

6. In error handlers, log the full error with stack trace:
   ```js
   logger.error({ err, req: { method, url, body } }, 'Request failed');
   ```
```

### Validation Prompt

```
TASK: Verify structured logging is implemented.

1. Confirm `pino` and `pino-http` are in package.json dependencies.
2. Confirm `server/logger.js` exists and exports a pino logger.
3. Search for `console.log` and `console.error` in server code — should be ZERO.
4. Confirm request logging middleware is applied and logs method, url, status, response time.
5. Start the server and make a request — check the log output format.
6. In production mode, logs should be JSON. In dev, they should be pretty-printed.
```

### Manual Test Steps

1. Start the API container and tail logs: `docker logs -f guardsync-api`.
2. Hit `GET /api/sites` — should see a structured log entry with method, url, status, response time.
3. Hit an invalid endpoint — should see a 404 log entry.
4. Try a login with wrong password — should see a warn-level log.

---

## Issue #18 — Inconsistent Error Shapes (LOW)

### Fix Prompt

```
TASK: Standardize all API error responses to use a consistent shape.

CURRENT STATE:
- Some routes return `{ error: 'message' }`
- Some return `{ message: 'message' }`
- Some return `{ error: 'message', details: [...] }`
- Some return plain text
- HTTP status codes are sometimes wrong (200 for errors, 500 for user errors)

CHANGES:

1. Define a standard error response shape:
   ```ts
   interface ApiError {
     success: false;
     error: {
       code: string;        // machine-readable: 'GUARD_NOT_FOUND', 'VALIDATION_ERROR', 'UNAUTHORIZED'
       message: string;     // human-readable: 'Guard with ID x not found'
       details?: any[];     // optional: validation errors, field-level errors
     };
   }
   ```

2. Define a standard success response shape:
   ```ts
   interface ApiSuccess<T> {
     success: true;
     data: T;
     message?: string;     // optional success message
   }
   ```

3. Create `server/utils/responses.js`:
   ```js
   export function success(res, data, statusCode = 200, message = null) {
     return res.status(statusCode).json({ success: true, data, ...(message && { message }) });
   }
   
   export function error(res, statusCode, code, message, details = null) {
     return res.status(statusCode).json({ 
       success: false, 
       error: { code, message, ...(details && { details }) }
     });
   }
   
   // Shorthand helpers
   export const notFound = (res, entity, id) => error(res, 404, `${entity.toUpperCase()}_NOT_FOUND`, `${entity} with ID ${id} not found`);
   export const badRequest = (res, message, details) => error(res, 400, 'VALIDATION_ERROR', message, details);
   export const unauthorized = (res, message = 'Unauthorized') => error(res, 401, 'UNAUTHORIZED', message);
   export const forbidden = (res, message = 'Forbidden') => error(res, 403, 'FORBIDDEN', message);
   export const serverError = (res, message = 'Internal server error') => error(res, 500, 'INTERNAL_ERROR', message);
   ```

4. Update ALL route handlers to use these utility functions.

5. Create a global error handler middleware that catches unhandled errors and returns the standard shape.

6. Update the frontend `ApiResponse<T>` type to match:
   ```ts
   interface ApiResponse<T> {
     success: boolean;
     data?: T;
     error?: { code: string; message: string; details?: any[] };
   }
   ```

7. Update frontend error handling to use `response.error.message` instead of `response.error` (string).
```

### Validation Prompt

```
TASK: Verify all error responses use the standard shape.

1. Confirm `server/utils/responses.js` exists with the helper functions.
2. Search for `res.status(` and `res.json(` in route handlers — they should all use response helpers.
3. Search for bare `res.json({ error:` — should be ZERO (all should use response helpers).
4. Call various endpoints with invalid data and check the response shape is consistent.
5. Frontend `ApiResponse` type should match the server's shape.
6. Test: GET /api/guards/nonexistent-id → `{ success: false, error: { code: 'GUARD_NOT_FOUND', message: '...' } }`
7. Test: POST /api/auth/login with wrong password → `{ success: false, error: { code: 'UNAUTHORIZED', message: '...' } }`
```

### Manual Test Steps

1. Call `GET /api/guards/fake-id` → check response shape.
2. Call `POST /api/auth/login` with wrong password → check response shape.
3. Call `POST /api/sites` with missing fields → check response includes validation details.
4. All errors should have `{ success: false, error: { code, message } }`.

---

## Issue #19 — Collision-Prone ID Generation (LOW)

### Fix Prompt

```
TASK: Replace all custom/fragile ID generation with crypto-safe UUIDs.

CURRENT STATE:
- IDs are likely generated using patterns like `Date.now().toString(36) + Math.random().toString(36)` or similar.
- This is collision-prone under concurrent requests (same millisecond = same timestamp prefix).
- Some IDs might use sequential counters.

CHANGES:

1. Search the ENTIRE codebase for ID generation patterns:
   - `Date.now().toString`
   - `Math.random().toString`
   - `'id-' +` or `'guard-' +`
   - Custom `generateId` functions
   - `nanoid` usage (if any)

2. Create `shared/utils/id.ts` (or add to the shared utils package):
   ```ts
   import { randomUUID } from 'crypto';
   
   // For server-side
   export function generateId(): string {
     return randomUUID(); // standard UUID v4
   }
   
   // For client-side (where crypto.randomUUID is available in modern browsers)
   export function generateClientId(): string {
     return crypto.randomUUID();
   }
   ```

3. On the SERVER side:
   - Replace ALL ID generation in route handlers with `crypto.randomUUID()` (Node.js built-in).
   - This includes: guard IDs, site IDs, attendance IDs, leave request IDs, etc.

4. On the CLIENT side:
   - If IDs are generated client-side (they shouldn't be for most entities), use `crypto.randomUUID()`.
   - Prefer server-side ID generation for all database entities.

5. This is backward compatible — existing IDs in the database don't need to change.
```

### Validation Prompt

```
TASK: Verify all ID generation uses crypto-safe UUIDs.

1. Search server code for `Date.now()`, `Math.random()` in the context of ID generation.
2. Search for custom `generateId` functions — they should use `crypto.randomUUID()`.
3. Search frontend code for ID generation — should use `crypto.randomUUID()` if needed.
4. Create 1000 records rapidly via API — confirm no ID collisions.
5. Check generated IDs in the database — should be valid UUID format.
```

### Manual Test Steps

1. Create several guards rapidly via the API.
2. Check the database: `sqlite3 gw.db "SELECT id FROM guards ORDER BY rowid DESC LIMIT 10;"` — should be proper UUIDs.
3. No duplicate IDs should exist.

---

## Issue #20 — Divergent Seed/Main Schemas (LOW)

### Fix Prompt

```
TASK: Align the seed script schema with the main server schema.

CURRENT STATE:
- `server/seedGuards.js` creates guards with only basic fields (name, employee_id, phone, site_id, status).
- The main server's `guards` table has many more columns: email, password, address, emergency_contact, aadhar_number, pan_number, bank details, face_descriptor, onboarding_status, etc.
- `server/initialData.json` may have a different structure than what the seed script or main server expects.
- This means seeded guards are incomplete and may cause errors when the app tries to access missing fields.

CHANGES:

1. Read the FULL `guards` table schema from the CREATE TABLE statement in the server code.

2. Update `server/initialData.json` to include ALL required fields for each seeded guard:
   - name, email, password (to be hashed), phone, employeeId
   - status, siteId, onboardingStatus
   - Optional but should have sensible defaults: address, emergencyContact, etc.

3. Update the seed script to:
   - Insert ALL columns, using defaults for optional fields
   - Hash passwords with bcrypt (not store plaintext)
   - Set `onboarding_status` to 'active' for seeded guards
   - Match the exact column set of the CREATE TABLE statement

4. Create a schema validation function that runs at startup:
   ```js
   function validateSchema() {
     const tableInfo = db.prepare("PRAGMA table_info(guards)").all();
     const expectedColumns = ['id', 'name', 'email', 'password', 'phone', ...];
     const actual = tableInfo.map(c => c.name);
     const missing = expectedColumns.filter(c => !actual.includes(c));
     if (missing.length > 0) {
       logger.warn({ missing }, 'Guards table is missing expected columns');
     }
   }
   ```

5. Ensure the seed script is idempotent — re-running it on an existing database should not create duplicates.
```

### Validation Prompt

```
TASK: Verify seed schema matches main schema.

1. Compare the guards table CREATE TABLE columns with the seed script INSERT columns — they should match.
2. Run the seed script on a fresh database — no errors.
3. Query a seeded guard: `SELECT * FROM guards LIMIT 1` — all columns should have values (or explicit NULLs for optionals).
4. Load a seeded guard in the admin dashboard — should display completely, no missing data errors.
5. Seed script should hash passwords, not store plaintext.
6. Running the seed script twice should not create duplicates.
```

### Manual Test Steps

1. Delete the database: `rm server/data/gw.db`.
2. Start the server → it should create and seed the database.
3. Login with a seeded guard account → should work.
4. View the guard profile in the admin panel → all fields should be populated.

---

## Issue #21 — Missing Input Validation (LOW)

### Fix Prompt

```
TASK: Add comprehensive input validation to all API endpoints using Zod.

CURRENT STATE:
- `server/validate.js` has Zod schemas for only 3 routes: `login`, `staffLogin`, `enrollGuard`.
- ALL other routes (50+ endpoints) accept any input without validation.
- This allows malformed data into the database and potential injection attacks.

CHANGES:

1. Expand `server/validate.js` (or create `server/validation/` directory) with Zod schemas for ALL endpoints:

```
server/validation/
  index.js            ← middleware factory
  auth.schemas.js     ← login, face-login schemas
  guard.schemas.js    ← create, update, enroll schemas
  site.schemas.js     ← create, update schemas
  attendance.schemas.js ← clock-in, clock-out schemas
  leave.schemas.js    ← request, approve/reject schemas
  conveyance.schemas.js
  staff.schemas.js
  schedule.schemas.js
  patrol.schemas.js
  payroll.schemas.js
  notification.schemas.js
  ticket.schemas.js
  report.schemas.js
  config.schemas.js
```

2. Each schema should validate:
   - Required fields are present
   - Field types are correct (string, number, boolean, etc.)
   - String lengths are reasonable (name: 1-100 chars, phone: 10-15 chars, etc.)
   - Enum values are valid (status must be one of the allowed values)
   - Email format is valid
   - Phone format is valid
   - Dates are valid ISO strings
   - Coordinate ranges are valid (lat: -90 to 90, lng: -180 to 180)
   - IDs are non-empty strings

3. Create a validation middleware factory:
   ```js
   export function validate(schema) {
     return (req, res, next) => {
       const result = schema.safeParse(req.body);
       if (!result.success) {
         return res.status(400).json({
           success: false,
           error: {
             code: 'VALIDATION_ERROR',
             message: 'Invalid request data',
             details: result.error.issues,
           }
         });
       }
       req.body = result.data; // use parsed/sanitized data
       next();
     };
   }
   ```

4. Add `validate(schema)` middleware to every POST and PUT route.

5. Also validate URL parameters (e.g., `params.id` is a non-empty string) and query parameters where relevant.
```

### Validation Prompt

```
TASK: Verify input validation is comprehensive.

1. List every POST and PUT route in the server.
2. For each route, confirm a Zod schema exists and the validate middleware is applied.
3. Count total schemas — should be at least 20.
4. Test each endpoint with empty body → should return 400 with validation errors.
5. Test with invalid types (string where number expected) → should return 400.
6. Test with valid data → should succeed.
7. Confirm validation error responses follow the standard error shape.
```

### Manual Test Steps

1. `curl -X POST http://localhost:4000/api/sites -H "Content-Type: application/json" -d '{}'` → should return 400 with field-level errors.
2. `curl -X POST http://localhost:4000/api/attendance/clock-in -H "Content-Type: application/json" -d '{"latitude": "not-a-number"}'` → should return 400.
3. Submit a leave request from the guard app with dates in wrong format → should get a clear validation error.

---

## Issue #22 — Mixed FE/BE Dependencies (LOW)

### Fix Prompt

```
TASK: Separate frontend and backend dependencies in guardsync-admin into independent packages.

CURRENT STATE:
- `guardsync-admin/package.json` contains BOTH frontend (React, Vite, Radix UI, TanStack Query, Leaflet, Recharts) AND backend (Express, better-sqlite3, bcryptjs, jsonwebtoken, multer, helmet) dependencies in the same package.json.
- This means: `npm install` downloads everything for both, the Vite build bundles some Node.js deps, Docker images are bloated, and dependency conflicts can arise.

CHANGES:

1. Create separate package.json for the server:
```
server/
  package.json   ← backend-only dependencies
```

2. Move these to `server/package.json` dependencies:
   - express
   - better-sqlite3
   - bcryptjs
   - jsonwebtoken
   - multer
   - helmet
   - cors
   - express-rate-limit
   - pino, pino-http (if added)
   - zod (shared, but needed for server validation)

3. Keep these in the root `guardsync-admin/package.json` (frontend):
   - react, react-dom
   - vite, @vitejs/plugin-react
   - All @radix-ui/* packages
   - @tanstack/react-query
   - react-router-dom
   - leaflet, react-leaflet
   - recharts
   - tailwindcss, postcss
   - typescript, @types/*
   - class-variance-authority, clsx, tailwind-merge
   - zod (for frontend validation)

4. Update `Dockerfile.api` to:
   - WORKDIR /app/server
   - COPY server/package.json and install only server deps
   - Run `node index.js`

5. Update `Dockerfile.dev` for the admin frontend to only install frontend deps.

6. Update `docker-compose.yml` if needed.

7. Update any import paths that break due to the separation.

8. The server should start independently: `cd server && npm install && node index.js`.
```

### Validation Prompt

```
TASK: Verify frontend and backend dependencies are separated.

1. Confirm `server/package.json` exists with ONLY backend dependencies.
2. Confirm root `guardsync-admin/package.json` has NO backend dependencies (no express, better-sqlite3, bcrypt, jsonwebtoken, multer).
3. `cd guardsync-admin && npm install && npm run build` — frontend builds with no errors.
4. `cd guardsync-admin/server && npm install && node index.js` — server starts with no missing deps.
5. Dockerfile.api only installs server deps.
6. Check Docker image sizes before and after — should be notably smaller.
```

### Manual Test Steps

1. Delete `node_modules` everywhere.
2. `cd guardsync-admin && npm install` → only frontend deps installed.
3. `cd guardsync-admin/server && npm install` → only server deps installed.
4. `docker-compose up --build -d` → all services start cleanly.
5. Frontend serves at :8080, API serves at :4000.

---

## Recommended Fix Order

Execute these in order of dependency (some fixes build on others):

```
Phase 1 — Critical & Foundation
  1. #4  Hardcoded JWT secret (quick win, no deps)
  2. #1  Monolith server refactor (enables all other server changes)
  3. #9  Duplicate route handlers (part of #1)
  4. #5  Database indexes (part of #1 refactor)
  5. #2  Unauthenticated API routes (depends on #1)
  6. #3  Plaintext PII storage (depends on #1)

Phase 2 — Architecture Improvements
  7. #8  Divergent type definitions → shared types
  8. #7  Duplicated API service layer → shared api-client
  9. #16 Duplicated utility functions → shared utils
  10. #6  JSON arrays in SQL columns (depends on #1)
  11. #13 SQLite scalability (repository pattern, depends on #1)

Phase 3 — Quality & Polish
  12. #18 Inconsistent error shapes
  13. #11 Manual FE-BE data mapping
  14. #20 Divergent seed/main schemas
  15. #21 Missing input validation
  16. #14 Hardcoded demo credentials
  17. #15 Hardcoded localhost in simulation
  18. #19 Collision-prone ID generation
  19. #12 Staff app bypasses API layer
  20. #22 Mixed FE/BE dependencies

Phase 4 — Testing & Observability
  21. #10 Zero test coverage (after all other changes are stable)
  22. #17 No structured logging
```

---

## Master Validation Prompt

After ALL fixes are applied, use this prompt:

```
TASK: Run a comprehensive audit of the entire GuardSync codebase to verify all 22 issues have been resolved.

For each issue, perform the specific validations listed above and report:
- ✅ FIXED — with evidence
- ⚠️ PARTIAL — what's missing
- ❌ NOT FIXED — what still needs to change

Also check for REGRESSIONS:
1. All 3 apps build without errors: `npm run build` in each.
2. Docker compose starts all 4 services without errors.
3. Guard login flow works end-to-end.
4. Staff login flow works end-to-end.
5. Admin dashboard loads with data.
6. Guard enrollment works.
7. Attendance clock-in/clock-out works.
8. SOS alert works.
9. Leave request submission and approval works.
10. No TypeScript errors across any app.
```
