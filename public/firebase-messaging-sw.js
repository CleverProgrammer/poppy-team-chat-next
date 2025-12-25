// Firebase Cloud Messaging Service Worker for Web Push Notifications
// This runs in the background to receive notifications even when the browser tab is closed

importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: 'AIzaSyDnROY-nEeJrSmhLlVYEhqh68fst-eZD9k',
  authDomain: 'poppy-team-chat.firebaseapp.com',
  projectId: 'poppy-team-chat',
  storageBucket: 'poppy-team-chat.firebasestorage.app',
  messagingSenderId: '345107924402',
  appId: '1:345107924402:web:827c6b1323b3a8524610ab',
})

const messaging = firebase.messaging()

// Handle background messages using raw push event for reliability
self.addEventListener('push', (event) => {
  console.log('📬 [SW] Push event received:', event)

  if (!event.data) {
    console.log('📬 [SW] No data in push event')
    return
  }

  let payload
  try {
    payload = event.data.json()
    console.log('📬 [SW] Push payload:', payload)
  } catch (e) {
    console.error('📬 [SW] Failed to parse push data:', e)
    return
  }

  const { title, body } = payload.notification || {}
  const data = payload.data || {}

  console.log('📬 [SW] Showing notification:', { title, body, data })

  const notificationOptions = {
    body: body || 'You have a new message',
    icon: '/poppy-icon.png',
    badge: '/poppy-icon.png',
    tag: data.type === 'dm' ? `dm-${data.dmId}` : `channel-${data.channelId}`,
    data: data,
    requireInteraction: false,
    vibrate: [200, 100, 200],
  }

  // waitUntil ensures the notification is shown before SW terminates
  event.waitUntil(
    self.registration.showNotification(title || 'New Message', notificationOptions)
      .then(() => console.log('📬 [SW] ✅ Notification shown successfully'))
      .catch((err) => console.error('📬 [SW] ❌ Error showing notification:', err))
  )
})

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('👆 [SW] Notification clicked:', event)

  event.notification.close()

  if (event.action === 'dismiss') {
    return
  }

  const data = event.notification.data || {}

  // Focus or open the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it
      for (const client of clientList) {
        if (client.url.includes('localhost:3007') && 'focus' in client) {
          client.focus()
          // Send message to client to navigate to the chat
          client.postMessage({
            type: 'NOTIFICATION_CLICK',
            data: data,
          })
          return
        }
      }
      // Otherwise, open a new window
      if (clients.openWindow) {
        return clients.openWindow('/')
      }
    })
  )
})

// Log when service worker is installed/activated
self.addEventListener('install', (event) => {
  console.log('📬 [SW] Service worker installed')
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  console.log('📬 [SW] Service worker activated')
  event.waitUntil(clients.claim())
})
