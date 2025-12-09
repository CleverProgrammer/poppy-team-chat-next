import { doc, setDoc, getDoc, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, getDocs, collectionGroup, updateDoc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase';

export async function saveUser(user) {
  if (!user) return;

  try {
    await setDoc(doc(db, 'users', user.uid), {
      uid: user.uid,
      displayName: user.displayName || user.email,
      email: user.email,
      photoURL: user.photoURL || '',
      lastSeen: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error('Error saving user:', error);
  }
}

export async function sendMessage(channelId, user, text) {
  if (!user || !text.trim()) return;

  try {
    const messagesRef = collection(db, 'channels', channelId, 'messages');
    await addDoc(messagesRef, {
      text: text,
      sender: user.displayName || user.email,
      senderId: user.uid,
      photoURL: user.photoURL || '',
      timestamp: serverTimestamp()
    });
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
}

export function subscribeToMessages(channelId, callback) {
  const messagesRef = collection(db, 'channels', channelId, 'messages');
  const q = query(messagesRef, orderBy('timestamp', 'asc'));

  return onSnapshot(q, (snapshot) => {
    const messages = [];
    snapshot.forEach((doc) => {
      messages.push({
        id: doc.id,
        ...doc.data()
      });
    });
    callback(messages);
  }, (error) => {
    console.error('Error loading messages:', error);
  });
}

export function subscribeToMessagesDM(dmId, callback) {
  const messagesRef = collection(db, 'dms', dmId, 'messages');
  const q = query(messagesRef, orderBy('timestamp', 'asc'));

  return onSnapshot(q, (snapshot) => {
    const messages = [];
    snapshot.forEach((doc) => {
      messages.push({
        id: doc.id,
        ...doc.data()
      });
    });
    callback(messages);
  }, (error) => {
    console.error('Error loading messages:', error);
  });
}

export async function sendMessageDM(dmId, user, text, recipientId) {
  if (!user || !text.trim()) return;

  try {
    const messagesRef = collection(db, 'dms', dmId, 'messages');
    await addDoc(messagesRef, {
      text: text,
      sender: user.displayName || user.email,
      senderId: user.uid,
      photoURL: user.photoURL || '',
      timestamp: serverTimestamp()
    });

    // Add both users to each other's active DMs
    if (recipientId) {
      await addActiveDM(user.uid, recipientId);
      await addActiveDM(recipientId, user.uid);
    }
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
}

export function subscribeToUsers(callback) {
  return onSnapshot(collection(db, 'users'), (snapshot) => {
    const users = [];
    snapshot.forEach((doc) => {
      users.push({
        id: doc.id,
        ...doc.data()
      });
    });
    callback(users);
  }, (error) => {
    console.error('Error loading users:', error);
  });
}

export function getDMId(userId1, userId2) {
  return [userId1, userId2].sort().join('_');
}

export async function saveCurrentChat(userId, chatData) {
  if (!userId) return;

  console.log('📌 [Firestore] saveCurrentChat called with:', { userId, chatData });
  try {
    await setDoc(doc(db, 'users', userId), {
      currentChat: chatData,
      lastSeen: serverTimestamp()
    }, { merge: true });
    console.log('📌 [Firestore] saveCurrentChat SUCCESS');
  } catch (error) {
    console.error('Error saving current chat:', error);
  }
}

export async function getCurrentChat(userId) {
  if (!userId) return null;

  console.log('📌 [Firestore] getCurrentChat called for userId:', userId);
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      const data = userDoc.data();
      console.log('📌 [Firestore] getCurrentChat found:', data?.currentChat);
      return data?.currentChat || null;
    }
    console.log('📌 [Firestore] getCurrentChat - user doc does not exist');
    return null;
  } catch (error) {
    console.error('Error loading current chat:', error);
    return null;
  }
}

export async function addActiveDM(userId, dmUserId) {
  if (!userId || !dmUserId) return;

  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    const currentActiveDMs = userDoc.exists() ? (userDoc.data().activeDMs || []) : [];

    if (!currentActiveDMs.includes(dmUserId)) {
      await setDoc(doc(db, 'users', userId), {
        activeDMs: [...currentActiveDMs, dmUserId],
        lastSeen: serverTimestamp()
      }, { merge: true });
    }
  } catch (error) {
    console.error('Error adding active DM:', error);
  }
}

export function subscribeToActiveDMs(userId, callback) {
  if (!userId) return () => {};

  return onSnapshot(doc(db, 'users', userId), (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      callback(data?.activeDMs || []);
    } else {
      callback([]);
    }
  }, (error) => {
    console.error('Error loading active DMs:', error);
    callback([]);
  });
}

export async function discoverExistingDMs(userId) {
  if (!userId) return;

  try {
    // Query all messages in DM subcollections (much more efficient)
    const q = query(collectionGroup(db, 'messages'));
    const messagesSnapshot = await getDocs(q);
    const dmUserIds = new Set();

    // Extract DM IDs from paths where this user is involved
    messagesSnapshot.forEach((messageDoc) => {
      const pathParts = messageDoc.ref.path.split('/');
      // Path format: dms/{dmId}/messages/{messageId}
      if (pathParts[0] === 'dms' && pathParts.length >= 2) {
        const dmId = pathParts[1];
        const [user1, user2] = dmId.split('_');

        // Check if current user is involved in this DM
        if (user1 === userId || user2 === userId) {
          const otherUserId = user1 === userId ? user2 : user1;
          if (otherUserId !== userId) {
            dmUserIds.add(otherUserId);
          }
        }
      }
    });

    const existingDMs = Array.from(dmUserIds);

    // Update the user's activeDMs in Firestore
    if (existingDMs.length > 0) {
      await setDoc(doc(db, 'users', userId), {
        activeDMs: existingDMs,
        lastSeen: serverTimestamp()
      }, { merge: true });
    }
  } catch (error) {
    console.error('Error discovering existing DMs:', error);
  }
}

// Image upload helper function
export async function uploadImage(file, userId) {
  if (!file) throw new Error('No file provided');

  try {
    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const filename = `${userId}/${timestamp}_${file.name}`;
    const storageRef = ref(storage, `chat-images/${filename}`);

    // Upload the file
    const snapshot = await uploadBytes(storageRef, file);

    // Get download URL
    const downloadURL = await getDownloadURL(snapshot.ref);

    return downloadURL;
  } catch (error) {
    console.error('Error uploading image:', error);
    throw error;
  }
}

// Send message with image
export async function sendMessageWithImage(channelId, user, imageUrl, text = '') {
  if (!user || !imageUrl) return;

  try {
    const messagesRef = collection(db, 'channels', channelId, 'messages');
    await addDoc(messagesRef, {
      text: text,
      imageUrl: imageUrl,
      sender: user.displayName || user.email,
      senderId: user.uid,
      photoURL: user.photoURL || '',
      timestamp: serverTimestamp()
    });
  } catch (error) {
    console.error('Error sending message with image:', error);
    throw error;
  }
}

// Send DM with image
export async function sendMessageDMWithImage(dmId, user, imageUrl, recipientId, text = '') {
  if (!user || !imageUrl) return;

  try {
    const messagesRef = collection(db, 'dms', dmId, 'messages');
    await addDoc(messagesRef, {
      text: text,
      imageUrl: imageUrl,
      sender: user.displayName || user.email,
      senderId: user.uid,
      photoURL: user.photoURL || '',
      timestamp: serverTimestamp()
    });

    // Add to active DMs
    await addActiveDM(user.uid, recipientId);
    await addActiveDM(recipientId, user.uid);
  } catch (error) {
    console.error('Error sending DM with image:', error);
    throw error;
  }
}

// Add reaction to a message
export async function addReaction(channelId, messageId, userId, emoji, isDM = false) {
  try {
    const messagesRef = isDM
      ? doc(db, 'dms', channelId, 'messages', messageId)
      : doc(db, 'channels', channelId, 'messages', messageId);

    const msgSnap = await getDoc(messagesRef);
    const reactions = msgSnap.data()?.reactions || {};

    // Toggle reaction: remove if same emoji, otherwise set new one
    if (reactions[userId] === emoji) {
      delete reactions[userId];
    } else {
      reactions[userId] = emoji;
    }

    await updateDoc(messagesRef, { reactions });
  } catch (error) {
    console.error('Error adding reaction:', error);
    throw error;
  }
}

// Edit message
export async function editMessage(channelId, messageId, newText, isDM = false) {
  try {
    const messagesRef = isDM
      ? doc(db, 'dms', channelId, 'messages', messageId)
      : doc(db, 'channels', channelId, 'messages', messageId);

    await updateDoc(messagesRef, {
      text: newText,
      edited: true,
      editedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error editing message:', error);
    throw error;
  }
}

// Delete message
export async function deleteMessage(channelId, messageId, isDM = false) {
  try {
    const messagesRef = isDM
      ? doc(db, 'dms', channelId, 'messages', messageId)
      : doc(db, 'channels', channelId, 'messages', messageId);

    await deleteDoc(messagesRef);
  } catch (error) {
    console.error('Error deleting message:', error);
    throw error;
  }
}

// Send message with reply
export async function sendMessageWithReply(channelId, user, text, replyTo) {
  if (!user || !text.trim()) return;

  try {
    const messagesRef = collection(db, 'channels', channelId, 'messages');
    await addDoc(messagesRef, {
      text: text,
      sender: user.displayName || user.email,
      senderId: user.uid,
      photoURL: user.photoURL || '',
      timestamp: serverTimestamp(),
      replyTo: {
        msgId: replyTo.msgId,
        sender: replyTo.sender,
        text: replyTo.text
      }
    });
  } catch (error) {
    console.error('Error sending message with reply:', error);
    throw error;
  }
}

// Send DM with reply
export async function sendMessageDMWithReply(dmId, user, text, recipientId, replyTo) {
  if (!user || !text.trim()) return;

  try {
    const messagesRef = collection(db, 'dms', dmId, 'messages');
    await addDoc(messagesRef, {
      text: text,
      sender: user.displayName || user.email,
      senderId: user.uid,
      photoURL: user.photoURL || '',
      timestamp: serverTimestamp(),
      replyTo: {
        msgId: replyTo.msgId,
        sender: replyTo.sender,
        text: replyTo.text
      }
    });

    // Add to active DMs
    await addActiveDM(user.uid, recipientId);
    await addActiveDM(recipientId, user.uid);
  } catch (error) {
    console.error('Error sending DM with reply:', error);
    throw error;
  }
}

// Get emoji usage for user
export async function getEmojiUsage(userId) {
  if (!userId) return {};

  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      return userDoc.data()?.emojiUsage || {};
    }
    return {};
  } catch (error) {
    console.error('Error getting emoji usage:', error);
    return {};
  }
}

// Update emoji usage count
export async function updateEmojiUsage(userId, emoji) {
  if (!userId || !emoji) return;

  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    const currentUsage = userDoc.exists() ? (userDoc.data().emojiUsage || {}) : {};

    // Increment count for this emoji
    currentUsage[emoji] = (currentUsage[emoji] || 0) + 1;

    await setDoc(doc(db, 'users', userId), {
      emojiUsage: currentUsage,
      lastSeen: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error('Error updating emoji usage:', error);
  }
}

// Mark DM messages as read
export async function markDMMessagesAsRead(dmId, userId, messageIds) {
  if (!dmId || !userId || !messageIds || messageIds.length === 0) return;

  try {
    const batch = [];
    const messagesRef = collection(db, 'dms', dmId, 'messages');

    for (const messageId of messageIds) {
      const messageRef = doc(messagesRef, messageId);
      batch.push(
        updateDoc(messageRef, {
          [`readBy.${userId}`]: serverTimestamp()
        })
      );
    }

    await Promise.all(batch);
  } catch (error) {
    console.error('Error marking messages as read:', error);
  }
}

// AI Chat functions
export async function sendAIMessage(userId, text, isAI = false) {
  if (!userId || !text.trim()) return;

  try {
    const messagesRef = collection(db, 'aiChats', userId, 'messages');
    await addDoc(messagesRef, {
      text: text,
      sender: isAI ? '🤖 Poppy AI' : null,
      senderId: isAI ? 'ai' : userId,
      timestamp: serverTimestamp()
    });
  } catch (error) {
    console.error('Error sending AI message:', error);
    throw error;
  }
}

export function subscribeToAIMessages(userId, callback) {
  const messagesRef = collection(db, 'aiChats', userId, 'messages');
  const q = query(messagesRef, orderBy('timestamp', 'asc'));

  return onSnapshot(q, (snapshot) => {
    const messages = [];
    snapshot.forEach((doc) => {
      messages.push({
        id: doc.id,
        ...doc.data()
      });
    });
    callback(messages);
  });
}
