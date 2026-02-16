This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
 

Packaging as Android APK (Capacitor)
----------------------------------

Prerequisites:
- Node.js and npm installed
- Android Studio and Android SDK (for building the APK)
- Java JDK (required by Android Gradle)

Steps to scaffold and build an Android APK from this web app:

1. Install Capacitor CLI and core (run in project root):

```bash
npm install @capacitor/core @capacitor/cli --save-dev
```

2. Initialize Capacitor (only once):

```bash
npm run cap:init
```

3. Build the web app and copy to the native project:

```bash
npm run cap:copy
```

4. Add the Android platform (first time):

```bash
npm run cap:add-android
```

5. Open the Android project in Android Studio to sign and build, or build from the CLI:

```bash
npm run cap:open-android
# OR build an APK from CLI (Linux/macOS example)
npm run build:apk
```

Notes:
- The facial login uses the browser camera API (`navigator.mediaDevices.getUserMedia`), which requires a secure context. When running inside the Android WebView provided by Capacitor this generally works, but you should test on device and handle camera permissions in the native layer if needed.
- You must configure signing (release keystore) in the Android project before producing a signed release APK.

If you want, I can:
- add these files/scripts (done),
- run `npm install` and scaffold Capacitor here (requires network and Android SDK installed), or
- walk you step-by-step through running the commands on your machine.

  
