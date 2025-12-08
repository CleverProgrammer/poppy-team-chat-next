import { doc, setDoc, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
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
      text: text.trim(),
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

export async function sendMessageDM(dmId, user, text) {
  if (!user || !text.trim()) return;

  try {
    const messagesRef = collection(db, 'dms', dmId, 'messages');
    await addDoc(messagesRef, {
      text: text.trim(),
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
