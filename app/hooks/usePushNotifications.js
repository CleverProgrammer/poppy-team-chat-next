'use client'

import { useEffect, useCallback, useRef } from 'react'
import { FirebaseMessaging } from '@capacitor-firebase/messaging'
import { LocalNotifications } from '@capacitor/local-notifications'
import { Capacitor } from '@capacitor/core'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { getMessaging, getToken, onMessage } from 'firebase/messaging'
import { db, app } from '../lib/firebase'

const LOG_PREFIX = '🔔 [PUSH]'

// VAPID key for web push notifications (from Firebase Console > Project Settings > Cloud Messaging)
const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY

export function usePushNotifications(user) {
  const webMessagingRef = useRef(null)

  console.log(
    `${LOG_PREFIX} Hook called - user:`,
    user?.uid || 'null',
    '| platform:',
    Capacitor.getPlatform(),
    '| isNative:',
    Capacitor.isNativePlatform()
  )

  // Helper function to navigate to chat from notification data
  const navigateToChat = useCallback((data) => {
    console.log(`${LOG_PREFIX} 🧭 navigateToChat called with:`, data)

    if (typeof window === 'undefined' || !window.__poppyNavigateToChat) {
      console.warn(`${LOG_PREFIX} ⚠️ Navigation function not available yet`)
      return
    }

    const { type, channelId, dmId, senderId, sender } = data

    if (type === 'channel' && channelId) {
      console.log(`${LOG_PREFIX} 🧭 Navigating to channel:`, channelId)
      window.__poppyNavigateToChat('channel', channelId, null, null)
    } else if (type === 'dm' && dmId) {
      console.log(`${LOG_PREFIX} 🧭 Navigating to DM:`, dmId, 'sender:', senderId, sender)
      window.__poppyNavigateToChat('dm', dmId, senderId, sender)
    } else {
      console.warn(`${LOG_PREFIX} ⚠️ Unknown notification type or missing ID:`, data)
    }
  }, [])

  // Check if notification should be suppressed (user is viewing that chat)
  const shouldSuppressNotification = useCallback((notifData) => {
    const activeChat = typeof window !== 'undefined' ? window.__poppyActiveChat : null

    if (!activeChat) return false

    if (notifData.type === 'dm' && activeChat.type === 'dm') {
      return activeChat.dmId === notifData.dmId
    } else if (notifData.type === 'channel' && activeChat.type === 'channel') {
      return activeChat.id === notifData.channelId
    }

    return false
  }, [])

  const savePushToken = useCallback(
    async (token, platform = 'ios') => {
      console.log(`${LOG_PREFIX} savePushToken called with token:`, token?.substring(0, 20) + '...')

      if (!user?.uid) {
        console.warn(`${LOG_PREFIX} No user ID available for saving push token`)
        return
      }

      try {
        console.log(`${LOG_PREFIX} Saving token to Firestore for user:`, user.uid, 'platform:', platform)
        await setDoc(
          doc(db, 'users', user.uid),
          {
            pushToken: token,
            pushTokenUpdatedAt: serverTimestamp(),
            platform: platform,
          },
          { merge: true }
        )
        console.log(`${LOG_PREFIX} ✅ Token saved successfully to Firestore`)
      } catch (error) {
        console.error(`${LOG_PREFIX} ❌ Error saving token to Firestore:`, error)
      }
    },
    [user?.uid]
  )

  // ==================== WEB PUSH NOTIFICATIONS ====================
  useEffect(() => {
    // Only run on web platforms
    if (Capacitor.isNativePlatform()) {
      console.log(`${LOG_PREFIX} ⏭️ Skipping web push - native platform`)
      return
    }

    if (!user?.uid) {
      console.log(`${LOG_PREFIX} ⏭️ Skipping web push - no user logged in yet`)
      return
    }

    if (typeof window === 'undefined') {
      return
    }

    // Check if browser supports notifications
    if (!('Notification' in window)) {
      console.warn(`${LOG_PREFIX} ❌ This browser does not support notifications`)
      return
    }

    if (!VAPID_KEY) {
      console.warn(`${LOG_PREFIX} ❌ VAPID key not configured - add NEXT_PUBLIC_FIREBASE_VAPID_KEY to .env.local`)
      return
    }

    console.log(`${LOG_PREFIX} 🌐 Initializing web push notifications for user:`, user.uid)

    let cleanup = false

    async function initializeWebPush() {
      try {
        // Register service worker
        console.log(`${LOG_PREFIX} Step 1: Registering service worker...`)
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
        console.log(`${LOG_PREFIX} ✅ Service worker registered:`, registration.scope)

        // Get messaging instance
        const messaging = getMessaging(app)
        webMessagingRef.current = messaging

        // Request notification permission
        console.log(`${LOG_PREFIX} Step 2: Checking notification permission...`)
        let permission = Notification.permission

        if (permission === 'default') {
          console.log(`${LOG_PREFIX} Requesting notification permission...`)
          permission = await Notification.requestPermission()
          console.log(`${LOG_PREFIX} Permission result:`, permission)
        }

        if (permission !== 'granted') {
          console.warn(`${LOG_PREFIX} ❌ Notification permission denied:`, permission)
          return
        }

        // Get FCM token for web
        console.log(`${LOG_PREFIX} Step 3: Getting FCM token for web...`)
        const token = await getToken(messaging, {
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: registration,
        })

        if (token) {
          console.log(`${LOG_PREFIX} ✅ Web FCM token received:`, token.substring(0, 30) + '...')
          if (!cleanup) {
            await savePushToken(token, 'web')
          }
        } else {
          console.warn(`${LOG_PREFIX} ❌ No FCM token received`)
        }

        // Listen for foreground messages
        console.log(`${LOG_PREFIX} Step 4: Setting up foreground message listener...`)
        onMessage(messaging, (payload) => {
          console.log(`${LOG_PREFIX} 📬 Foreground message received:`, payload)

          const notifData = payload.data || {}

          // Check if we should suppress this notification
          const shouldSuppress = shouldSuppressNotification(notifData)
          console.log(`${LOG_PREFIX} Should suppress:`, shouldSuppress, '| Active chat:', window.__poppyActiveChat)
          
          if (shouldSuppress) {
            console.log(`${LOG_PREFIX} ⏭️ Suppressing notification - user is viewing this chat`)
            return
          }

          // Show browser notification for foreground messages
          const { title, body } = payload.notification || {}
          console.log(`${LOG_PREFIX} 🔔 Showing notification - title:`, title, 'body:', body)
          
          if (Notification.permission === 'granted') {
            try {
              // Use service worker notification for better reliability
              registration.showNotification(title || 'New Message', {
                body: body || 'You have a new message',
                icon: '/poppy-icon.png',
                badge: '/poppy-icon.png',
                tag: notifData.type === 'dm' ? `dm-${notifData.dmId}` : `channel-${notifData.channelId}`,
                data: notifData,
                requireInteraction: false,
              })
              console.log(`${LOG_PREFIX} ✅ Notification shown via service worker`)
            } catch (err) {
              console.error(`${LOG_PREFIX} ❌ Error showing notification:`, err)
              // Fallback to regular Notification API
              const notification = new Notification(title || 'New Message', {
                body: body || 'You have a new message',
                icon: '/poppy-icon.png',
              })
              notification.onclick = () => {
                window.focus()
                notification.close()
                navigateToChat(notifData)
              }
            }
          } else {
            console.warn(`${LOG_PREFIX} ❌ Notification permission not granted:`, Notification.permission)
          }
        })

        // Listen for service worker messages (notification clicks from background)
        navigator.serviceWorker.addEventListener('message', (event) => {
          console.log(`${LOG_PREFIX} 📨 Message from service worker:`, event.data)
          if (event.data?.type === 'NOTIFICATION_CLICK') {
            navigateToChat(event.data.data)
          }
        })

        console.log(`${LOG_PREFIX} ✅ Web push notifications initialized successfully`)
      } catch (error) {
        console.error(`${LOG_PREFIX} ❌ Error initializing web push:`, error)
      }
    }

    initializeWebPush()

    return () => {
      console.log(`${LOG_PREFIX} 🧹 Web push cleanup`)
      cleanup = true
    }
  }, [user?.uid, savePushToken, shouldSuppressNotification, navigateToChat])

  // ==================== NATIVE (iOS/Android) PUSH NOTIFICATIONS ====================
  useEffect(() => {
    // Only run on native platforms
    if (!Capacitor.isNativePlatform()) {
      return
    }

    if (!user?.uid) {
      console.log(`${LOG_PREFIX} ⏭️ Skipping native push - no user logged in yet`)
      return
    }

    console.log(
      `${LOG_PREFIX} 📱 Initializing native push notifications for user:`,
      user.uid
    )

    let cleanup = false

    async function initializeNativePush() {
      try {
        console.log(`${LOG_PREFIX} Step 1: Checking permissions...`)
        let permStatus = await FirebaseMessaging.checkPermissions()
        console.log(`${LOG_PREFIX} Current permission status:`, permStatus.receive)

        if (permStatus.receive === 'prompt') {
          console.log(`${LOG_PREFIX} Step 2: Requesting permissions (status was "prompt")...`)
          permStatus = await FirebaseMessaging.requestPermissions()
          console.log(`${LOG_PREFIX} Permission after request:`, permStatus.receive)
        }

        if (permStatus.receive !== 'granted') {
          console.warn(`${LOG_PREFIX} ❌ Permission denied - status:`, permStatus.receive)
          return
        }

        console.log(`${LOG_PREFIX} ✅ Permission granted - setting up listeners...`)

        // Listen for token updates
        await FirebaseMessaging.addListener('tokenReceived', async event => {
          console.log(`${LOG_PREFIX} 🎉 Token received:`, event.token?.substring(0, 30) + '...')
          if (cleanup) return
          await savePushToken(event.token, 'ios')
        })

        // Listen for notifications in foreground
        await FirebaseMessaging.addListener('notificationReceived', async event => {
          const notification = event.notification
          console.log(
            `${LOG_PREFIX} 📬 Notification RECEIVED (foreground):`,
            JSON.stringify(notification)
          )

          const notifData = notification.data || {}

          if (shouldSuppressNotification(notifData)) {
            console.log(`${LOG_PREFIX} ⏭️ Suppressing notification - user is viewing this chat`)
            return
          }

          // Show local notification
          try {
            await LocalNotifications.schedule({
              notifications: [
                {
                  title: notification.title || 'New Message',
                  body: notification.body || '',
                  id: Date.now(),
                  schedule: { at: new Date(Date.now() + 100) },
                  sound: 'default',
                  extra: notifData,
                },
              ],
            })
            console.log(`${LOG_PREFIX} ✅ Local notification scheduled`)
          } catch (error) {
            console.error(`${LOG_PREFIX} ❌ Error scheduling local notification:`, error)
          }
        })

        // Listen for notification taps
        await FirebaseMessaging.addListener('notificationActionPerformed', event => {
          console.log(`${LOG_PREFIX} 👆 Push Notification TAPPED:`, JSON.stringify(event))
          const data = event.notification?.data || {}
          navigateToChat(data)
        })

        // Listen for local notification taps
        await LocalNotifications.addListener('localNotificationActionPerformed', notification => {
          console.log(`${LOG_PREFIX} 👆 Local Notification TAPPED:`, JSON.stringify(notification))
          const data = notification.notification?.extra || {}
          navigateToChat(data)
        })

        // Get the FCM token
        console.log(`${LOG_PREFIX} Step 4: Getting FCM token...`)
        const result = await FirebaseMessaging.getToken()
        console.log(`${LOG_PREFIX} ✅ FCM token received:`, result.token?.substring(0, 30) + '...')

        if (!cleanup) {
          await savePushToken(result.token, 'ios')
        }
      } catch (error) {
        console.error(
          `${LOG_PREFIX} ❌ Error in initializeNativePush:`,
          error.message,
          error
        )
      }
    }

    initializeNativePush()

    return () => {
      console.log(`${LOG_PREFIX} 🧹 Native push cleanup - removing listeners`)
      cleanup = true
      FirebaseMessaging.removeAllListeners()
      LocalNotifications.removeAllListeners()
    }
  }, [user?.uid, savePushToken, shouldSuppressNotification, navigateToChat])

  return { savePushToken }
}
