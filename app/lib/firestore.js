import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
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
