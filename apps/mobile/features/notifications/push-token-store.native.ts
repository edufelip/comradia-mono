import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  serverTimestamp,
  setDoc,
  writeBatch,
} from '@react-native-firebase/firestore';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

const db = getFirestore();
const DELETE_BATCH_SIZE = 450;

export async function hashPushToken(token: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, token);
}

export async function registerPushToken(uid: string, token: string, hash: string): Promise<void> {
  if (!token || !/^[a-f0-9]{64}$/.test(hash)) throw new Error('Invalid push token registration');
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    throw new Error('Push token registration requires a native platform');
  }

  await setDoc(doc(db, 'users', uid, 'pushTokens', hash), {
    token,
    platform: Platform.OS,
    updatedAt: serverTimestamp(),
  });
}

export async function revokePushToken(uid: string, hash: string): Promise<void> {
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error('Invalid push token hash');
  await deleteDoc(doc(db, 'users', uid, 'pushTokens', hash));
}

export async function revokeAllPushTokens(uid: string): Promise<void> {
  const snapshot = await getDocs(collection(db, 'users', uid, 'pushTokens'));
  for (let start = 0; start < snapshot.docs.length; start += DELETE_BATCH_SIZE) {
    const batch = writeBatch(db);
    for (const registration of snapshot.docs.slice(start, start + DELETE_BATCH_SIZE)) {
      batch.delete(registration.ref);
    }
    await batch.commit();
  }
}
