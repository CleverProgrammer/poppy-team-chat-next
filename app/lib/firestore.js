import {
  doc,
  setDoc,
  getDoc,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  getDocs,
  collectionGroup,
  updateDoc,
  deleteDoc,
  arrayUnion,
  limit,
  startAfter,
  increment,
  where,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from './firebase'

// Fun adjectives and animals for human-readable task IDs
const TASK_ID_ADJECTIVES = [
  'swift',
  'brave',
  'calm',
  'eager',
  'fair',
  'gentle',
  'happy',
  'keen',
  'lucky',
  'merry',
  'neat',
  'proud',
  'quick',
  'sharp',
  'warm',
  'wise',
  'bold',
  'cool',
  'fresh',
  'grand',
  'bright',
  'clever',
  'cosmic',
  'epic',
]

const TASK_ID_ANIMALS = [
  'panda',
  'tiger',
  'eagle',
  'fox',
  'wolf',
  'bear',
  'hawk',
  'lion',
  'owl',
  'raven',
  'shark',
  'whale',
  'falcon',
  'phoenix',
  'dragon',
  'koala',
  'otter',
  'badger',
  'lynx',
  'jaguar',
  'cobra',
  'viper',
  'crane',
  'heron',
]

/**
 * Generate a human-readable task ID
 * Format: first_few_words_adjective_animal_123456
 * Example: bring_cookies_swift_panda_a1b2c3
 */
function generateTaskId(text) {
  // Extract first 2-3 meaningful words from the text
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove special chars
    .split(/\s+/)
    .filter(
      w =>
        w.length > 2 &&
        ![
          'the',
          'and',
          'for',
          'you',
          'please',
          'can',
          'could',
          'would',
          'should',
          'hey',
          'hi',
        ].includes(w)
    )
    .slice(0, 3)

  const slug = words.join('_') || 'task'

  // Pick random adjective and animal
  const adjective = TASK_ID_ADJECTIVES[Math.floor(Math.random() * TASK_ID_ADJECTIVES.length)]
  const animal = TASK_ID_ANIMALS[Math.floor(Math.random() * TASK_ID_ANIMALS.length)]

  // Generate 6-char random suffix
  const suffix = Math.random().toString(36).substring(2, 8)

  return `${slug}_${adjective}_${animal}_${suffix}`
}

// Helper to save canonical tags to Firestore for persistence
async function saveCanonicalTag(aiTags) {
  if (!aiTags?.canonical_tag || aiTags.type === 'noise') return

  try {
    // Base update for any canonical tag
    const updateData = {
      name: aiTags.canonical_tag,
      count: increment(1),
      lastSeen: serverTimestamp(),
    }

    // Only set type/summary if this is the original (not an endorsement)
    if (aiTags.type !== 'endorsement') {
      updateData.type = aiTags.type || 'unknown'
      if (aiTags.summary) updateData.summary = aiTags.summary
    }

    // If this is an endorsement, track the vote
    if (aiTags.type === 'endorsement' && aiTags.endorser) {
      updateData.votes = increment(1)
      updateData.voters = arrayUnion(aiTags.endorser)
    }

    await setDoc(doc(db, 'canonical_tags', aiTags.canonical_tag), updateData, { merge: true })
  } catch (err) {
    console.warn('Failed to save canonical tag:', err)
  }
}

export async function saveUser(user) {
  if (!user) return

  try {
    await setDoc(
      doc(db, 'users', user.uid),
      {
        uid: user.uid,
        displayName: user.displayName || user.email,
        email: user.email,
        photoURL: user.photoURL || '',
        lastSeen: serverTimestamp(),
      },
      { merge: true }
    )
  } catch (error) {
    console.error('Error saving user:', error)
  }
}

export async function sendMessage(channelId, user, text, linkPreview = null, options = {}) {
  if (!user || !text.trim()) return

  const { isPrivate = false, privateFor = null } = options

  try {
    const messagesRef = collection(db, 'channels', channelId, 'messages')
    const messageData = {
      text: text,
      sender: user.displayName || user.email,
      senderId: user.uid,
      photoURL: user.photoURL || '',
      timestamp: serverTimestamp(),
    }

    // Add link preview if present
    if (linkPreview) {
      messageData.linkPreview = linkPreview
    }

    // Add private flag if message is private
    if (isPrivate) {
      messageData.isPrivate = true
      // Use explicitly passed privateFor, or fall back to sender's uid
      messageData.privateFor = privateFor || user.uid
    }

    const docRef = await addDoc(messagesRef, messageData)

    // Tag and index to Ragie (fire and forget, don't block send)
    // When tags come back, save them to Firestore for UI display
    fetch('/api/tag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messageId: docRef.id,
        chatId: channelId,
        chatType: 'channel',
        text,
        sender: user.displayName || user.email,
        senderEmail: user.email,
        senderId: user.uid,
        timestamp: new Date().toISOString(),
      }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.aiTags) {
          updateDoc(doc(db, 'channels', channelId, 'messages', docRef.id), {
            aiTags: data.aiTags,
          }).catch(err => console.warn('Failed to save tags to Firestore:', err))
          saveCanonicalTag(data.aiTags)
        }
      })
      .catch(err => console.error('Tagging failed:', err))
  } catch (error) {
    console.error('Error sending message:', error)
    throw error
  }
}

export function subscribeToMessages(channelId, callback, messageLimit = 50) {
  const messagesRef = collection(db, 'channels', channelId, 'messages')
  const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(messageLimit))

  return onSnapshot(
    q,
    snapshot => {
      const messages = []
      snapshot.forEach(doc => {
        messages.push({
          id: doc.id,
          ...doc.data(),
        })
      })
      callback(messages.reverse()) // Reverse to show oldest->newest
    },
    error => {
      console.error('Error loading messages:', error)
    }
  )
}

export function subscribeToMessagesDM(dmId, callback, messageLimit = 50) {
  const messagesRef = collection(db, 'dms', dmId, 'messages')
  const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(messageLimit))

  return onSnapshot(
    q,
    snapshot => {
      const messages = []
      snapshot.forEach(doc => {
        messages.push({
          id: doc.id,
          ...doc.data(),
        })
      })
      callback(messages.reverse()) // Reverse to show oldest->newest
    },
    error => {
      console.error('Error loading messages:', error)
    }
  )
}

// Load older messages for infinite scroll
export async function loadOlderMessages(channelId, oldestTimestamp, messageLimit = 50) {
  const messagesRef = collection(db, 'channels', channelId, 'messages')
  const q = query(
    messagesRef,
    orderBy('timestamp', 'desc'),
    startAfter(oldestTimestamp),
    limit(messageLimit)
  )

  const snapshot = await getDocs(q)
  const messages = []
  snapshot.forEach(doc => {
    messages.push({
      id: doc.id,
      ...doc.data(),
    })
  })
  return messages.reverse()
}

export async function loadOlderMessagesDM(dmId, oldestTimestamp, messageLimit = 50) {
  const messagesRef = collection(db, 'dms', dmId, 'messages')
  const q = query(
    messagesRef,
    orderBy('timestamp', 'desc'),
    startAfter(oldestTimestamp),
    limit(messageLimit)
  )

  const snapshot = await getDocs(q)
  const messages = []
  snapshot.forEach(doc => {
    messages.push({
      id: doc.id,
      ...doc.data(),
    })
  })
  return messages.reverse()
}

export async function sendMessageDM(
  dmId,
  user,
  text,
  recipientId,
  recipient = null,
  linkPreview = null,
  options = {}
) {
  if (!user || !text.trim()) return

  const { isPrivate = false, privateFor = null } = options

  console.log('═══════════════════════════════════════════════════════════')
  console.log('📤 [SEND DM] SENDING MESSAGE')
  console.log('═══════════════════════════════════════════════════════════')
  console.log(`📨 DM ID: ${dmId}`)
  console.log(`👤 Sender: ${user.displayName || user.email} (${user.uid})`)
  console.log(`🎯 Recipient ID: ${recipientId}`)
  console.log(`💬 Text: "${text.substring(0, 50)}..."`)
  console.log(`🔒 Private: ${isPrivate}`)
  console.log('───────────────────────────────────────────────────────────')

  try {
    const messagesRef = collection(db, 'dms', dmId, 'messages')
    console.log('📝 Writing to Firestore: dms/' + dmId + '/messages')

    const messageData = {
      text: text,
      sender: user.displayName || user.email,
      senderId: user.uid,
      photoURL: user.photoURL || '',
      timestamp: serverTimestamp(),
    }

    // Add link preview if present
    if (linkPreview) {
      messageData.linkPreview = linkPreview
    }

    // Add private flag if message is private
    if (isPrivate) {
      messageData.isPrivate = true
      messageData.privateFor = privateFor || user.uid
    }

    const docRef = await addDoc(messagesRef, messageData)

    console.log('✅ [SEND DM] Message written to Firestore!')
    console.log(`📝 Document ID: ${docRef.id}`)
    console.log('🔔 Firebase Cloud Function should trigger now...')
    console.log('═══════════════════════════════════════════════════════════')

    // Tag and index to Ragie (fire and forget, don't block send)
    fetch('/api/tag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messageId: docRef.id,
        chatId: dmId,
        chatType: 'dm',
        text,
        sender: user.displayName || user.email,
        senderEmail: user.email,
        senderId: user.uid,
        timestamp: new Date().toISOString(),
        participants: dmId.split('_').slice(1), // Extract user IDs from dmId
        // Recipient info for DMs
        recipientId: recipientId,
        recipientName: recipient?.displayName || recipient?.email || null,
        recipientEmail: recipient?.email || null,
      }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.aiTags) {
          updateDoc(doc(db, 'dms', dmId, 'messages', docRef.id), { aiTags: data.aiTags }).catch(
            err => console.warn('Failed to save tags to Firestore:', err)
          )
          saveCanonicalTag(data.aiTags)

          // Log what the AI tagged this as
          console.log('🏷️ AI Tag Result:', {
            type: data.aiTags.type,
            canonical: data.aiTags.canonical_tag,
            summary: data.aiTags.summary,
          })

          // AI signals task intent via task_action field
          if (data.aiTags.task_action) {
            console.log('📋 AI task_action:', data.aiTags.task_action)
            createTaskFromMessage(dmId, 'dm', docRef.id, text, user, recipient, data.aiTags)
          }
        }
      })
      .catch(err => console.error('Tagging failed:', err))

    // Add both users to each other's active DMs
    if (recipientId) {
      await addActiveDM(user.uid, recipientId)
      await addActiveDM(recipientId, user.uid)
    }
  } catch (error) {
    console.error('Error sending message:', error)
    throw error
  }
}

