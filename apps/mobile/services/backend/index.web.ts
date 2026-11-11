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
  collection,
  connectFirestoreEmulator,
  doc,
  getDoc,
  getDocs,
  initializeFirestore,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
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
import { filterDiscovery, toPublicProfile } from './shared';
import type { AuthUser, Backend } from './types';

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
};
