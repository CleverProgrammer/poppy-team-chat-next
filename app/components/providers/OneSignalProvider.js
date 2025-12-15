'use client';

import { useEffect, useRef } from 'react';
import OneSignal from 'react-onesignal';
import { useAuth } from '../../contexts/AuthContext';

export default function OneSignalProvider({ children }) {
  const { user } = useAuth();
  const isInitializedRef = useRef(false);

  useEffect(() => {
    // Only initialize OneSignal on the client side
    if (typeof window === 'undefined') return;

    const initializeOneSignal = async () => {
      const isProduction = window.location.hostname === 'poppyteamchat.com';

      // Only run OneSignal on production
      if (!isProduction) {
        console.log('OneSignal: Disabled on localhost. Will work on production (poppyteamchat.com)');
        return;
      }

      try {
        if (!process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID) {
          console.warn('OneSignal: NEXT_PUBLIC_ONESIGNAL_APP_ID not configured');
          return;
        }

        console.log('OneSignal: Initializing on production...');

        // Initialize OneSignal
        await OneSignal.init({
          appId: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID,
          safari_web_id: 'web.onesignal.auto.2c5a7aa8-83b4-45ba-8e8f-e5cd6a2881a0',
          serviceWorkerPath: '/OneSignalSDK.sw.js',
          notifyButton: {
            enable: true,
          },
        });

        console.log('OneSignal initialized successfully');
        isInitializedRef.current = true;

        // Set external user ID after initialization
        if (user?.uid) {
          await OneSignal.login(user.uid);
          console.log(`OneSignal: Set external user ID to ${user.uid}`);
        }
      } catch (error) {
        console.error('OneSignal initialization error:', error);
      }
    };

    initializeOneSignal();
  }, []);

  // Update external user ID when user changes (production only)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const isProduction = window.location.hostname === 'poppyteamchat.com';
    if (!isProduction) return;

    // Only call login if OneSignal is already initialized
    if (!isInitializedRef.current) return;

    const updateUserId = async () => {
      try {
        if (user?.uid) {
          await OneSignal.login(user.uid);
          console.log(`OneSignal: Updated external user ID to ${user.uid}`);
        }
      } catch (error) {
        console.error('OneSignal user ID update error:', error);
      }
    };

    updateUserId();
  }, [user?.uid]);

  return <>{children}</>;
}