export function subscribeToUsers(callback) {
  return onSnapshot(
    collection(db, 'users'),
    snapshot => {
      const users = []
      snapshot.forEach(doc => {
        users.push({
          id: doc.id,
          ...doc.data(),
        })
      })
      callback(users)
    },
    error => {
      console.error('Error loading users:', error)
    }
  )
}

export function getDMId(userId1, userId2) {
  return [userId1, userId2].sort().join('_')
}

export async function saveCurrentChat(userId, chatData) {
  if (!userId) return

  console.log('📌 [Firestore] saveCurrentChat called with:', { userId, chatData })
  try {
    await setDoc(
      doc(db, 'users', userId),
      {
        currentChat: chatData,
        lastSeen: serverTimestamp(),
      },
      { merge: true }
    )
    console.log('📌 [Firestore] saveCurrentChat SUCCESS')
  } catch (error) {
    console.error('Error saving current chat:', error)
  }
}

export async function getCurrentChat(userId) {
  if (!userId) return null

  console.log('📌 [Firestore] getCurrentChat called for userId:', userId)
  try {
    const userDoc = await getDoc(doc(db, 'users', userId))
    if (userDoc.exists()) {
      const data = userDoc.data()
      console.log('📌 [Firestore] getCurrentChat found:', data?.currentChat)
      return data?.currentChat || null
    }
    console.log('📌 [Firestore] getCurrentChat - user doc does not exist')
    return null
  } catch (error) {
    console.error('Error loading current chat:', error)
    return null
  }
}

export async function addActiveDM(userId, dmUserId) {
  if (!userId || !dmUserId) return

  try {
    await setDoc(
      doc(db, 'users', userId),
      {
        activeDMs: arrayUnion(dmUserId),
        lastSeen: serverTimestamp(),
      },
      { merge: true }
    )
  } catch (error) {
    console.error('Error adding active DM:', error)
  }
}

export function subscribeToActiveDMs(userId, callback) {
  if (!userId) return () => {}

  return onSnapshot(
    doc(db, 'users', userId),
    snapshot => {
      if (snapshot.exists()) {
        const data = snapshot.data()
        callback(data?.activeDMs || [])
      } else {
        callback([])
      }
    },
    error => {
      console.error('Error loading active DMs:', error)
      callback([])
    }
  )
}

// Subscribe to last message for each DM (for sidebar previews)
// Filters out private messages so they don't show in preview
export function subscribeToLastMessages(userId, dmUserIds, callback) {
  if (!userId || !dmUserIds || dmUserIds.length === 0) {
    callback({})
    return () => {}
  }

  const unsubscribes = []
  const lastMessages = {}
  // Track last known message IDs to prevent unnecessary callbacks when private messages are added
  const lastMessageIds = {}

  dmUserIds.forEach(otherUserId => {
    const dmId = getDMId(userId, otherUserId)
    const messagesRef = collection(db, 'dms', dmId, 'messages')
    // Get more messages to find first non-private one
    const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(10))

    const unsubscribe = onSnapshot(
      q,
      snapshot => {
        let newMessageId = null
        let newMessage = null

        if (!snapshot.empty) {
          // Find the first message that's NOT private (or is private but visible to this user)
          const visibleMessage = snapshot.docs.find(doc => {
            const data = doc.data()
            // Show if: not private, OR private but for this user, OR sent by this user
            return !data.isPrivate || data.privateFor === userId || data.senderId === userId
          })

          if (visibleMessage) {
            newMessageId = visibleMessage.id
            newMessage = {
              id: visibleMessage.id,
              ...visibleMessage.data(),
            }
          }
        }

        // Only update and callback if the visible last message has actually changed
        // This prevents re-renders when private messages from other users are added
        if (lastMessageIds[otherUserId] !== newMessageId) {
          lastMessageIds[otherUserId] = newMessageId
          lastMessages[otherUserId] = newMessage
          callback({ ...lastMessages })
        }
      },
      error => {
        console.error(`Error loading last message for DM ${dmId}:`, error)
      }
    )
    unsubscribes.push(unsubscribe)
  })

  // Return cleanup function
  return () => {
    unsubscribes.forEach(unsub => unsub())
  }
}

// Subscribe to last message for channels (for sidebar previews)
// Filters out private messages so they don't show in preview
// Note: userId is needed to check if private messages are visible to the current user
export function subscribeToChannelLastMessages(channelIds, callback, userId = null) {
  if (!channelIds || channelIds.length === 0) {
    callback({})
    return () => {}
  }

  const unsubscribes = []
  const lastMessages = {}
  // Track last known message IDs to prevent unnecessary callbacks when private messages are added
  const lastMessageIds = {}

  channelIds.forEach(channelId => {
    const messagesRef = collection(db, 'channels', channelId, 'messages')
    // Get more messages to find first non-private one
    const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(10))

    const unsubscribe = onSnapshot(
      q,
      snapshot => {
        let newMessageId = null
        let newMessage = null

        if (!snapshot.empty) {
          // Find the first message that's NOT private (or is private but visible to this user)
          const visibleMessage = snapshot.docs.find(doc => {
            const data = doc.data()
            // Show if: not private, OR private but for this user, OR sent by this user
            return (
              !data.isPrivate ||
              (userId && (data.privateFor === userId || data.senderId === userId))
            )
          })

          if (visibleMessage) {
            newMessageId = visibleMessage.id
            newMessage = {
              id: visibleMessage.id,
              ...visibleMessage.data(),
            }
          }
        }

        // Only update and callback if the visible last message has actually changed
        // This prevents re-renders when private messages from other users are added
        if (lastMessageIds[channelId] !== newMessageId) {
          lastMessageIds[channelId] = newMessageId
          lastMessages[channelId] = newMessage
          callback({ ...lastMessages })
        }
      },
      error => {
        console.error(`Error loading last message for channel ${channelId}:`, error)
      }
    )
    unsubscribes.push(unsubscribe)
  })

  return () => {
    unsubscribes.forEach(unsub => unsub())
  }
}

// Subscribe to last AI message (for sidebar preview)
export function subscribeToAILastMessage(userId, callback) {
  if (!userId) {
    callback(null)
    return () => {}
  }

  const messagesRef = collection(db, 'users', userId, 'ai-chat')
  const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(1))

  return onSnapshot(
    q,
    snapshot => {
      if (!snapshot.empty) {
        const doc = snapshot.docs[0]
        callback({
          id: doc.id,
          ...doc.data(),
        })
      } else {
        callback(null)
      }
    },
    error => {
      console.error('Error loading last AI message:', error)
      callback(null)
    }
  )
}

export async function discoverExistingDMs(userId) {
  if (!userId) return

  try {
    // Query all messages in DM subcollections (much more efficient)
    const q = query(collectionGroup(db, 'messages'))
    const messagesSnapshot = await getDocs(q)
    const dmUserIds = new Set()

    // Extract DM IDs from paths where this user is involved
    messagesSnapshot.forEach(messageDoc => {
      const pathParts = messageDoc.ref.path.split('/')
      // Path format: dms/{dmId}/messages/{messageId}
      if (pathParts[0] === 'dms' && pathParts.length >= 2) {
        const dmId = pathParts[1]
        const [user1, user2] = dmId.split('_')

        // Check if current user is involved in this DM
        if (user1 === userId || user2 === userId) {
          const otherUserId = user1 === userId ? user2 : user1
          if (otherUserId !== userId) {
            dmUserIds.add(otherUserId)
          }
        }
      }
    })

    const existingDMs = Array.from(dmUserIds)

    // Update the user's activeDMs in Firestore
    if (existingDMs.length > 0) {
      await setDoc(
        doc(db, 'users', userId),
        {
          activeDMs: existingDMs,
          lastSeen: serverTimestamp(),
        },
        { merge: true }
      )
    }
  } catch (error) {
    console.error('Error discovering existing DMs:', error)
  }
}

// Media upload helper function (images and videos)
// Helper function to get image dimensions from a file
export function getImageDimensions(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      resolve(null) // Not an image, skip
      return
    }

    const img = new Image()
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
      URL.revokeObjectURL(img.src) // Clean up
    }
    img.onerror = () => {
      console.warn('Failed to get image dimensions')
      resolve(null)
    }
    img.src = URL.createObjectURL(file)
  })
}

// Helper function to get video dimensions from a file
export function getVideoDimensions(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('video/')) {
      resolve(null) // Not a video, skip
      return
    }

    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      resolve({ width: video.videoWidth, height: video.videoHeight })
      URL.revokeObjectURL(video.src) // Clean up
    }
    video.onerror = () => {
      console.warn('Failed to get video dimensions')
      resolve(null)
    }
    video.src = URL.createObjectURL(file)
  })
}

export async function uploadImage(file, userId) {
  if (!file) throw new Error('No file provided')

  try {
    // Generate unique filename with timestamp
    const timestamp = Date.now()
    const filename = `${userId}/${timestamp}_${file.name}`
    // Use chat-media folder for all media types
    const folder = file.type.startsWith('video/') ? 'chat-videos' : 'chat-images'
    const storageRef = ref(storage, `${folder}/${filename}`)

    // Upload the file
    const snapshot = await uploadBytes(storageRef, file)

    // Get download URL
    const downloadURL = await getDownloadURL(snapshot.ref)

    return downloadURL
  } catch (error) {
    console.error('Error uploading media:', error)
    throw error
  }
}

