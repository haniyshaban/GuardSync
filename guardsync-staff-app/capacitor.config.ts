import { CapacitorConfig } from '@capacitor/cli';

// For mobile builds, we need to configure the server URL at build time
// Android emulator uses 10.0.2.2 to access the host machine's localhost
// For production, set VITE_API_URL environment variable before building
const serverUrl = process.env.VITE_API_URL || 'http://10.0.2.2:4000';

const config: CapacitorConfig = {
  appId: 'com.guardsync.staff',
  appName: 'GuardSync Staff',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    // This URL is baked into the build - set VITE_API_URL before building
    // For Android Emulator: use http://10.0.2.2:4000
    // For real device on same network: use http://<YOUR_IP>:4000
    // For production: use https://api.yourserver.com
    url: serverUrl,
    // Plain HTTP is only allowed when the app is built against a plain-HTTP address (local testing).
    // A build pointed at an https:// server refuses unencrypted traffic.
    cleartext: !serverUrl.startsWith('https://'),
  },
};

export default config;
