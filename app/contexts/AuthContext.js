'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  EmailAuthProvider,
  linkWithCredential
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { saveUser } from '../lib/firestore';
import { Capacitor } from '@capacitor/core';
import { usePushNotifications } from '../hooks/usePushNotifications';

const AuthContext = createContext({});

// Cache key for localStorage
const USER_CACHE_KEY = 'poppy_cached_user';

// Helper to get cached user from localStorage
function getCachedUser() {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(USER_CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {
    console.warn('Failed to parse cached user:', e);
  }
  return null;
}

// Helper to cache user to localStorage
function cacheUser(user) {
  if (typeof window === 'undefined') return;
  if (user) {
    // Only cache essential user data (not the full Firebase user object)
    const userData = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
    };
    localStorage.setItem(USER_CACHE_KEY, JSON.stringify(userData));
  } else {
    localStorage.removeItem(USER_CACHE_KEY);
  }
}

export function AuthProvider({ children }) {
  // Always start with null/true for consistent SSR hydration
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize push notifications for iOS
  usePushNotifications(user);

  useEffect(() => {
    // IMMEDIATELY check cache on mount - before Firebase responds
    const cachedUser = getCachedUser();
    if (cachedUser) {
      console.log('⚡ Instant load from cache:', cachedUser.email);
      setUser(cachedUser);
      setLoading(false); // Immediately stop loading!
    }

    // Check for redirect result (for Capacitor/mobile)
    getRedirectResult(auth)
      .then(async (result) => {
        if (result?.user) {
          console.log('🔵 User logged in via redirect:', result.user.email);
          await saveUser(result.user);
        }
      })
      .catch((error) => {
        console.error('Redirect result error:', error);
      });

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        console.log('🔵 Firebase confirmed user:', firebaseUser.email);
        await saveUser(firebaseUser);
        // Cache user for instant load on next visit
        cacheUser(firebaseUser);
        setUser(firebaseUser);
      } else {
        // User signed out - clear cache
        cacheUser(null);
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      // Use redirect for native apps (Capacitor), popup for web
      if (Capacitor.isNativePlatform()) {
        await signInWithRedirect(auth, googleProvider);
      } else {
        await signInWithPopup(auth, googleProvider);
      }
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  };

  const signUpWithEmail = async (email, password, displayName) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName });
    } catch (error) {
      console.error('Sign up error:', error);
      throw error;
    }
  };

  const signInWithEmail = async (email, password) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      // Clear cache BEFORE signing out for instant feedback
      cacheUser(null);
      await firebaseSignOut(auth);
    } catch (error) {
      console.error('Sign out error:', error);
      alert('Failed to sign out. Please try again.');
    }
  };

  // Add email/password provider to existing Google account
  const setPasswordForAccount = async (password) => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser || !currentUser.email) {
        throw new Error('No user logged in or no email associated');
      }

      // Create email/password credential and link it to the current user
      const credential = EmailAuthProvider.credential(currentUser.email, password);
      await linkWithCredential(currentUser, credential);

      console.log('🔵 Password added to account:', currentUser.email);
    } catch (error) {
      console.error('Set password error:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signInWithEmail, signUpWithEmail, signOut, setPasswordForAccount }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
