import admin from 'firebase-admin'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

// Get the directory of this file
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Initialize Firebase Admin SDK (only once)
if (!admin.apps.length) {
  let credential

  // Try environment variable first (for Vercel/production)
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
      credential = admin.credential.cert(serviceAccount)
      console.log('🔥 Firebase Admin: Using FIREBASE_SERVICE_ACCOUNT_KEY env var')
    } catch (e) {
      console.error('🔥 Firebase Admin: Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:', e.message)
    }
  }

  // Fallback to local file (for development)
  if (!credential) {
    const serviceAccountPath = path.join(__dirname, '../../functions/service-account.json')
    if (fs.existsSync(serviceAccountPath)) {
      credential = admin.credential.cert(serviceAccountPath)
      console.log('🔥 Firebase Admin: Using local service-account.json')
    } else {
      console.warn('🔥 Firebase Admin: No credentials found! Set FIREBASE_SERVICE_ACCOUNT_KEY env var or add functions/service-account.json')
      // Initialize without credentials (will fail on actual Firestore calls)
      credential = admin.credential.applicationDefault()
    }
  }

  admin.initializeApp({
    credential,
    projectId: 'poppy-team-chat',
    storageBucket: 'poppy-team-chat.firebasestorage.app',
  })
}

// Get Firestore instance
const adminDb = admin.firestore()

// Get Storage instance
const adminStorage = admin.storage()

export { admin, adminDb, adminStorage }