// Upload audio file to Firebase Storage
export async function uploadAudio(blob, userId) {
  if (!blob) throw new Error('No audio blob provided')

  try {
    // Generate unique filename with timestamp
    const timestamp = Date.now()
    const filename = `${userId}/${timestamp}_voice.webm`
    const storageRef = ref(storage, `chat-audio/${filename}`)

    // Convert blob to File for upload
    const audioFile = new File([blob], filename, { type: 'audio/webm' })

    // Upload the file
    const snapshot = await uploadBytes(storageRef, audioFile)

    // Get download URL
    const downloadURL = await getDownloadURL(snapshot.ref)

    return downloadURL
  } catch (error) {
    console.error('Error uploading audio:', error)
    throw error
  }
}

// Send message with image(s)
// imageUrl can be a single URL (string) or array of URLs for multiple images
export async function sendMessageWithImage(channelId, user, imageUrl, text = '', imageUrls = null) {
  if (!user || (!imageUrl && (!imageUrls || imageUrls.length === 0))) return

  // Normalize to array
  const allImageUrls = imageUrls || (imageUrl ? [imageUrl] : [])

  try {
    const messagesRef = collection(db, 'channels', channelId, 'messages')
    const docRef = await addDoc(messagesRef, {
      text: text,
      imageUrl: allImageUrls[0], // Keep for backwards compatibility
      imageUrls: allImageUrls.length > 1 ? allImageUrls : null, // Only set if multiple images
      sender: user.displayName || user.email,
      senderId: user.uid,
      photoURL: user.photoURL || '',
      timestamp: serverTimestamp(),
    })

    // Tag and index to Ragie (fire and forget, don't block send)
    // 1. Sync accompanying text (if any)
    if (text) {
      fetch('/api/tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: docRef.id,
          chatId: channelId,
          chatType: 'channel',
          text,
          sender: user.displayName || user.email,
          senderEmail: user.email,
          senderId: user.uid,
          timestamp: new Date().toISOString(),
        }),
      })
        .then(res => res.json())
        .then(data => {
          if (data.aiTags) {
            updateDoc(doc(db, 'channels', channelId, 'messages', docRef.id), {
              aiTags: data.aiTags,
            }).catch(err => console.warn('Failed to save tags to Firestore:', err))
          }
        })
        .catch(err => console.error('Tagging failed:', err))
    }

    // 2. Sync each image to Ragie - analyze with Claude Vision and index
    // We only need to analyze the first image for the message (to avoid duplicate analysis)
    if (allImageUrls.length > 0) {
      fetch('/api/ragie/sync-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: docRef.id,
          chatId: channelId,
          chatType: 'channel',
          imageUrl: allImageUrls[0],
          text,
          sender: user.displayName || user.email,
          senderEmail: user.email,
          senderId: user.uid,
          timestamp: new Date().toISOString(),
        }),
      })
        .then(res => res.json())
        .then(data => {
          // Save the image analysis back to the message document
          if (data.analysis) {
            updateDoc(doc(db, 'channels', channelId, 'messages', docRef.id), {
              imageAnalysis: data.analysis,
            }).catch(err => console.warn('Failed to save image analysis:', err))
          }
        })
        .catch(err => console.error('Ragie image sync failed:', err))
    }
  } catch (error) {
    console.error('Error sending message with image:', error)
    throw error
  }
}

// Send DM with image(s)
// imageUrl can be a single URL (string) or array of URLs for multiple images
export async function sendMessageDMWithImage(
  dmId,
  user,
  imageUrl,
  recipientId,
  text = '',
  recipient = null,
  imageUrls = null
) {
  if (!user || (!imageUrl && (!imageUrls || imageUrls.length === 0))) return

  // Normalize to array
  const allImageUrls = imageUrls || (imageUrl ? [imageUrl] : [])

  try {
    const messagesRef = collection(db, 'dms', dmId, 'messages')
    const docRef = await addDoc(messagesRef, {
      text: text,
      imageUrl: allImageUrls[0], // Keep for backwards compatibility
      imageUrls: allImageUrls.length > 1 ? allImageUrls : null, // Only set if multiple images
      sender: user.displayName || user.email,
      senderId: user.uid,
      photoURL: user.photoURL || '',
      timestamp: serverTimestamp(),
    })

    // Tag and index to Ragie (fire and forget, don't block send)
    // 1. Sync accompanying text (if any)
    if (text) {
      fetch('/api/tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: docRef.id,
          chatId: dmId,
          chatType: 'dm',
          text,
          sender: user.displayName || user.email,
          senderEmail: user.email,
          senderId: user.uid,
          timestamp: new Date().toISOString(),
          participants: dmId.split('_').slice(1),
          recipientId: recipientId,
          recipientName: recipient?.displayName || recipient?.email || null,
          recipientEmail: recipient?.email || null,
        }),
      })
        .then(res => res.json())
        .then(data => {
          if (data.aiTags) {
            updateDoc(doc(db, 'dms', dmId, 'messages', docRef.id), { aiTags: data.aiTags }).catch(
              err => console.warn('Failed to save tags to Firestore:', err)
            )
            saveCanonicalTag(data.aiTags)

            // AI signals task intent via task_action field
            if (data.aiTags.task_action) {
              console.log('📋 AI task_action:', data.aiTags.task_action)
              createTaskFromMessage(dmId, 'dm', docRef.id, text, user, recipient, data.aiTags)
            }
          }
        })
        .catch(err => console.error('Tagging failed:', err))
    }

    // 2. Sync image to Ragie - analyze with Claude Vision and index
    if (allImageUrls.length > 0) {
      fetch('/api/ragie/sync-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: docRef.id,
          chatId: dmId,
          chatType: 'dm',
          imageUrl: allImageUrls[0],
          text,
          sender: user.displayName || user.email,
          senderEmail: user.email,
          senderId: user.uid,
          timestamp: new Date().toISOString(),
          participants: dmId.split('_').slice(1),
          recipientId: recipientId,
          recipientName: recipient?.displayName || recipient?.email || null,
          recipientEmail: recipient?.email || null,
        }),
      })
        .then(res => res.json())
        .then(data => {
          // Save the image analysis back to the message document
          if (data.analysis) {
            updateDoc(doc(db, 'dms', dmId, 'messages', docRef.id), {
              imageAnalysis: data.analysis,
            }).catch(err => console.warn('Failed to save image analysis:', err))
          }
        })
        .catch(err => console.error('Ragie image sync failed:', err))
    }

    // Add to active DMs
    await addActiveDM(user.uid, recipientId)
    await addActiveDM(recipientId, user.uid)
  } catch (error) {
    console.error('Error sending DM with image:', error)
    throw error
  }
}

// Send message with media (images and/or Mux videos)
export async function sendMessageWithMedia(
  channelId,
  user,
  text = '',
  imageUrls = [],
  muxPlaybackIds = [],
  replyTo = null,
  mediaDimensions = [], // Array of { width, height } for each media item
  linkPreview = null,
  options = {},
  recentMessages = [] // Recent messages for image analysis context
) {
  if (!user || (imageUrls.length === 0 && muxPlaybackIds.length === 0)) return

  const { isPrivate = false, privateFor = null } = options

  try {
    const messagesRef = collection(db, 'channels', channelId, 'messages')
    const messageData = {
      text: text,
      imageUrl: imageUrls[0] || null, // Keep for backwards compatibility
      imageUrls: imageUrls.length > 0 ? imageUrls : null,
      muxPlaybackIds: muxPlaybackIds.length > 0 ? muxPlaybackIds : null,
      // Store dimensions for layout stability (prevents layout shift on load)
      mediaDimensions: mediaDimensions.length > 0 ? mediaDimensions : null,
      sender: user.displayName || user.email,
      senderId: user.uid,
      photoURL: user.photoURL || '',
      timestamp: serverTimestamp(),
    }

    // Add link preview if present
    if (linkPreview) {
      messageData.linkPreview = linkPreview
    }
    // Add private flag if message is private
    if (isPrivate) {
      messageData.isPrivate = true
      messageData.privateFor = privateFor || user.uid
    }

    // Add reply reference if replying
    if (replyTo) {
      const replyData = {
        msgId: replyTo.msgId,
        sender: replyTo.sender,
        text: replyTo.text || '',
      }
      // Add media fields if present
      if (replyTo.imageUrl) replyData.imageUrl = replyTo.imageUrl
      if (replyTo.imageUrls?.length) replyData.imageUrls = replyTo.imageUrls
      if (replyTo.audioUrl) replyData.audioUrl = replyTo.audioUrl
      if (replyTo.audioDuration) replyData.audioDuration = replyTo.audioDuration
      if (replyTo.muxPlaybackIds?.length) replyData.muxPlaybackIds = replyTo.muxPlaybackIds
      messageData.replyTo = replyData
    }

    const docRef = await addDoc(messagesRef, messageData)

    // Tag and index to Ragie if text present
    if (text) {
      fetch('/api/tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: docRef.id,
          chatId: channelId,
          chatType: 'channel',
          text,
          sender: user.displayName || user.email,
          senderEmail: user.email,
          senderId: user.uid,
          timestamp: new Date().toISOString(),
        }),
      })
        .then(res => res.json())
        .then(data => {
          if (data.aiTags) {
            updateDoc(doc(db, 'channels', channelId, 'messages', docRef.id), {
              aiTags: data.aiTags,
            }).catch(err => console.warn('Failed to save tags to Firestore:', err))
            saveCanonicalTag(data.aiTags)
          }
        })
        .catch(err => console.error('Tagging failed:', err))
    }

    // Sync image to Ragie - analyze with Claude Vision and index
    if (imageUrls.length > 0) {
      // Format recent messages for context (last 15, simplified)
      const contextMessages = (recentMessages || [])
        .slice(-15)
        .map(m => ({ sender: m.sender, text: m.text }))
        .filter(m => m.text) // Only include messages with text

      fetch('/api/ragie/sync-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: docRef.id,
          chatId: channelId,
          chatType: 'channel',
          imageUrl: imageUrls[0],
          text,
          sender: user.displayName || user.email,
          senderEmail: user.email,
          senderId: user.uid,
          timestamp: new Date().toISOString(),
          recentMessages: contextMessages,
        }),
      })
        .then(res => res.json())
        .then(data => {
          // Save the image analysis back to the message document
          if (data.analysis) {
            updateDoc(doc(db, 'channels', channelId, 'messages', docRef.id), {
              imageAnalysis: data.analysis,
            }).catch(err => console.warn('Failed to save image analysis:', err))
          }
        })
        .catch(err => console.error('Image analysis failed:', err))
    }
  } catch (error) {
    console.error('Error sending message with media:', error)
    throw error
  }
}

