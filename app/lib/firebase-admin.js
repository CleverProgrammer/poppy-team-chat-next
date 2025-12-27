import admin from 'firebase-admin'
import path from 'path'
import { fileURLToPath } from 'url'

// Get the directory of this file
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Path to service account (relative to project root)
const serviceAccountPath = path.join(__dirname, '../../functions/service-account.json')

// Initialize Firebase Admin SDK (only once)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountPath),
    projectId: 'poppy-team-chat',
  })
}

// Get Firestore instance
const adminDb = admin.firestore()

export { admin, adminDb }
