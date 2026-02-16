# GuardSync Security Management Platform

A comprehensive security guard management ecosystem with live tracking, attendance management, and facial recognition capabilities.

## 🏗️ Monorepo Structure

```
GuardSync by Eden Labs/
├── guardsync-admin/          # Admin dashboard (React + Vite) & Backend API (Express + SQLite)
│   ├── src/                  # Frontend React application
│   └── server/               # Backend API server
├── guardsync-guard-app/      # Guard mobile app (React + Capacitor → Android)
├── guardsync-staff-app/      # Field officer app (React + Capacitor → Android)
└── shared/                   # Shared code consumed by all apps
    ├── types/                # @guardsync/types - TypeScript interfaces
    ├── utils/                # @guardsync/utils - Utility functions
    └── api-client/           # @guardsync/api-client - Shared HTTP client
```

## 🚀 Quick Start

### Prerequisites
- Node.js 20+ (recommended)
- Docker & Docker Compose (optional, for containerized development)
- Android Studio (for building mobile APKs)

### Development Setup

**Option 1: Using Docker (Recommended)**

```bash
# Start all services
docker-compose up --build

# Access applications:
# Admin Dashboard:  http://localhost:8080
# Guard App:        http://localhost:8082
# Staff App:        http://localhost:8081
# API Server:       http://localhost:4000
```

**Option 2: Manual Setup**

```bash
# Install dependencies for all apps
cd guardsync-admin && npm install
cd ../guardsync-guard-app && npm install
cd ../guardsync-staff-app && npm install
cd ../shared/types && npm install
cd ../shared/utils && npm install
cd ../shared/api-client && npm install

# Terminal 1 - API Server
cd guardsync-admin/server
npm install
npm start          # Starts on port 4000

# Terminal 2 - Admin Dashboard
cd guardsync-admin
npm run dev        # Starts on port 8080

# Terminal 3 - Guard App
cd guardsync-guard-app
npm run dev        # Starts on port 8082

# Terminal 4 - Staff App
cd guardsync-staff-app
npm run dev        # Starts on port 8081
```

## 📱 Applications

### Admin Dashboard
- **Live Map Tracking**: Real-time guard location monitoring with Leaflet maps
- **Attendance Management**: Clock in/out tracking with facial recognition verification
- **Site & Shift Management**: Configure sites, shifts, and assign guards
- **Leave Management**: Approve/reject leave requests
- **Payroll & Reports**: Generate attendance reports and manage payroll
- **Alert System**: Receive SOS alerts from guards in the field

### Guard Mobile App
- **Facial Recognition**: AI-powered check-in/check-out with face verification
- **Patrol Point Logging**: Log patrol checkpoints with GPS coordinates
- **Site Navigation**: View assigned sites on interactive maps
- **Leave Requests**: Submit and track leave applications
- **SOS Alerts**: Emergency alert button with location sharing
- **Offline Support**: Basic functionality works without connectivity

### Staff Field Officer App
- **Conveyance Approvals**: Review and approve conveyance requests
- **Field Reporting**: Submit voice and video reports from the field
- **Guard Monitoring**: View guard activity and locations
- **Quick Actions**: Fast approval workflows for field operations

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 6
- **Styling**: Tailwind CSS with shadcn/ui components
- **State Management**: TanStack Query (React Query)
- **Routing**: React Router v6
- **Maps**: Leaflet + React Leaflet
- **Mobile**: Capacitor 8 (PWA to Native Android)

### Backend
- **Runtime**: Node.js 20
- **Framework**: Express.js
- **Database**: SQLite with better-sqlite3
- **Authentication**: JWT with bcrypt
- **Encryption**: AES-256-GCM for PII data
- **Logging**: Pino with structured logging
- **Validation**: Zod schemas

### AI/ML
- **Face Recognition**: TensorFlow.js + face-api.js
- **Models**: Loaded client-side for privacy

## 📦 Building Mobile APKs

### Guard App

```bash
cd guardsync-guard-app

# Set production API URL
$env:VITE_API_URL = "https://your-api.com"  # Windows PowerShell
# export VITE_API_URL="https://your-api.com"  # Linux/Mac

# Build APK
npm run build:apk

# Output: android/app/build/outputs/apk/release/app-release-unsigned.apk
```

### Staff App

```bash
cd guardsync-staff-app

# Set production API URL
$env:VITE_API_URL = "https://your-api.com"

# Build APK
npm run build:apk

# Output: android/app/build/outputs/apk/release/app-release-unsigned.apk
```

### Build Both APKs at Once

```bash
# From project root
gradle buildAllApks
```

## 🐳 Docker Deployment

### Production Configuration

1. **Update Environment Variables** in `docker-compose.yml`:
   ```bash
   # Generate secure keys
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"  # JWT_SECRET
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"  # ENCRYPTION_KEY
   ```

2. **Update API URLs** for frontends:
   ```yaml
   environment:
     - VITE_API_URL=https://your-production-api.com
   ```

3. **Deploy**:
   ```bash
   docker-compose up -d
   ```

## 🧪 Testing

```bash
# Admin frontend tests
cd guardsync-admin
npm test                    # Run once
npm run test:watch          # Watch mode
npm run test:coverage       # With coverage

# API server tests
cd guardsync-admin/server
npm test
```

## 🔒 Security Considerations

### Before Production Deployment:

1. **Generate New Secrets**: Replace all default JWT_SECRET and ENCRYPTION_KEY values
2. **Disable Cleartext**: Set `cleartext: false` in Capacitor configs for HTTPS-only
3. **Environment Variables**: Never commit `.env` files with production secrets
4. **Database Backups**: Implement regular SQLite backup strategy
5. **HTTPS Only**: Use SSL certificates for all API endpoints
6. **Rate Limiting**: API already includes express-rate-limit middleware
7. **CORS**: Configure allowed origins in production

## 📂 Shared Dependencies

The monorepo uses local `file:` dependencies for shared packages:

```json
{
  "@guardsync/types": "file:../shared/types",
  "@guardsync/utils": "file:../shared/utils",
  "@guardsync/api-client": "file:../shared/api-client"
}
```

**Important**: The entire monorepo structure must be maintained for builds. Deploy from the root directory, not individual app folders.

## 🌐 Deployment Options

| Component | Recommended Platform | Cost |
|-----------|---------------------|------|
| API Server | Railway / Render / VPS | ~$5-7/mo |
| Admin Dashboard | Vercel / Cloudflare Pages | Free |
| Android APKs | Google Play Console | $25 one-time |

### Deployment Checklist

See [PRODUCTION-DEPLOYMENT-CHECKLIST.md](PRODUCTION-DEPLOYMENT-CHECKLIST.md) for detailed steps.

## 📜 Scripts

### Root Level
- `docker-compose up` - Start all services in Docker
- `gradle buildAllApks` - Build both Android APKs

### Admin App
- `npm run dev` - Start frontend dev server
- `npm run dev:api` - Start backend API server
- `npm run build` - Build for production
- `npm run seed:guards` - Seed test guard data

### Mobile Apps (Guard/Staff)
- `npm run dev` - Start Vite dev server
- `npm run build` - Build web assets
- `npm run cap:sync` - Sync web assets to native
- `npm run cap:open-android` - Open in Android Studio
- `npm run build:apk` - Build production APK

## 🐛 Known Issues & Fixes

See [ISSUE-FIX-PROMPTS.md](ISSUE-FIX-PROMPTS.md) for troubleshooting common problems.

## 📄 License

Proprietary - Eden Labs

## 👥 Contributors

Eden Labs Development Team

---

**Need help?** Check the README files in individual app directories for app-specific documentation.
