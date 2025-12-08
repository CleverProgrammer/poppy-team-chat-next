import { doc, setDoc, getDoc, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, getDocs, collectionGroup } from 'firebase/firestore';
import { db } from './firebase';

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

  try {
    await setDoc(doc(db, 'users', userId), {
      currentChat: chatData,
      lastSeen: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error('Error saving current chat:', error);
  }
}

export async function getCurrentChat(userId) {
  if (!userId) return null;

  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      const data = userDoc.data();
      return data?.currentChat || null;
    }
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
