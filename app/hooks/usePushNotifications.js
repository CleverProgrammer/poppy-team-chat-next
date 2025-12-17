'use client';

import { useEffect, useCallback } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

export function usePushNotifications(user) {
  const savePushToken = useCallback(async (token) => {
    if (!user?.uid) {
      console.warn('No user ID available for saving push token');
      return;
    }

    try {
      await setDoc(
        doc(db, 'users', user.uid),
        {
          pushToken: token,
          pushTokenUpdatedAt: serverTimestamp(),
          platform: 'ios',
        },
        { merge: true }
      );
      console.log('Push token saved to Firestore for user:', user.uid);
    } catch (error) {
      console.error('Error saving push token to Firestore:', error);
    }
  }, [user?.uid]);

  useEffect(() => {
    // Only run on native platforms
    if (!Capacitor.isNativePlatform()) {
      console.log('Push notifications: Web platform, skipping native setup');
      return;
    }

    if (!user?.uid) {
      console.log('Push notifications: No user logged in');
      return;
    }

    let cleanup = false;

    async function initializePushNotifications() {
      try {
        console.log('Initializing push notifications...');

        // Check/request permission
        let permStatus = await PushNotifications.checkPermissions();

        if (permStatus.receive === 'prompt') {
          permStatus = await PushNotifications.requestPermissions();
        }

        if (permStatus.receive !== 'granted') {
          console.warn('User denied push notification permissions');
          return;
        }

        // Register for push notifications
        await PushNotifications.register();
        console.log('Push notification registration requested');

        // Listen for registration success
        await PushNotifications.addListener('registration', async (token) => {
          if (cleanup) return;
          console.log('Push registration success, token:', token.value);
          await savePushToken(token.value);
        });

        // Listen for registration errors
        await PushNotifications.addListener('registrationError', (error) => {
          console.error('Push registration error:', error.error);
        });

        // Listen for incoming notifications (foreground)
        await PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('Push notification received:', notification);
          // Could show an in-app toast here
        });

        // Listen for notification taps
        await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
          console.log('Push notification action performed:', notification);
          // Could navigate to relevant chat here based on notification.notification.data
        });

      } catch (error) {
        console.error('Error initializing push notifications:', error);
      }
    }

    initializePushNotifications();

    return () => {
      cleanup = true;
      PushNotifications.removeAllListeners();
    };
  }, [user?.uid, savePushToken]);

  return { savePushToken };
}
