import type { CapacitorConfig } from '@capacitor/cli';

// Set to true for local development, false for production
const useLocalDev = false;

const config: CapacitorConfig = {
  appId: 'com.poppyteamchat.app',
  appName: 'Poppy Chat',
  webDir: 'out',
  server: useLocalDev ? {
    // Local development - your Mac's IP (iPhone must be on same WiFi)
    url: 'http://192.168.1.252:3000',
    cleartext: true
  } : {
    // Production - deployed Vercel app
    url: 'https://poppyteamchat.com',
    cleartext: false
  },
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#000000',
    scrollEnabled: false
  },
  plugins: {
    Keyboard: {
      resizeOnFullScreen: true
    },
    PushNotifications: {
      presentationOptions: ['alert', 'badge', 'sound']
    }
  }
};

export default config;
