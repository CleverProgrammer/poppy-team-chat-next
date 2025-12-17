'use client';

import { useEffect, useCallback } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

const LOG_PREFIX = '🔔 [PUSH]';

export function usePushNotifications(user) {
  console.log(`${LOG_PREFIX} Hook called - user:`, user?.uid || 'null', '| platform:', Capacitor.getPlatform(), '| isNative:', Capacitor.isNativePlatform());

  const savePushToken = useCallback(async (token) => {
    console.log(`${LOG_PREFIX} savePushToken called with token:`, token?.substring(0, 20) + '...');

    if (!user?.uid) {
      console.warn(`${LOG_PREFIX} No user ID available for saving push token`);
      return;
    }

    try {
      console.log(`${LOG_PREFIX} Saving token to Firestore for user:`, user.uid);
      await setDoc(
        doc(db, 'users', user.uid),
        {
          pushToken: token,
          pushTokenUpdatedAt: serverTimestamp(),
          platform: 'ios',
        },
        { merge: true }
      );
      console.log(`${LOG_PREFIX} ✅ Token saved successfully to Firestore`);
    } catch (error) {
      console.error(`${LOG_PREFIX} ❌ Error saving token to Firestore:`, error);
    }
  }, [user?.uid]);

  useEffect(() => {
    console.log(`${LOG_PREFIX} useEffect triggered - user?.uid:`, user?.uid, '| isNative:', Capacitor.isNativePlatform());

    // Only run on native platforms
    if (!Capacitor.isNativePlatform()) {
      console.log(`${LOG_PREFIX} ⏭️ Skipping - not native platform (platform: ${Capacitor.getPlatform()})`);
      return;
    }

    if (!user?.uid) {
      console.log(`${LOG_PREFIX} ⏭️ Skipping - no user logged in yet`);
      return;
    }

    console.log(`${LOG_PREFIX} ✅ Conditions met - initializing push notifications for user:`, user.uid);

    let cleanup = false;

    async function initializePushNotifications() {
      try {
        console.log(`${LOG_PREFIX} Step 1: Checking permissions...`);
        let permStatus = await PushNotifications.checkPermissions();
        console.log(`${LOG_PREFIX} Current permission status:`, permStatus.receive);

        if (permStatus.receive === 'prompt') {
          console.log(`${LOG_PREFIX} Step 2: Requesting permissions (status was "prompt")...`);
          permStatus = await PushNotifications.requestPermissions();
          console.log(`${LOG_PREFIX} Permission after request:`, permStatus.receive);
        }

        if (permStatus.receive !== 'granted') {
          console.warn(`${LOG_PREFIX} ❌ Permission denied - status:`, permStatus.receive);
          return;
        }

        console.log(`${LOG_PREFIX} ✅ Permission granted - registering for push notifications...`);

        // Set up listeners BEFORE calling register
        console.log(`${LOG_PREFIX} Step 3: Setting up listeners...`);

        await PushNotifications.addListener('registration', async (token) => {
          console.log(`${LOG_PREFIX} 🎉 Registration SUCCESS! Token:`, token.value?.substring(0, 30) + '...');
          if (cleanup) {
            console.log(`${LOG_PREFIX} Cleanup flag set, skipping token save`);
            return;
          }
          await savePushToken(token.value);
        });

        await PushNotifications.addListener('registrationError', (error) => {
          console.error(`${LOG_PREFIX} ❌ Registration ERROR:`, JSON.stringify(error));
        });

        await PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log(`${LOG_PREFIX} 📬 Notification RECEIVED (foreground):`, JSON.stringify(notification));
          // AGGRESSIVE MODE: Show alert even when app is in foreground
          if (typeof window !== 'undefined' && notification.title) {
            alert(`🔔 ${notification.title}\n${notification.body || ''}`);
          }
        });

        await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
          console.log(`${LOG_PREFIX} 👆 Notification TAPPED:`, JSON.stringify(notification));
        });

        console.log(`${LOG_PREFIX} Step 4: Calling register()...`);
        await PushNotifications.register();
        console.log(`${LOG_PREFIX} ✅ register() completed - waiting for registration callback...`);

      } catch (error) {
        console.error(`${LOG_PREFIX} ❌ Error in initializePushNotifications:`, error.message, error);
      }
    }

    initializePushNotifications();

    return () => {
      console.log(`${LOG_PREFIX} 🧹 Cleanup - removing listeners`);
      cleanup = true;
      PushNotifications.removeAllListeners();
    };
  }, [user?.uid, savePushToken]);

  return { savePushToken };
}