// Send DM with media (images and/or Mux videos)
export async function sendMessageDMWithMedia(
  dmId,
  user,
  recipientId,
  text = '',
  recipient = null,
  imageUrls = [],
  muxPlaybackIds = [],
  replyTo = null,
  mediaDimensions = [], // Array of { width, height } for each media item
  linkPreview = null,
  options = {},
  recentMessages = [] // Recent messages for image analysis context
) {
  if (!user || (imageUrls.length === 0 && muxPlaybackIds.length === 0)) return

  const { isPrivate = false, privateFor = null } = options

  try {
    const messagesRef = collection(db, 'dms', dmId, 'messages')
    const messageData = {
      text: text,
      imageUrl: imageUrls[0] || null, // Keep for backwards compatibility
      imageUrls: imageUrls.length > 0 ? imageUrls : null,
      muxPlaybackIds: muxPlaybackIds.length > 0 ? muxPlaybackIds : null,
      // Store dimensions for layout stability (prevents layout shift on load)
      mediaDimensions: mediaDimensions.length > 0 ? mediaDimensions : null,
      sender: user.displayName || user.email,
      senderId: user.uid,
      photoURL: user.photoURL || '',
      timestamp: serverTimestamp(),
    }

    // Add link preview if present
    if (linkPreview) {
      messageData.linkPreview = linkPreview
    }
    // Add private flag if message is private
    if (isPrivate) {
      messageData.isPrivate = true
      messageData.privateFor = privateFor || user.uid
    }

    // Add reply reference if replying
    if (replyTo) {
      const replyData = {
        msgId: replyTo.msgId,
        sender: replyTo.sender,
        text: replyTo.text || '',
      }
      // Add media fields if present
      if (replyTo.imageUrl) replyData.imageUrl = replyTo.imageUrl
      if (replyTo.imageUrls?.length) replyData.imageUrls = replyTo.imageUrls
      if (replyTo.audioUrl) replyData.audioUrl = replyTo.audioUrl
      if (replyTo.audioDuration) replyData.audioDuration = replyTo.audioDuration
      if (replyTo.muxPlaybackIds?.length) replyData.muxPlaybackIds = replyTo.muxPlaybackIds
      messageData.replyTo = replyData
    }

    const docRef = await addDoc(messagesRef, messageData)

    // Tag and index to Ragie if text present
    if (text) {
      fetch('/api/tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: docRef.id,
          chatId: dmId,
          chatType: 'dm',
          text,
          sender: user.displayName || user.email,
          senderEmail: user.email,
          senderId: user.uid,
          timestamp: new Date().toISOString(),
          participants: dmId.split('_').slice(1),
          recipientId: recipientId,
          recipientName: recipient?.displayName || recipient?.email || null,
          recipientEmail: recipient?.email || null,
        }),
      })
        .then(res => res.json())
        .then(data => {
          if (data.aiTags) {
            updateDoc(doc(db, 'dms', dmId, 'messages', docRef.id), { aiTags: data.aiTags }).catch(
              err => console.warn('Failed to save tags to Firestore:', err)
            )
            saveCanonicalTag(data.aiTags)

            // Log what the AI tagged this as
            console.log('🏷️ AI Tag Result:', {
              type: data.aiTags.type,
              canonical: data.aiTags.canonical_tag,
              summary: data.aiTags.summary,
            })

            // AI signals task intent via task_action field
            if (data.aiTags.task_action) {
              console.log('📋 AI task_action:', data.aiTags.task_action)
              createTaskFromMessage(dmId, 'dm', docRef.id, text, user, recipient, data.aiTags)
            }
          }
        })
        .catch(err => console.error('Tagging failed:', err))
    }

    // Sync image to Ragie - analyze with Claude Vision and index
    if (imageUrls.length > 0) {
      // Format recent messages for context (last 15, simplified)
      const contextMessages = (recentMessages || [])
        .slice(-15)
        .map(m => ({ sender: m.sender, text: m.text }))
        .filter(m => m.text) // Only include messages with text

      fetch('/api/ragie/sync-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: docRef.id,
          chatId: dmId,
          chatType: 'dm',
          imageUrl: imageUrls[0],
          text,
          sender: user.displayName || user.email,
          senderEmail: user.email,
          senderId: user.uid,
          timestamp: new Date().toISOString(),
          participants: dmId.split('_').slice(1),
          recipientId: recipientId,
          recipientName: recipient?.displayName || recipient?.email || null,
          recipientEmail: recipient?.email || null,
          recentMessages: contextMessages,
        }),
      })
        .then(res => res.json())
        .then(data => {
          // Save the image analysis back to the message document
          if (data.analysis) {
            updateDoc(doc(db, 'dms', dmId, 'messages', docRef.id), {
              imageAnalysis: data.analysis,
            }).catch(err => console.warn('Failed to save image analysis:', err))
          }
        })
        .catch(err => console.error('Image analysis failed:', err))
    }

    // Add to active DMs
    await addActiveDM(user.uid, recipientId)
    await addActiveDM(recipientId, user.uid)
  } catch (error) {
    console.error('Error sending DM with media:', error)
    throw error
  }
}

// Send message with audio (channel)
export async function sendMessageWithAudio(
  channelId,
  user,
  audioUrl,
  audioDuration,
  replyTo = null
) {
  if (!user || !audioUrl) return

  try {
    const messagesRef = collection(db, 'channels', channelId, 'messages')
    const messageData = {
      text: '',
      audioUrl: audioUrl,
      audioDuration: audioDuration || 0,
      sender: user.displayName || user.email,
      senderId: user.uid,
      photoURL: user.photoURL || '',
      timestamp: serverTimestamp(),
    }

    // Add reply reference if replying
    if (replyTo) {
      messageData.replyTo = {
        msgId: replyTo.msgId,
        sender: replyTo.sender,
        text: replyTo.text,
      }
    }

    const docRef = await addDoc(messagesRef, messageData)

    // Tag and index to Ragie (empty text but still index for context)
    fetch('/api/tag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messageId: docRef.id,
        chatId: channelId,
        chatType: 'channel',
        text: '',
        sender: user.displayName || user.email,
        senderEmail: user.email,
        senderId: user.uid,
        timestamp: new Date().toISOString(),
      }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.aiTags) {
          updateDoc(doc(db, 'channels', channelId, 'messages', docRef.id), {
            aiTags: data.aiTags,
          }).catch(err => console.warn('Failed to save tags to Firestore:', err))
          saveCanonicalTag(data.aiTags)
        }
      })
      .catch(err => console.error('Tagging failed:', err))
  } catch (error) {
    console.error('Error sending message with audio:', error)
    throw error
  }
}

// Send message with audio (DM)
export async function sendMessageDMWithAudio(
  dmId,
  user,
  recipientId,
  audioUrl,
  audioDuration,
  recipient = null,
  replyTo = null
) {
  if (!user || !audioUrl) return

  try {
    const messagesRef = collection(db, 'dms', dmId, 'messages')
    const messageData = {
      text: '',
      audioUrl: audioUrl,
      audioDuration: audioDuration || 0,
      sender: user.displayName || user.email,
      senderId: user.uid,
      photoURL: user.photoURL || '',
      timestamp: serverTimestamp(),
    }

    // Add reply reference if replying
    if (replyTo) {
      messageData.replyTo = {
        msgId: replyTo.msgId,
        sender: replyTo.sender,
        text: replyTo.text,
      }
    }

    const docRef = await addDoc(messagesRef, messageData)

    // Tag and index to Ragie
    fetch('/api/tag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messageId: docRef.id,
        chatId: dmId,
        chatType: 'dm',
        text: '',
        sender: user.displayName || user.email,
        senderEmail: user.email,
        senderId: user.uid,
        timestamp: new Date().toISOString(),
        participants: dmId.split('_').slice(1),
        recipientId: recipientId,
        recipientName: recipient?.displayName || recipient?.email || null,
        recipientEmail: recipient?.email || null,
      }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.aiTags) {
          updateDoc(doc(db, 'dms', dmId, 'messages', docRef.id), { aiTags: data.aiTags }).catch(
            err => console.warn('Failed to save tags to Firestore:', err)
          )
          saveCanonicalTag(data.aiTags)

          // Log what the AI tagged this as
          console.log('🏷️ AI Tag Result:', {
            type: data.aiTags.type,
            canonical: data.aiTags.canonical_tag,
            summary: data.aiTags.summary,
          })

          // AI signals task intent via task_action field
          if (data.aiTags.task_action) {
            console.log('📋 AI task_action:', data.aiTags.task_action)
            createTaskFromMessage(dmId, 'dm', docRef.id, '', user, recipient, data.aiTags)
          }
        }
      })
      .catch(err => console.error('Tagging failed:', err))

    // Add to active DMs
    await addActiveDM(user.uid, recipientId)
    await addActiveDM(recipientId, user.uid)
  } catch (error) {
    console.error('Error sending DM with audio:', error)
    throw error
  }
}

// Add reaction to a message
export async function addReaction(channelId, messageId, userId, emoji, isDM = false) {
  try {
    const messagesRef = isDM
      ? doc(db, 'dms', channelId, 'messages', messageId)
      : doc(db, 'channels', channelId, 'messages', messageId)

    const msgSnap = await getDoc(messagesRef)
    const reactions = msgSnap.data()?.reactions || {}

    // Toggle reaction: remove if same emoji, otherwise set new one
    if (reactions[userId] === emoji) {
      delete reactions[userId]
    } else {
      reactions[userId] = emoji
    }

    await updateDoc(messagesRef, { reactions })
  } catch (error) {
    console.error('Error adding reaction:', error)
    throw error
  }
}

// Edit message
export async function editMessage(channelId, messageId, newText, isDM = false) {
  try {
    const messagesRef = isDM
      ? doc(db, 'dms', channelId, 'messages', messageId)
      : doc(db, 'channels', channelId, 'messages', messageId)

    await updateDoc(messagesRef, {
      text: newText,
      edited: true,
      editedAt: serverTimestamp(),
    })
  } catch (error) {
    console.error('Error editing message:', error)
    throw error
  }
}

