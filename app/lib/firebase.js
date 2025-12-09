import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDnROY-nEeJrSmhLlVYEhqh68fst-eZD9k",
  authDomain: "poppy-team-chat.firebaseapp.com",
  projectId: "poppy-team-chat",
  storageBucket: "poppy-team-chat.firebasestorage.app",
  messagingSenderId: "345107924402",
  appId: "1:345107924402:web:827c6b1323b3a8524610ab",
  measurementId: "G-GMWHB72P8V"
};

// Initialize Firebase only if it hasn't been initialized yet
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

// Force account selection every time user signs in
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export { app, auth, db, storage, googleProvider };
