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
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from './firebase'

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

export async function sendMessage(channelId, user, text) {
  if (!user || !text.trim()) return

  try {
    const messagesRef = collection(db, 'channels', channelId, 'messages')
    const docRef = await addDoc(messagesRef, {
      text: text,
      sender: user.displayName || user.email,
      senderId: user.uid,
      photoURL: user.photoURL || '',
      timestamp: serverTimestamp(),
    })

    // Index to Ragie (fire and forget, don't block send)
    fetch('/api/ragie/sync', {
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
    }).catch(err => console.error('Ragie sync failed:', err))
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

export async function sendMessageDM(dmId, user, text, recipientId, recipient = null) {
  if (!user || !text.trim()) return

  console.log('═══════════════════════════════════════════════════════════')
  console.log('📤 [SEND DM] SENDING MESSAGE')
  console.log('═══════════════════════════════════════════════════════════')
  console.log(`📨 DM ID: ${dmId}`)
  console.log(`👤 Sender: ${user.displayName || user.email} (${user.uid})`)
  console.log(`🎯 Recipient ID: ${recipientId}`)
  console.log(`💬 Text: "${text.substring(0, 50)}..."`)
  console.log('───────────────────────────────────────────────────────────')

  try {
    const messagesRef = collection(db, 'dms', dmId, 'messages')
    console.log('📝 Writing to Firestore: dms/' + dmId + '/messages')

    const docRef = await addDoc(messagesRef, {
      text: text,
      sender: user.displayName || user.email,
      senderId: user.uid,
      photoURL: user.photoURL || '',
      timestamp: serverTimestamp(),
    })

    console.log('✅ [SEND DM] Message written to Firestore!')
    console.log(`📝 Document ID: ${docRef.id}`)
    console.log('🔔 Firebase Cloud Function should trigger now...')
    console.log('═══════════════════════════════════════════════════════════')

    // Index to Ragie (fire and forget, don't block send)
    fetch('/api/ragie/sync', {
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
    }).catch(err => console.error('Ragie sync failed:', err))

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
export function subscribeToLastMessages(userId, dmUserIds, callback) {
  if (!userId || !dmUserIds || dmUserIds.length === 0) {
    callback({})
    return () => {}
  }

  const unsubscribes = []
  const lastMessages = {}

  dmUserIds.forEach(otherUserId => {
    const dmId = getDMId(userId, otherUserId)
    const messagesRef = collection(db, 'dms', dmId, 'messages')
    const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(1))

    const unsubscribe = onSnapshot(
      q,
      snapshot => {
        if (!snapshot.empty) {
          const doc = snapshot.docs[0]
          lastMessages[otherUserId] = {
            id: doc.id,
            ...doc.data(),
          }
        } else {
          lastMessages[otherUserId] = null
        }
        // Callback with updated lastMessages object
        callback({ ...lastMessages })
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
export function subscribeToChannelLastMessages(channelIds, callback) {
  if (!channelIds || channelIds.length === 0) {
    callback({})
    return () => {}
  }

  const unsubscribes = []
  const lastMessages = {}

  channelIds.forEach(channelId => {
    const messagesRef = collection(db, 'channels', channelId, 'messages')
    const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(1))

    const unsubscribe = onSnapshot(
      q,
      snapshot => {
        if (!snapshot.empty) {
          const doc = snapshot.docs[0]
          lastMessages[channelId] = {
            id: doc.id,
            ...doc.data(),
          }
        } else {
          lastMessages[channelId] = null
        }
        callback({ ...lastMessages })
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

    // Index to Ragie (fire and forget, don't block send)
    // 1. Sync accompanying text (if any)
    if (text) {
      fetch('/api/ragie/sync', {
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
      }).catch(err => console.error('Ragie text sync failed:', err))
    }

    // 2. Sync each image to Ragie - extract captions/OCR from images
    allImageUrls.forEach((url, index) => {
      fetch('/api/ragie/sync-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: docRef.id + '_img' + (index > 0 ? `_${index}` : ''),
          chatId: channelId,
          chatType: 'channel',
          imageUrl: url,
          text,
          sender: user.displayName || user.email,
          senderEmail: user.email,
          senderId: user.uid,
          timestamp: new Date().toISOString(),
        }),
      }).catch(err => console.error('Ragie image sync failed:', err))
    })
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

    // Index to Ragie (fire and forget, don't block send)
    // 1. Sync accompanying text (if any)
    if (text) {
      fetch('/api/ragie/sync', {
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
      }).catch(err => console.error('Ragie text sync failed:', err))
    }

    // 2. Sync each image to Ragie - extract captions/OCR from images
    allImageUrls.forEach((url, index) => {
      fetch('/api/ragie/sync-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: docRef.id + '_img' + (index > 0 ? `_${index}` : ''),
          chatId: dmId,
          chatType: 'dm',
          imageUrl: url,
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
      }).catch(err => console.error('Ragie image sync failed:', err))
    })

    // Add to active DMs
    await addActiveDM(user.uid, recipientId)
    await addActiveDM(recipientId, user.uid)
  } catch (error) {
    console.error('Error sending DM with image:', error)
    throw error
  }
}

// Send message with media (images and/or Mux videos)
export async function sendMessageWithMedia(channelId, user, text = '', imageUrls = [], muxPlaybackIds = [], replyTo = null) {
  if (!user || (imageUrls.length === 0 && muxPlaybackIds.length === 0)) return

  try {
    const messagesRef = collection(db, 'channels', channelId, 'messages')
    const messageData = {
      text: text,
      imageUrl: imageUrls[0] || null, // Keep for backwards compatibility
      imageUrls: imageUrls.length > 0 ? imageUrls : null,
      muxPlaybackIds: muxPlaybackIds.length > 0 ? muxPlaybackIds : null,
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

    // Index text to Ragie if present
    if (text) {
      fetch('/api/ragie/sync', {
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
      }).catch(err => console.error('Ragie sync failed:', err))
    }
  } catch (error) {
    console.error('Error sending message with media:', error)
    throw error
  }
}

// Send DM with media (images and/or Mux videos)
export async function sendMessageDMWithMedia(dmId, user, recipientId, text = '', recipient = null, imageUrls = [], muxPlaybackIds = [], replyTo = null) {
  if (!user || (imageUrls.length === 0 && muxPlaybackIds.length === 0)) return

  try {
    const messagesRef = collection(db, 'dms', dmId, 'messages')
    const messageData = {
      text: text,
      imageUrl: imageUrls[0] || null, // Keep for backwards compatibility
      imageUrls: imageUrls.length > 0 ? imageUrls : null,
      muxPlaybackIds: muxPlaybackIds.length > 0 ? muxPlaybackIds : null,
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

    // Index text to Ragie if present
    if (text) {
      fetch('/api/ragie/sync', {
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
      }).catch(err => console.error('Ragie sync failed:', err))
    }

    // Add to active DMs
    await addActiveDM(user.uid, recipientId)
    await addActiveDM(recipientId, user.uid)
  } catch (error) {
    console.error('Error sending DM with media:', error)
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
export async function sendMessageWithReply(channelId, user, text, replyTo) {
  if (!user || !text.trim()) return

  try {
    const messagesRef = collection(db, 'channels', channelId, 'messages')
    const docRef = await addDoc(messagesRef, {
      text: text,
      sender: user.displayName || user.email,
      senderId: user.uid,
      photoURL: user.photoURL || '',
      timestamp: serverTimestamp(),
      replyTo: {
        msgId: replyTo.msgId,
        sender: replyTo.sender,
        text: replyTo.text,
      },
    })

    // Index to Ragie (fire and forget, don't block send)
    fetch('/api/ragie/sync', {
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
    }).catch(err => console.error('Ragie sync failed:', err))
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
  recipient = null
) {
  if (!user || !text.trim()) return

  try {
    const messagesRef = collection(db, 'dms', dmId, 'messages')
    const docRef = await addDoc(messagesRef, {
      text: text,
      sender: user.displayName || user.email,
      senderId: user.uid,
      photoURL: user.photoURL || '',
      timestamp: serverTimestamp(),
      replyTo: {
        msgId: replyTo.msgId,
        sender: replyTo.sender,
        text: replyTo.text,
      },
    })

    // Index to Ragie (fire and forget, don't block send)
    fetch('/api/ragie/sync', {
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
    }).catch(err => console.error('Ragie sync failed:', err))

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

    // Index to Ragie (fire and forget, don't block send)
    fetch('/api/ragie/sync', {
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
    }).catch(err => console.error('Ragie sync failed:', err))
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