/**
 * Update media dimensions for a message (on-demand migration for old messages).
 * This is called when an image/video loads without stored dimensions.
 * Fire-and-forget - doesn't block UI.
 *
 * @param {string} chatId - Channel ID or DM ID
 * @param {string} messageId - Message document ID
 * @param {boolean} isDM - Whether this is a DM message
 * @param {Array<{width: number, height: number}>} mediaDimensions - Array of dimensions
 */
export async function updateMessageMediaDimensions(
  chatId,
  messageId,
  isDM = false,
  mediaDimensions
) {
  try {
    const messageRef = isDM
      ? doc(db, 'dms', chatId, 'messages', messageId)
      : doc(db, 'channels', chatId, 'messages', messageId)

    await updateDoc(messageRef, {
      mediaDimensions,
    })

    console.log('📐 Migrated media dimensions for message:', messageId)
  } catch (error) {
    // Silent fail - this is a background migration, don't disrupt user
    console.warn('Failed to migrate media dimensions:', error)
  }
}

/**
 * Fetch link preview data from the API.
 * Used when sending a message with a URL.
 *
 * @param {string} url - The URL to get preview for
 * @returns {Promise<object|null>} - Link preview data or null
 */
export async function fetchLinkPreview(url) {
  try {
    const response = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`)

    if (!response.ok) {
      throw new Error('Failed to fetch preview')
    }

    const data = await response.json()

    if (data.error) {
      return null
    }

    // Return normalized preview data to store in Firestore
    return {
      url: data.url || url,
      title: data.title || null,
      description: data.description || null,
      siteName: data.siteName || null,
      image: data.images?.[0] || null,
      favicon: data.favicons?.[0] || null,
      imageDimensions: data.imageDimensions || null,
    }
  } catch (error) {
    console.warn('Failed to fetch link preview:', error)
    return null
  }
}

/**
 * Update link preview for a message (on-demand migration for old messages).
 * This is called when a message has a URL but no stored link preview.
 * Fire-and-forget - doesn't block UI.
 *
 * @param {string} chatId - Channel ID or DM ID
 * @param {string} messageId - Message document ID
 * @param {boolean} isDM - Whether this is a DM message
 * @param {object} linkPreview - Link preview data
 */
export async function updateMessageLinkPreview(chatId, messageId, isDM = false, linkPreview) {
  try {
    const messageRef = isDM
      ? doc(db, 'dms', chatId, 'messages', messageId)
      : doc(db, 'channels', chatId, 'messages', messageId)

    await updateDoc(messageRef, {
      linkPreview,
    })

    console.log('🔗 Migrated link preview for message:', messageId)
  } catch (error) {
    // Silent fail - this is a background migration, don't disrupt user
    console.warn('Failed to migrate link preview:', error)
  }
}
// Toggle message visibility (private <-> public)
export async function toggleMessageVisibility(channelId, messageId, makePublic, isDM = false) {
  try {
    const messageRef = isDM
      ? doc(db, 'dms', channelId, 'messages', messageId)
      : doc(db, 'channels', channelId, 'messages', messageId)

    if (makePublic) {
      // Make public - remove private flags
      await updateDoc(messageRef, {
        isPrivate: false,
        privateFor: null,
      })
    } else {
      // This shouldn't normally be called (can't make public messages private after the fact)
      console.warn('Cannot make public messages private after sending')
    }
  } catch (error) {
    console.error('Error toggling message visibility:', error)
    throw error
  }
}

// Delete message
export async function deleteMessage(channelId, messageId, isDM = false) {
  try {
    const messagesRef = isDM
      ? doc(db, 'dms', channelId, 'messages', messageId)
      : doc(db, 'channels', channelId, 'messages', messageId)

    await deleteDoc(messagesRef)
  } catch (error) {
    console.error('Error deleting message:', error)
    throw error
  }
}

// Send message with reply
export async function sendMessageWithReply(
  channelId,
  user,
  text,
  replyTo,
  linkPreview = null,
  options = {}
) {
  if (!user || !text.trim()) return

  const { isPrivate = false, privateFor = null } = options

  try {
    const messagesRef = collection(db, 'channels', channelId, 'messages')
    const replyData = {
      msgId: replyTo.msgId,
      sender: replyTo.sender,
      text: replyTo.text || '',
    }
    // Add media fields if present
    if (replyTo.imageUrl) replyData.imageUrl = replyTo.imageUrl
    if (replyTo.imageUrls?.length) replyData.imageUrls = replyTo.imageUrls
    if (replyTo.audioUrl) replyData.audioUrl = replyTo.audioUrl
    if (replyTo.audioDuration) replyData.audioDuration = replyTo.audioDuration
    if (replyTo.muxPlaybackIds?.length) replyData.muxPlaybackIds = replyTo.muxPlaybackIds

    const messageData = {
      text: text,
      sender: user.displayName || user.email,
      senderId: user.uid,
      photoURL: user.photoURL || '',
      timestamp: serverTimestamp(),
      replyTo: replyData,
    }

    // Add link preview if present
    if (linkPreview) {
      messageData.linkPreview = linkPreview
    }

    // Add private flag if message is private
    if (isPrivate) {
      messageData.isPrivate = true
      messageData.privateFor = privateFor || user.uid
    }

    const docRef = await addDoc(messagesRef, messageData)

    // Tag and index to Ragie (fire and forget, don't block send)
    fetch('/api/tag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messageId: docRef.id,
        chatId: channelId,
        chatType: 'channel',
        text: `[replying to ${replyTo.sender}] ${text}`,
        sender: user.displayName || user.email,
        senderEmail: user.email,
        senderId: user.uid,
        timestamp: new Date().toISOString(),
      }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.aiTags) {
          updateDoc(doc(db, 'channels', channelId, 'messages', docRef.id), {
            aiTags: data.aiTags,
          }).catch(err => console.warn('Failed to save tags to Firestore:', err))
          saveCanonicalTag(data.aiTags)
        }
      })
      .catch(err => console.error('Tagging failed:', err))
  } catch (error) {
    console.error('Error sending message with reply:', error)
    throw error
  }
}

// Send DM with reply
export async function sendMessageDMWithReply(
  dmId,
  user,
  text,
  recipientId,
  replyTo,
  recipient = null,
  linkPreview = null,
  options = {}
) {
  if (!user || !text.trim()) return

  const { isPrivate = false, privateFor = null } = options

  try {
    const messagesRef = collection(db, 'dms', dmId, 'messages')
    const replyData = {
      msgId: replyTo.msgId,
      sender: replyTo.sender,
      text: replyTo.text || '',
    }
    // Add media fields if present
    if (replyTo.imageUrl) replyData.imageUrl = replyTo.imageUrl
    if (replyTo.imageUrls?.length) replyData.imageUrls = replyTo.imageUrls
    if (replyTo.audioUrl) replyData.audioUrl = replyTo.audioUrl
    if (replyTo.audioDuration) replyData.audioDuration = replyTo.audioDuration
    if (replyTo.muxPlaybackIds?.length) replyData.muxPlaybackIds = replyTo.muxPlaybackIds

    const messageData = {
      text: text,
      sender: user.displayName || user.email,
      senderId: user.uid,
      photoURL: user.photoURL || '',
      timestamp: serverTimestamp(),
      replyTo: replyData,
    }

    // Add link preview if present
    if (linkPreview) {
      messageData.linkPreview = linkPreview
    }

    // Add private flag if message is private
    if (isPrivate) {
      messageData.isPrivate = true
      messageData.privateFor = privateFor || user.uid
    }

    const docRef = await addDoc(messagesRef, messageData)

    // Tag and index to Ragie (fire and forget, don't block send)
    fetch('/api/tag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messageId: docRef.id,
        chatId: dmId,
        chatType: 'dm',
        text: `[replying to ${replyTo.sender}] ${text}`,
        sender: user.displayName || user.email,
        senderEmail: user.email,
        senderId: user.uid,
        timestamp: new Date().toISOString(),
        participants: dmId.split('_').slice(1),
        recipientId: recipientId,
        recipientName: recipient?.displayName || recipient?.email || null,
        recipientEmail: recipient?.email || null,
      }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.aiTags) {
          updateDoc(doc(db, 'dms', dmId, 'messages', docRef.id), { aiTags: data.aiTags }).catch(
            err => console.warn('Failed to save tags to Firestore:', err)
          )
          saveCanonicalTag(data.aiTags)

          // Log what the AI tagged this as
          console.log('🏷️ AI Tag Result:', {
            type: data.aiTags.type,
            canonical: data.aiTags.canonical_tag,
            summary: data.aiTags.summary,
          })

          // AI signals task intent via task_action field
          if (data.aiTags.task_action) {
            console.log('📋 AI task_action:', data.aiTags.task_action)
            createTaskFromMessage(dmId, 'dm', docRef.id, text, user, recipient, data.aiTags)
          }
        }
      })
      .catch(err => console.error('Tagging failed:', err))

    // Add to active DMs
    await addActiveDM(user.uid, recipientId)
    await addActiveDM(recipientId, user.uid)
  } catch (error) {
    console.error('Error sending DM with reply:', error)
    throw error
  }
}

// Get emoji usage for user
export async function getEmojiUsage(userId) {
  if (!userId) return {}

  try {
    const userDoc = await getDoc(doc(db, 'users', userId))
    if (userDoc.exists()) {
      return userDoc.data()?.emojiUsage || {}
    }
    return {}
  } catch (error) {
    console.error('Error getting emoji usage:', error)
    return {}
  }
}

// Update emoji usage count
export async function updateEmojiUsage(userId, emoji) {
  if (!userId || !emoji) return

  try {
    const userDoc = await getDoc(doc(db, 'users', userId))
    const currentUsage = userDoc.exists() ? userDoc.data().emojiUsage || {} : {}

    // Increment count for this emoji
    currentUsage[emoji] = (currentUsage[emoji] || 0) + 1

    await setDoc(
      doc(db, 'users', userId),
      {
        emojiUsage: currentUsage,
        lastSeen: serverTimestamp(),
      },
      { merge: true }
    )
  } catch (error) {
    console.error('Error updating emoji usage:', error)
  }
}

// Mark DM messages as read
export async function markDMMessagesAsRead(dmId, userId, messageIds) {
  if (!dmId || !userId || !messageIds || messageIds.length === 0) return

  try {
    const batch = []
    const messagesRef = collection(db, 'dms', dmId, 'messages')

    for (const messageId of messageIds) {
      const messageRef = doc(messagesRef, messageId)
      batch.push(
        updateDoc(messageRef, {
          [`readBy.${userId}`]: serverTimestamp(),
        })
      )
    }

    await Promise.all(batch)
  } catch (error) {
    console.error('Error marking messages as read:', error)
  }
}

// AI Chat functions
export async function sendAIMessage(userId, text, isAI = false, user = null) {
  if (!userId || !text.trim()) return

  try {
    const messagesRef = collection(db, 'aiChats', userId, 'messages')
    const docRef = await addDoc(messagesRef, {
      text: text,
      sender: isAI ? 'Poppy AI' : null,
      senderId: isAI ? 'ai' : userId,
      timestamp: serverTimestamp(),
    })

    // Tag and index to Ragie (fire and forget, don't block send)
    fetch('/api/tag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messageId: docRef.id,
        chatId: `ai_${userId}`,
        chatType: 'ai',
        text,
        sender: isAI ? 'Poppy AI' : user?.displayName || user?.email || 'User',
        senderEmail: isAI ? 'ai@poppy.chat' : user?.email || null,
        senderId: isAI ? 'ai' : userId,
        timestamp: new Date().toISOString(),
      }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.aiTags) {
          updateDoc(doc(db, 'aiChats', userId, 'messages', docRef.id), {
            aiTags: data.aiTags,
          }).catch(err => console.warn('Failed to save tags to Firestore:', err))
          saveCanonicalTag(data.aiTags)
        }
      })
      .catch(err => console.error('Tagging failed:', err))
  } catch (error) {
    console.error('Error sending AI message:', error)
    throw error
  }
}

export function subscribeToAIMessages(userId, callback) {
  const messagesRef = collection(db, 'aiChats', userId, 'messages')
  const q = query(messagesRef, orderBy('timestamp', 'asc'))

  return onSnapshot(q, snapshot => {
    const messages = []
    snapshot.forEach(doc => {
      messages.push({
        id: doc.id,
        ...doc.data(),
      })
    })
    callback(messages)
  })
}

// Typing indicator functions
export async function setUserTyping(dmId, userId, isTyping) {
  if (!dmId || !userId) return

  try {
    const typingRef = doc(db, 'typing', dmId)
    await setDoc(
      typingRef,
      {
        [userId]: isTyping ? serverTimestamp() : null,
      },
      { merge: true }
    )
  } catch (error) {
    console.error('Error setting typing status:', error)
  }
}

export function subscribeToTypingStatus(dmId, otherUserId, callback) {
  if (!dmId || !otherUserId) return () => {}

  const typingRef = doc(db, 'typing', dmId)

  return onSnapshot(
    typingRef,
    snapshot => {
      if (snapshot.exists()) {
        const data = snapshot.data()
        const typingTimestamp = data?.[otherUserId]

        if (typingTimestamp) {
          // Check if typing timestamp is recent (within 3 seconds)
          const now = Date.now()
          const typingTime = typingTimestamp.seconds * 1000
          const isTyping = now - typingTime < 3000
          callback(isTyping)
        } else {
          callback(false)
        }
      } else {
        callback(false)
      }
    },
    error => {
      console.error('Error subscribing to typing status:', error)
      callback(false)
    }
  )
}

// Unread tracking functions
export async function markChatAsRead(userId, chatType, chatId) {
  if (!userId || !chatType || !chatId) return

  try {
    const unreadRef = doc(db, 'unread', userId)
    const chatKey = `${chatType}:${chatId}`

    await setDoc(
      unreadRef,
      {
        [chatKey]: {
          lastRead: serverTimestamp(),
          read: true,
        },
      },
      { merge: true }
    )

    console.log(`✅ Marked ${chatKey} as read for user ${userId}`)
  } catch (error) {
    console.error('Error marking chat as read:', error)
  }
}

export async function markChatAsUnread(userId, chatType, chatId) {
  if (!userId || !chatType || !chatId) return

  try {
    const unreadRef = doc(db, 'unread', userId)
    const chatKey = `${chatType}:${chatId}`

    await setDoc(
      unreadRef,
      {
        [chatKey]: {
          lastMessageTime: serverTimestamp(),
          read: false,
        },
      },
      { merge: true }
    )

    console.log(`🔵 Marked ${chatKey} as unread for user ${userId}`)
  } catch (error) {
    console.error('Error marking chat as unread:', error)
  }
}

export function subscribeToUnreadChats(userId, callback) {
  if (!userId) return () => {}

  const unreadRef = doc(db, 'unread', userId)

  return onSnapshot(
    unreadRef,
    snapshot => {
      if (snapshot.exists()) {
        const data = snapshot.data()
        const unreadChats = []

        // Iterate through all chat keys and find unread ones
        Object.keys(data).forEach(chatKey => {
          if (data[chatKey].read === false) {
            unreadChats.push(chatKey)
          }
        })

        callback(unreadChats)
      } else {
        callback([])
      }
    },
    error => {
      console.error('Error subscribing to unread chats:', error)
      callback([])
    }
  )
}

// Posts functions
export async function createPost(chatType, chatId, user, title, content) {
  if (!user || !content.trim()) return

  try {
    const postsRef =
      chatType === 'dm'
        ? collection(db, 'dms', chatId, 'posts')
        : collection(db, 'channels', chatId, 'posts')

    const postDoc = await addDoc(postsRef, {
      title: title || '',
      content: content,
      sender: user.displayName || user.email,
      senderId: user.uid,
      photoURL: user.photoURL || '',
      timestamp: serverTimestamp(),
      edited: false,
    })

    return postDoc.id
  } catch (error) {
    console.error('Error creating post:', error)
    throw error
  }
}

export function subscribeToPosts(chatType, chatId, callback) {
  const postsRef =
    chatType === 'dm'
      ? collection(db, 'dms', chatId, 'posts')
      : collection(db, 'channels', chatId, 'posts')

  const q = query(postsRef, orderBy('timestamp', 'desc'))

  return onSnapshot(
    q,
    snapshot => {
      const posts = []
      snapshot.forEach(doc => {
        posts.push({
          id: doc.id,
          ...doc.data(),
        })
      })
      callback(posts)
    },
    error => {
      console.error('Error loading posts:', error)
    }
  )
}

export async function editPost(chatType, chatId, postId, newTitle, newContent) {
  try {
    const postRef =
      chatType === 'dm'
        ? doc(db, 'dms', chatId, 'posts', postId)
        : doc(db, 'channels', chatId, 'posts', postId)

    await updateDoc(postRef, {
      title: newTitle,
      content: newContent,
      edited: true,
      editedAt: serverTimestamp(),
    })
  } catch (error) {
    console.error('Error editing post:', error)
    throw error
  }
}

export async function deletePost(chatType, chatId, postId) {
  try {
    const postRef =
      chatType === 'dm'
        ? doc(db, 'dms', chatId, 'posts', postId)
        : doc(db, 'channels', chatId, 'posts', postId)

    await deleteDoc(postRef)
  } catch (error) {
    console.error('Error deleting post:', error)
    throw error
  }
}

// Promote a message to a post
export async function promoteMessageToPost(chatType, chatId, messageId) {
  try {
    // Get the message data
    const messageRef =
      chatType === 'dm'
        ? doc(db, 'dms', chatId, 'messages', messageId)
        : doc(db, 'channels', chatId, 'messages', messageId)

    const messageSnap = await getDoc(messageRef)
    if (!messageSnap.exists()) {
      throw new Error('Message not found')
    }

    const messageData = messageSnap.data()

    // Create a post with the message data
    const postsRef =
      chatType === 'dm'
        ? collection(db, 'dms', chatId, 'posts')
        : collection(db, 'channels', chatId, 'posts')

    await addDoc(postsRef, {
      title: '',
      content: messageData.text || '',
      sender: messageData.sender,
      senderId: messageData.senderId,
      photoURL: messageData.photoURL || '',
      timestamp: messageData.timestamp,
      edited: messageData.edited || false,
      imageUrl: messageData.imageUrl || null,
      replyTo: messageData.replyTo || null,
    })

    // Delete the original message
    await deleteDoc(messageRef)
  } catch (error) {
    console.error('Error promoting message to post:', error)
    throw error
  }
}

// Demote a post to a message
export async function demotePostToMessage(chatType, chatId, postId) {
  try {
    // Get the post data
    const postRef =
      chatType === 'dm'
        ? doc(db, 'dms', chatId, 'posts', postId)
        : doc(db, 'channels', chatId, 'posts', postId)

    const postSnap = await getDoc(postRef)
    if (!postSnap.exists()) {
      throw new Error('Post not found')
    }

    const postData = postSnap.data()

    // Create a message with the post data
    const messagesRef =
      chatType === 'dm'
        ? collection(db, 'dms', chatId, 'messages')
        : collection(db, 'channels', chatId, 'messages')

    await addDoc(messagesRef, {
      text: postData.content || '',
      sender: postData.sender,
      senderId: postData.senderId,
      photoURL: postData.photoURL || '',
      timestamp: postData.timestamp,
      edited: postData.edited || false,
      imageUrl: postData.imageUrl || null,
      replyTo: postData.replyTo || null,
      reactions: {},
    })

    // Delete the original post
    await deleteDoc(postRef)
  } catch (error) {
    console.error('Error demoting post to message:', error)
    throw error
  }
}

// Story views tracking functions

/**
 * Mark a story as viewed by a user
 * @param {string} storyId - The unique story ID (messageId_index)
 * @param {string} viewerId - The user ID who viewed the story
 * @param {string} viewerName - The display name of the viewer
 * @param {string} viewerPhotoURL - The photo URL of the viewer
 * @param {string} chatType - 'channel' or 'dm'
 * @param {string} chatId - The channel ID or DM ID
 */
export async function markStoryAsViewed(
  storyId,
  viewerId,
  viewerName,
  viewerPhotoURL,
  chatType,
  chatId
) {
  if (!storyId || !viewerId || !chatId) return

  try {
    // Store view in storyViews collection
    // Structure: storyViews/{chatType}_{chatId}/stories/{storyId}/viewers/{viewerId}

    // IMPORTANT: Also create the parent story document so subscribeToViewedStories can find it
    // Firestore subcollections don't create parent docs automatically
    const storyRef = doc(db, 'storyViews', `${chatType}_${chatId}`, 'stories', storyId)
    await setDoc(
      storyRef,
      {
        storyId,
        chatType,
        chatId,
        lastViewedAt: serverTimestamp(),
      },
      { merge: true }
    )

    // Now create the viewer document in the subcollection
    const viewerRef = doc(
      db,
      'storyViews',
      `${chatType}_${chatId}`,
      'stories',
      storyId,
      'viewers',
      viewerId
    )

    await setDoc(
      viewerRef,
      {
        viewerId,
        viewerName: viewerName || 'Unknown',
        viewerPhotoURL: viewerPhotoURL || '',
        viewedAt: serverTimestamp(),
      },
      { merge: true }
    )

    console.log(`✅ Marked story ${storyId} as viewed by ${viewerName}`)
  } catch (error) {
    console.error('Error marking story as viewed:', error)
  }
}

/**
 * Subscribe to viewers of a specific story
 * @param {string} storyId - The unique story ID
 * @param {string} chatType - 'channel' or 'dm'
 * @param {string} chatId - The channel ID or DM ID
 * @param {function} callback - Callback with array of viewers
 */
export function subscribeToStoryViewers(storyId, chatType, chatId, callback) {
  if (!storyId || !chatId) {
    callback([])
    return () => {}
  }

  const viewersRef = collection(
    db,
    'storyViews',
    `${chatType}_${chatId}`,
    'stories',
    storyId,
    'viewers'
  )
  const q = query(viewersRef, orderBy('viewedAt', 'desc'))

  return onSnapshot(
    q,
    snapshot => {
      const viewers = []
      snapshot.forEach(doc => {
        viewers.push({
          id: doc.id,
          ...doc.data(),
        })
      })
      callback(viewers)
    },
    error => {
      console.error('Error loading story viewers:', error)
      callback([])
    }
  )
}

/**
 * Get all stories that a user has viewed in a specific chat
 * @param {string} userId - The user ID
 * @param {string} chatType - 'channel' or 'dm'
 * @param {string} chatId - The channel ID or DM ID
 * @param {function} callback - Callback with Set of viewed story IDs
 */
export function subscribeToViewedStories(userId, chatType, chatId, callback) {
  if (!userId || !chatId) {
    callback(new Set())
    return () => {}
  }

  // We need to query all stories in this chat and check if user is a viewer
  // This is done by querying the storyViews collection
  const storiesRef = collection(db, 'storyViews', `${chatType}_${chatId}`, 'stories')

  return onSnapshot(
    storiesRef,
    async snapshot => {
      const viewedStoryIds = new Set()

      // For each story, check if the user has viewed it
      const checkPromises = snapshot.docs.map(async storyDoc => {
        const viewerRef = doc(
          db,
          'storyViews',
          `${chatType}_${chatId}`,
          'stories',
          storyDoc.id,
          'viewers',
          userId
        )
        const viewerSnap = await getDoc(viewerRef)
        if (viewerSnap.exists()) {
          viewedStoryIds.add(storyDoc.id)
        }
      })

      await Promise.all(checkPromises)
      callback(viewedStoryIds)
    },
    error => {
      console.error('Error loading viewed stories:', error)
      callback(new Set())
    }
  )
}

// ============================================
// TASKS FUNCTIONS
// ============================================

/**
 * Fuzzy match a name/nickname to a real user from the users collection
 * Handles cases like "JD" → "Jawwad Rehman", "Liv" → "Olivia Lee"
 */
async function fuzzyMatchUser(nameOrNickname) {
  if (!nameOrNickname) return null

  const searchTerm = nameOrNickname.toLowerCase().trim()

  try {
    const usersSnap = await getDocs(collection(db, 'users'))
    const users = []
    usersSnap.forEach(doc => {
      users.push({ id: doc.id, ...doc.data() })
    })

    // Score each user based on how well they match
    const scored = users.map(user => {
      let score = 0
      const displayName = (user.displayName || '').toLowerCase()
      const email = (user.email || '').toLowerCase()
      const emailPrefix = email.split('@')[0]
      const firstName = displayName.split(' ')[0]
      const lastName = displayName.split(' ').slice(-1)[0]
      const initials = displayName
        .split(' ')
        .map(w => w[0])
        .join('')

      // Exact matches (highest priority)
      if (displayName === searchTerm) score += 100
      if (emailPrefix === searchTerm) score += 90
      if (firstName === searchTerm) score += 80
      if (lastName === searchTerm) score += 70

      // Initials match (e.g., "JD" matches "Jawwad Doe", "JR" matches "Jawwad Rehman")
      if (initials === searchTerm.toUpperCase()) score += 75

      // Partial matches
      if (displayName.includes(searchTerm)) score += 50
      if (firstName.startsWith(searchTerm)) score += 45
      if (emailPrefix.includes(searchTerm)) score += 40

      // Common nickname patterns
      const nicknamePatterns = {
        // First syllable nicknames
        [firstName.substring(0, 3)]: 35,
        [firstName.substring(0, 2)]: 30,
        // Common nickname suffixes removed
        [firstName.replace(/ie$|y$|ey$/, '')]: 25,
      }

      for (const [pattern, points] of Object.entries(nicknamePatterns)) {
        if (pattern && searchTerm === pattern) score += points
      }

      // Levenshtein-like similarity (simple version)
      if (firstName.length > 2 && searchTerm.length > 2) {
        // Check if most characters match
        const commonChars = [...searchTerm].filter(c => firstName.includes(c)).length
        if (commonChars >= searchTerm.length * 0.7) score += 20
      }

      return { user, score }
    })

    // Get best match if score is above threshold
    const bestMatch = scored.sort((a, b) => b.score - a.score)[0]

    if (bestMatch && bestMatch.score >= 30) {
      console.log(
        `🎯 Fuzzy matched "${nameOrNickname}" → "${bestMatch.user.displayName}" (score: ${bestMatch.score})`
      )
      return bestMatch.user
    }

    // Local matching failed - try AI as fallback
    console.log(`🤖 Fuzzy match failed for "${nameOrNickname}", asking AI...`)
    const aiMatch = await askAIToMatchUser(nameOrNickname, users)
    if (aiMatch) {
      return aiMatch
    }

    console.log(`❓ Could not match "${nameOrNickname}" to any user (AI also couldn't)`)
    return null
  } catch (error) {
    console.error('Error in fuzzy match:', error)
    return null
  }
}

/**
 * Ask AI to match a nickname to a user when local fuzzy matching fails
 */
async function askAIToMatchUser(nickname, users) {
  try {
    // Build a simple list of users for the AI
    const userList = users.map(u => ({
      name: u.displayName || 'Unknown',
      email: u.email || '',
      id: u.uid || u.id,
    }))

    const response = await fetch('/api/tag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `MATCH_USER_TASK: Match "${nickname}" to a team member.

Team:
${userList.map(u => `- ${u.name} <${u.email}>`).join('\n')}

Return JSON: {"matched_email": "email@example.com"} or {"matched_email": null} if no match.
Match nicknames, initials, shortened names. Be confident or return null.`,
        sender: 'system',
        chatId: 'task_assignment',
        chatType: 'system',
        messageId: `match_${Date.now()}`,
      }),
    })

    if (!response.ok) {
      console.warn('AI match request failed')
      return null
    }

    const data = await response.json()
    const summary = data.aiTags?.summary || ''

    // Look for an email in the response
    const emailMatch = summary.match(/[\w.-]+@[\w.-]+\.\w+/)
    if (emailMatch) {
      const matchedEmail = emailMatch[0].toLowerCase()
      const matchedUser = users.find(u => u.email?.toLowerCase() === matchedEmail)

      if (matchedUser) {
        console.log(`🤖 AI matched "${nickname}" → "${matchedUser.displayName}" (${matchedEmail})`)
        return matchedUser
      }
    }

    return null
  } catch (error) {
    console.warn('AI user matching failed:', error.message)
    return null
  }
}

/**
 * Create a task from an AI-detected task message
 * Called automatically when a message is tagged as type: 'task'
 */
export async function createTaskFromMessage(
  chatId,
  chatType,
  messageId,
  text,
  user,
  recipient,
  aiTags
) {
  try {
    const tasksRef = collection(db, 'tasks')

    // Determine chat name for display
    let chatName = ''
    if (chatType === 'dm') {
      chatName = recipient?.displayName || recipient?.email || 'Direct Message'
    } else {
      chatName = chatId // Channel name
    }

    // Smart assignee detection:
    // 1. If AI says "YOU" → resolve to DM recipient
    // 2. If AI detected an explicit assignee name → use that (fuzzy match to real user)
    // 3. If in a DM and no explicit assignee → default to the recipient
    // 4. Otherwise → leave unassigned
    let assignedTo = null
    let assignedToUserId = null
    let assignedToEmail = null

    if (aiTags.assignee) {
      const assigneeRaw = aiTags.assignee.toUpperCase().trim()

      // "YOU" means the DM recipient - the person being spoken to
      if (assigneeRaw === 'YOU' && chatType === 'dm' && recipient) {
        assignedTo = recipient.displayName || recipient.email || 'Unknown'
        assignedToUserId = recipient.uid || recipient.id || null
        assignedToEmail = recipient.email || null
        console.log(`📋 "YOU" → resolved to DM recipient: ${assignedTo}`)
      } else {
        // AI detected an explicit assignee - fuzzy match to a real user
        const matchedUser = await fuzzyMatchUser(aiTags.assignee)

        if (matchedUser) {
          assignedTo = matchedUser.displayName || matchedUser.email
          assignedToUserId = matchedUser.uid || matchedUser.id
          assignedToEmail = matchedUser.email
          console.log(`📋 Task assigned to "${aiTags.assignee}" → matched to "${assignedTo}"`)
        } else {
          // Couldn't match to a real user, keep the AI's raw assignee name
          assignedTo = aiTags.assignee
          console.log(`📋 Task assigned to "${aiTags.assignee}" (no user match found)`)
        }
      }
    } else if (chatType === 'dm' && recipient) {
      // No explicit assignee in DM → default to the recipient
      assignedTo = recipient.displayName || recipient.email || 'Unknown'
      assignedToUserId = recipient.uid || recipient.id || null
      assignedToEmail = recipient.email || null
      console.log(`📋 DM Task → defaulting to recipient: ${assignedTo}`)
    }

    const canonicalTag = aiTags.canonical_tag || null

    // Check for existing task with same canonical_tag in this chat (deduplication)
    if (canonicalTag) {
      const existingQuery = query(
        tasksRef,
        where('chatId', '==', chatId),
        where('canonicalTag', '==', canonicalTag),
        where('completed', '==', false)
      )
      const existingSnap = await getDocs(existingQuery)

      if (!existingSnap.empty) {
        // Update existing task instead of creating a new one
        const existingTask = existingSnap.docs[0]
        const existingData = existingTask.data()

        // AI signals completion/cancellation via task_action
        const isCompleted = aiTags.task_action === 'complete' || aiTags.task_action === 'cancel'
        const isReassign = aiTags.task_action === 'reassign'

        const updateData = {
          // Update with latest info
          title: aiTags.summary || existingData.title,
          originalMessageId: messageId, // Point to most recent message
          originalMessageText: text,
          priority: aiTags.priority || existingData.priority,
          dueDate: aiTags.due_date || existingData.dueDate,
          status: aiTags.status || existingData.status,
          updatedAt: serverTimestamp(),
        }

        // Handle reassignment - if AI signaled reassign OR detected a new assignee
        if (isReassign || (assignedTo && assignedTo !== existingData.assignedTo)) {
          if (assignedTo) {
            updateData.assignedTo = assignedTo
            updateData.assignedToUserId = assignedToUserId
            updateData.assignedToEmail = assignedToEmail
            console.log(
              '🔄 Task REASSIGNED:',
              existingTask.id,
              '| from:',
              existingData.assignedTo,
              '→',
              assignedTo
            )
          }
        }

        // Mark as completed if AI signaled completion or cancellation
        if (isCompleted) {
          updateData.completed = true
          updateData.completedAt = serverTimestamp()
          updateData.completedBy = user.displayName || user.email
          console.log(
            '✅ Task marked COMPLETE:',
            existingTask.id,
            '| task_action:',
            aiTags.task_action
          )
        }

        await updateDoc(doc(db, 'tasks', existingTask.id), updateData)
        console.log(
          '✅ Task updated:',
          existingTask.id,
          '| action:',
          aiTags.task_action,
          '| completed:',
          isCompleted
        )
        return existingTask.id
      }
    }

    // Create new task
    const taskData = {
      // Task content
      title: aiTags.summary || text.substring(0, 100),
      originalMessageId: messageId,
      originalMessageText: text,

      // Assignment (renamed from assignee to assignedTo)
      assignedTo: assignedTo,
      assignedToUserId: assignedToUserId,
      assignedToEmail: assignedToEmail,

      // Assigner info
      assignedBy: user.displayName || user.email,
      assignedByUserId: user.uid,
      assignedByEmail: user.email,

      // Conversation context
      chatId: chatId,
      chatType: chatType,
      chatName: chatName,

      // Task metadata
      priority: aiTags.priority || 'medium',
      dueDate: aiTags.due_date || null,
      canonicalTag: canonicalTag,

      // Status
      status: aiTags.status || 'pending',
      completed: false,
      completedAt: null,
      completedBy: null,

      // Timestamps
      createdAt: serverTimestamp(),
    }

    // Generate human-readable task ID
    const taskId = generateTaskId(text || aiTags.summary || 'task')
    const taskDocRef = doc(db, 'tasks', taskId)

    await setDoc(taskDocRef, taskData)
    console.log('✅ Task auto-created:', taskId, '| assignedTo:', assignedTo)
    return taskId
  } catch (error) {
    console.error('Failed to create task from message:', error)
    return null
  }
}

/**
 * Subscribe to tasks in a specific chat (DM or channel)
 */
export function subscribeToTasksByChat(chatId, chatType, callback) {
  if (!chatId) {
    callback([])
    return () => {}
  }

  const tasksRef = collection(db, 'tasks')
  const q = query(
    tasksRef,
    where('chatId', '==', chatId),
    where('chatType', '==', chatType),
    orderBy('createdAt', 'desc')
  )

  return onSnapshot(
    q,
    snapshot => {
      const tasks = []
      snapshot.forEach(doc => {
        tasks.push({
          id: doc.id,
          ...doc.data(),
        })
      })
      callback(tasks)
    },
    error => {
      console.error('Error loading tasks:', error)
      callback([])
    }
  )
}

/**
 * Subscribe to all tasks assigned to a specific user
 * Used for "My Tasks" view
 */
export function subscribeToMyTasks(userId, userName, callback) {
  if (!userId) {
    callback([])
    return () => {}
  }

  const tasksRef = collection(db, 'tasks')

  // Query by assignerId (tasks I created) OR assignee name (tasks assigned to me)
  // Note: Firestore doesn't support OR queries directly, so we'll query by assignee name
  // This is a simplification - in production you'd want assigneeId
  const q = query(
    tasksRef,
    where('assignee', '==', userName?.toLowerCase() || ''),
    orderBy('createdAt', 'desc')
  )

  return onSnapshot(
    q,
    snapshot => {
      const tasks = []
      snapshot.forEach(doc => {
        tasks.push({
          id: doc.id,
          ...doc.data(),
        })
      })
      callback(tasks)
    },
    error => {
      // If index doesn't exist, fall back to empty
      console.error('Error loading my tasks:', error)
      callback([])
    }
  )
}

/**
 * Mark tasks as viewed for a user/chat
 * This clears the "unread tasks" blue dot
 */
export async function markTasksAsViewed(userId, chatId, chatType) {
  if (!userId || !chatId) return

  try {
    const tasksViewedRef = doc(db, 'tasksViewed', userId)
    const chatKey = `${chatType}:${chatId}`

    await setDoc(
      tasksViewedRef,
      {
        [chatKey]: serverTimestamp(),
      },
      { merge: true }
    )
  } catch (error) {
    console.error('Error marking tasks as viewed:', error)
  }
}

/**
 * Subscribe to check if there are unviewed tasks for a chat
 * Returns true if any task's createdAt is after the lastViewed timestamp
 */
export function subscribeToHasUnviewedTasks(userId, chatId, chatType, callback) {
  if (!userId || !chatId) {
    callback(false)
    return () => {}
  }

  const chatKey = `${chatType}:${chatId}`
  let lastViewedTime = null
  let tasks = []
  let unsubTasks = null
  let unsubViewed = null

  // Helper to check and callback
  const checkUnviewed = () => {
    if (tasks.length === 0) {
      callback(false)
      return
    }

    // If never viewed, all tasks are "unread"
    if (!lastViewedTime) {
      callback(true)
      return
    }

    // Check if any task was created after last viewed
    const hasUnviewed = tasks.some(task => {
      const taskTime = task.createdAt?.toMillis?.() || task.createdAt?.seconds * 1000 || 0
      const viewedTime = lastViewedTime?.toMillis?.() || lastViewedTime?.seconds * 1000 || 0
      return taskTime > viewedTime
    })

    callback(hasUnviewed)
  }

  // Subscribe to tasks
  const tasksRef = collection(db, 'tasks')
  const q = query(
    tasksRef,
    where('chatId', '==', chatId),
    where('chatType', '==', chatType),
    orderBy('createdAt', 'desc')
  )

  unsubTasks = onSnapshot(
    q,
    snapshot => {
      tasks = []
      snapshot.forEach(doc => {
        tasks.push({ id: doc.id, ...doc.data() })
      })
      checkUnviewed()
    },
    error => {
      console.error('Error subscribing to tasks for unviewed check:', error)
      callback(false)
    }
  )

  // Subscribe to viewed timestamp
  const tasksViewedRef = doc(db, 'tasksViewed', userId)
  unsubViewed = onSnapshot(
    tasksViewedRef,
    docSnap => {
      if (docSnap.exists()) {
        lastViewedTime = docSnap.data()[chatKey] || null
      } else {
        lastViewedTime = null
      }
      checkUnviewed()
    },
    error => {
      console.error('Error subscribing to tasks viewed time:', error)
    }
  )

  return () => {
    if (unsubTasks) unsubTasks()
    if (unsubViewed) unsubViewed()
  }
}

/**
 * Toggle task completion status
 */
export async function toggleTaskComplete(taskId, userId, userName) {
  if (!taskId) return

  try {
    const taskRef = doc(db, 'tasks', taskId)
    const taskSnap = await getDoc(taskRef)

    if (taskSnap.exists()) {
      const task = taskSnap.data()
      const nowComplete = !task.completed

      await updateDoc(taskRef, {
        completed: nowComplete,
        completedAt: nowComplete ? serverTimestamp() : null,
        completedBy: nowComplete ? userName : null,
        status: nowComplete ? 'complete' : 'pending',
      })

      console.log(`✅ Task ${taskId} marked as ${nowComplete ? 'complete' : 'pending'}`)
    }
  } catch (error) {
    console.error('Error toggling task completion:', error)
    throw error
  }
}

/**
 * Delete a task
 */
export async function deleteTask(taskId) {
  if (!taskId) return

  try {
    await deleteDoc(doc(db, 'tasks', taskId))
    console.log('🗑️ Task deleted:', taskId)
  } catch (error) {
    console.error('Error deleting task:', error)
    throw error
  }
}

/**
 * Update task details
 */
export async function updateTask(taskId, updates) {
  if (!taskId) return

  try {
    const taskRef = doc(db, 'tasks', taskId)
    await updateDoc(taskRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    })
    console.log('📝 Task updated:', taskId)
  } catch (error) {
    console.error('Error updating task:', error)
    throw error
  }
}
