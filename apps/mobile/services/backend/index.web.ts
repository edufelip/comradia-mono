import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithPopup,
  signOut as firebaseSignOut,
  type ConfirmationResult,
  type User,
} from 'firebase/auth';
import {
  addDoc,
  collection,
  connectFirestoreEmulator,
  doc,
  getDoc,
  getDocs,
  initializeFirestore,
  limit,
  limitToLast,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

import {
  AUTH_EMULATOR_PORT,
  DEMO_PROJECT_ID,
  DISCOVERY_PAGE_SIZE,
  emulatorHost,
  FIRESTORE_EMULATOR_PORT,
} from './config';
import { BackendError, toBackendError } from './errors';
import { filterDiscovery, matchIdFor, MESSAGE_MAX, otherUid, toPublicProfile } from './shared';
import type { AuthUser, Backend, LikeResult, Match } from './types';

const host = emulatorHost();

// Web config is public by design (security comes from Auth + Firestore rules). With the
// emulators, always use the demo project so tests never reach a real one.
const app = getApps().length
  ? getApp()
  : initializeApp(
      host
        ? {
            apiKey: 'demo-api-key',
            authDomain: `${DEMO_PROJECT_ID}.firebaseapp.com`,
            projectId: DEMO_PROJECT_ID,
          }
        : {
            apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
            authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
            projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
            appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
          },
    );

const auth = getAuth(app);
// WebKit buffers Firestore's streaming channel: after a reload, query results arrived
// ~30 s late. Plain long-polling requests avoid that on every browser.
const db = initializeFirestore(app, { experimentalForceLongPolling: true });

if (host) {
  connectAuthEmulator(auth, `http://${host}:${AUTH_EMULATOR_PORT}`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, FIRESTORE_EMULATOR_PORT);
  // The emulator never sends real SMS, so skip the reCAPTCHA challenge.
  auth.settings.appVerificationDisabledForTesting = true;
}

let pendingConfirmation: ConfirmationResult | null = null;
let recaptcha: RecaptchaVerifier | null = null;

/** A fresh verifier per attempt: a used one never fires again, which broke "resend". */
function invisibleRecaptcha(): RecaptchaVerifier {
  recaptcha?.clear();
  let container = document.getElementById('recaptcha-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'recaptcha-container';
    document.body.appendChild(container);
  }
  recaptcha = new RecaptchaVerifier(auth, container, { size: 'invisible' });
  return recaptcha;
}

function toAuthUser(user: User): AuthUser {
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

type Snapshot = { id: string; data(): Record<string, unknown> };

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

  // Sign in with Apple is offered on iPhone only (App Store rule 4.8).
  isAppleSignInAvailable: async () => false,

  signInWithApple: async () => {
    throw new BackendError('unknown');
  },

  signInWithGoogle: () =>
    run(async () => {
      await signInWithPopup(auth, new GoogleAuthProvider());
    }),

  startPhoneSignIn: (e164Phone) =>
    run(async () => {
      pendingConfirmation = await signInWithPhoneNumber(auth, e164Phone, invisibleRecaptcha());
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
      // shortcut: one unranked page of 50, filtered on the device; move ranking and distance
      // to a Cloud Function once the Blaze plan is on (docs/architecture.md).
      const [profiles, swipes] = await Promise.all([
        getDocs(
          query(collection(db, 'profiles'), orderBy('createdAt'), limit(DISCOVERY_PAGE_SIZE)),
        ),
        getDocs(collection(db, 'users', uid, 'swipes')),
      ]);
      return filterDiscovery(
        uid,
        profiles.docs.map((d) => ({ id: d.id, data: d.data() })),
        new Set(swipes.docs.map((d) => d.id)),
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
      const likedMe = new Set(likes.docs.map((d) => d.id));
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
      (snapshot) => {
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
      (snapshot) => {
        listener(
          snapshot.docs.map((message) => {
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
