import type { CapacitorConfig } from '@capacitor/cli'

// Auto-detect: use local dev server unless CAPACITOR_BUILD=production
// For TestFlight: run `CAPACITOR_BUILD=production yarn ios:sync`
// For local dev:  run `yarn ios:sync` (defaults to local)
const isProduction = process.env.CAPACITOR_BUILD === 'production'

const config: CapacitorConfig = {
  appId: 'com.poppyteamchat.app',
  appName: 'Poppy Chat',
  webDir: 'out',
  server: isProduction
    ? {
        // Production - deployed Vercel app (for TestFlight/App Store builds)
        url: 'https://poppyteamchat.com',
        cleartext: false,
      }
    : {
        // Local development - your Mac's IP (iPhone must be on same WiFi)
        url: 'http://192.168.1.252:3007',
        cleartext: true,
      },
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#000000',
    scrollEnabled: false,
  },
  plugins: {
    Keyboard: {
      resizeOnFullScreen: true,
    },
    FirebaseMessaging: {
      // Don't auto-show anything in foreground - we control it manually to suppress
      // notifications (including sound) when user is already viewing that chat
      presentationOptions: [],
    },
  },
}

export default config
