import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import {
  AppleAuthProvider,
  connectAuthEmulator,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithPhoneNumber,
  signOut as firebaseSignOut,
  type FirebaseAuthTypes,
} from '@react-native-firebase/auth';
import {
  addDoc,
  collection,
  connectFirestoreEmulator,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  limitToLast,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from '@react-native-firebase/firestore';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

import {
  AUTH_EMULATOR_PORT,
  DISCOVERY_PAGE_SIZE,
  emulatorHost,
  FIRESTORE_EMULATOR_PORT,
} from './config';
import { BackendError, toBackendError } from './errors';
import { filterDiscovery, matchIdFor, MESSAGE_MAX, otherUid, toPublicProfile } from './shared';
import type { AuthUser, Backend, LikeResult, Match } from './types';

const auth = getAuth();
const db = getFirestore();

const host = emulatorHost();
if (host) {
  connectAuthEmulator(auth, `http://${host}:${AUTH_EMULATOR_PORT}`);
  connectFirestoreEmulator(db, host, FIRESTORE_EMULATOR_PORT);
}

GoogleSignin.configure({ webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID });

// The SMS confirmation can't cross navigation params, so S1B parks it here for S1C.
type Snapshot = { id: string; data(): Record<string, unknown> };

let pendingConfirmation: FirebaseAuthTypes.ConfirmationResult | null = null;

function toAuthUser(user: FirebaseAuthTypes.User): AuthUser {
  return {
    uid: user.uid,
    phoneNumber: user.phoneNumber,
    email: user.email,
    displayName: user.displayName,
  };
}

async function run<T>(task: () => Promise<T>): Promise<T> {
  try {
    return await task();
  } catch (error) {
    throw toBackendError(error);
  }
}

const MESSAGE_PAGE_SIZE = 200;

/** A Firestore timestamp as epoch ms; a pending server timestamp reads as null → now. */
function epochMs(value: unknown): number {
  if (typeof value === 'object' && value !== null && 'toMillis' in value) {
    return (value as { toMillis(): number }).toMillis();
  }
  return Date.now();
}

/** My matches, newest first. A match whose other profile is gone is skipped. */
async function loadMatches(uid: string, docs: Snapshot[]): Promise<Match[]> {
  const rows = await Promise.all(
    docs.map(async (match) => {
      const otherId = otherUid(match.id, uid);
      const profile = await getDoc(doc(db, 'profiles', otherId));
      const data = profile.data();
      return data
        ? {
            id: match.id,
            other: { id: otherId, ...toPublicProfile(data) },
            createdAt: epochMs(match.data().createdAt),
          }
        : null;
    }),
  );
  // Sorted on the device so the query needs no composite index (users + createdAt).
  return rows.filter((row): row is Match => row !== null).sort((a, b) => b.createdAt - a.createdAt);
}

export const backend: Backend = {
  onAuthChanged(listener) {
    return onAuthStateChanged(auth, (user) => listener(user ? toAuthUser(user) : null));
  },

  async isAppleSignInAvailable() {
    return Platform.OS === 'ios' && (await AppleAuthentication.isAvailableAsync());
  },

  signInWithApple: () =>
    run(async () => {
      // Apple signs a hash of the nonce; Firebase checks it against the raw one.
      const rawNonce = Crypto.randomUUID();
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce,
      );
      const result = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });
      if (!result.identityToken) throw new BackendError('unknown');
      await signInWithCredential(
        auth,
        AppleAuthProvider.credential(result.identityToken, rawNonce),
      );
    }),

  signInWithGoogle: () =>
    run(async () => {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();
      if (response.type === 'cancelled') throw new BackendError('cancelled');
      const idToken = response.data.idToken;
      if (!idToken) throw new BackendError('unknown');
      await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
    }),

  startPhoneSignIn: (e164Phone) =>
    run(async () => {
      pendingConfirmation = await signInWithPhoneNumber(auth, e164Phone);
    }),

  confirmPhoneCode: (code) =>
    run(async () => {
      if (!pendingConfirmation) throw new BackendError('no_pending_code');
      await pendingConfirmation.confirm(code);
      pendingConfirmation = null;
    }),

  signOut: () =>
    run(async () => {
      pendingConfirmation = null;
      await GoogleSignin.signOut().catch(() => undefined);
      await firebaseSignOut(auth);
    }),

  getProfile: (uid) =>
    run(async () => {
      const snapshot = await getDoc(doc(db, 'profiles', uid));
      const data = snapshot.data();
      return data ? toPublicProfile(data) : null;
    }),

  saveOnboarding: (uid, { profile, account }) =>
    run(async () => {
      const batch = writeBatch(db);
      batch.set(doc(db, 'profiles', uid), {
        ...profile,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.set(doc(db, 'users', uid), {
        ...account,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
    }),

  listDiscovery: (uid) =>
    run(async () => {
      // shortcut: newest-unfiltered page of 50, filtered on the device; move ranking and
      // distance to a Cloud Function once the Blaze plan is on (docs/architecture.md).
      const [profiles, swipes] = await Promise.all([
        getDocs(
          query(collection(db, 'profiles'), orderBy('createdAt'), limit(DISCOVERY_PAGE_SIZE)),
        ),
        getDocs(collection(db, 'users', uid, 'swipes')),
      ]);
      return filterDiscovery(
        uid,
        profiles.docs.map((d: Snapshot) => ({ id: d.id, data: d.data() })),
        new Set(swipes.docs.map((d: Snapshot) => d.id)),
      );
    }),

  recordSwipe: (uid, targetId, direction) =>
    run(async () => {
      await setDoc(doc(db, 'users', uid, 'swipes', targetId), {
        direction,
        createdAt: serverTimestamp(),
      });
    }),

  like: (uid, targetId) =>
    run<LikeResult>(async () => {
      // A batch cannot see its own writes, so the like back is read first.
      const reverse = await getDoc(doc(db, 'likes', uid, 'from', targetId));
      const matched = reverse.data() !== undefined;
      const matchId = matchIdFor(uid, targetId);
      const batch = writeBatch(db);
      batch.set(doc(db, 'users', uid, 'swipes', targetId), {
        direction: 'like',
        createdAt: serverTimestamp(),
      });
      batch.set(doc(db, 'likes', targetId, 'from', uid), { createdAt: serverTimestamp() });
      if (matched) {
        // Both likes exist once this batch lands, so the rules allow the match.
        batch.set(doc(db, 'matches', matchId), {
          users: [uid, targetId].sort(),
          createdAt: serverTimestamp(),
        });
      }
      await batch.commit();
      return matched ? { matched: true, matchId } : { matched: false };
    }),

  reconcileMatches: (uid) =>
    run(async () => {
      // Two likes written at the same moment both saw "no like back"; fill in the gap.
      const [likes, swipes] = await Promise.all([
        getDocs(collection(db, 'likes', uid, 'from')),
        getDocs(collection(db, 'users', uid, 'swipes')),
      ]);
      const likedMe = new Set(likes.docs.map((d: Snapshot) => d.id));
      for (const swipe of swipes.docs) {
        if (swipe.data().direction !== 'like' || !likedMe.has(swipe.id)) continue;
        const matchId = matchIdFor(uid, swipe.id);
        const existing = await getDoc(doc(db, 'matches', matchId));
        if (existing.data()) continue;
        await setDoc(doc(db, 'matches', matchId), {
          users: [uid, swipe.id].sort(),
          createdAt: serverTimestamp(),
        });
      }
    }),

  onMatches: (uid, listener, onError) => {
    // Each snapshot loads profiles; only the latest snapshot's result may reach the screen.
    let latest = 0;
    return onSnapshot(
      query(collection(db, 'matches'), where('users', 'array-contains', uid)),
      (snapshot: { docs: Snapshot[] }) => {
        const seq = (latest += 1);
        void loadMatches(uid, snapshot.docs).then(
          (matches) => {
            if (seq === latest) listener(matches);
          },
          () => {
            if (seq === latest) onError();
          },
        );
      },
      () => onError(),
    );
  },

  getMatch: (uid, matchId) =>
    run(async () => {
      const snapshot = await getDoc(doc(db, 'matches', matchId));
      const match = snapshot.data();
      if (!match) return null;
      const otherId = otherUid(matchId, uid);
      const profile = await getDoc(doc(db, 'profiles', otherId));
      const data = profile.data();
      if (!data) return null;
      return {
        id: matchId,
        other: { id: otherId, ...toPublicProfile(data) },
        createdAt: epochMs(match.createdAt),
      };
    }),

  onMessages: (matchId, listener, onError) =>
    onSnapshot(
      query(
        collection(db, 'matches', matchId, 'messages'),
        orderBy('createdAt', 'asc'),
        // The newest page, still oldest first.
        limitToLast(MESSAGE_PAGE_SIZE),
      ),
      (snapshot: { docs: Snapshot[] }) => {
        listener(
          snapshot.docs.map((message: Snapshot) => {
            const data = message.data();
            return {
              id: message.id,
              from: String(data.from),
              text: String(data.text),
              // Null while my own server timestamp is pending.
              createdAt: data.createdAt ? epochMs(data.createdAt) : null,
            };
          }),
        );
      },
      () => onError(),
    ),

  sendMessage: (uid, matchId, text) =>
    run(async () => {
      const trimmed = text.trim();
      if (!trimmed || trimmed.length > MESSAGE_MAX) throw new BackendError('unknown');
      await addDoc(collection(db, 'matches', matchId, 'messages'), {
        from: uid,
        text: trimmed,
        createdAt: serverTimestamp(),
      });
    }),
};
