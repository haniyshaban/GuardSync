# GuardWise Staff App

A React-based field officer portal for the GuardWise security management ecosystem.

## Tech Stack

- **Vite** - Build tool
- **TypeScript** - Type safety
- **React** - UI framework
- **shadcn-ui** - Component library
- **Tailwind CSS** - Styling
- **Capacitor** - Native mobile builds

## Features

- **Attendance Dashboard** - Clock in/out with shift selection (Morning/General/Night)
- **Conveyance Approvals** - Review and approve/deny guard conveyance requests
- **Field Reporting** - Record voice notes and capture video reports

## Getting Started

### Prerequisites

- Node.js (v18+)
- npm or bun
- Android Studio (for APK builds)

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:8081`

## Packaging as Android APK (Capacitor)

### Prerequisites

- Node.js and npm installed
- Android Studio and Android SDK (for building the APK)
- Java JDK (required by Android Gradle)

### Steps to build an Android APK

1. **Install Capacitor CLI and core** (already in package.json):

```bash
npm install @capacitor/core @capacitor/cli --save-dev
```

2. **Initialize Capacitor** (only once):

```bash
npm run cap:init
```

3. **Build the web app and copy to the native project**:

```bash
npm run cap:copy
```

4. **Add the Android platform** (first time):

```bash
npm run cap:add-android
```

5. **Open the Android project in Android Studio** or build from CLI:

```bash
npm run cap:open-android
# OR build an APK from CLI
npm run build:apk
```

## Project Structure

```
guardwise-staff-app/
├── src/
│   ├── components/
│   │   ├── ui/           # shadcn-ui components
│   │   └── BottomNav.tsx
│   ├── contexts/
│   │   └── AuthContext.tsx
│   ├── hooks/
│   │   └── use-toast.ts
│   ├── lib/
│   │   └── utils.ts
│   ├── pages/
│   │   ├── Dashboard.tsx        # Attendance & overview
│   │   ├── ConveyanceApprovals.tsx
│   │   ├── FieldReporting.tsx
│   │   ├── Login.tsx
│   │   └── NotFound.tsx
│   ├── services/
│   │   ├── api.ts              # Base API service
│   │   └── staffApi.ts         # Staff-specific endpoints
│   └── types/
│       └── index.ts
├── capacitor.config.ts
├── tailwind.config.ts
└── vite.config.ts
```

## API Integration

The app connects to the GuardWise Platform backend (default: `http://localhost:4000/api`).

Configure the API URL via environment variable:

```env
VITE_API_URL=http://your-api-server:4000/api
```

## Notes

- Voice/video recording uses browser MediaDevices API
- Requires microphone and camera permissions for field reporting
- GPS tracking is enabled for attendance clock-in/out

## Related Apps

- **guardwise-platform** - Admin dashboard & backend API
- **guardwise-companion-ai** - Guard mobile app
