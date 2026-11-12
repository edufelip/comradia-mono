import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  deleteUser,
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
  type DocumentReference,
} from 'firebase/firestore';
import { chunk, DELETE_BATCH_SIZE } from './batches';
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

type DocRef = DocumentReference;

/** Deletes every `ref` in batches that stay under Firestore's 500-write limit. */
async function deleteInBatches(refs: DocRef[]): Promise<void> {
  for (const group of chunk(refs, DELETE_BATCH_SIZE)) {
    const batch = writeBatch(db);
    for (const ref of group) batch.delete(ref);
    await batch.commit();
  }
}

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

  blockUser: (uid, targetId) =>
    run(async () => {
      if (uid === targetId) throw new BackendError('unknown');
      // Both docs in one batch: the rules see each side of the block appear together.
      const batch = writeBatch(db);
      batch.set(doc(db, 'users', uid, 'blocks', targetId), { createdAt: serverTimestamp() });
      batch.set(doc(db, 'blocks', targetId, 'by', uid), { createdAt: serverTimestamp() });
      await batch.commit();
    }),

  reportUser: (uid, { targetId, reason, details, context }) =>
    run(async () => {
      if (uid === targetId) throw new BackendError('unknown');
      const batch = writeBatch(db);
      // A report always blocks, so the report and the two block docs share one batch.
      batch.set(doc(collection(db, 'reports')), {
        reporter: uid,
        target: targetId,
        reason,
        details: details.trim(),
        context,
        createdAt: serverTimestamp(),
      });
      batch.set(doc(db, 'users', uid, 'blocks', targetId), { createdAt: serverTimestamp() });
      batch.set(doc(db, 'blocks', targetId, 'by', uid), { createdAt: serverTimestamp() });
      await batch.commit();
    }),

  listBlockedUids: (uid) =>
    run(async () => {
      // I wrote users/{uid}/blocks; other people wrote blocks/{uid}/by.
      const [mine, theirs] = await Promise.all([
        getDocs(collection(db, 'users', uid, 'blocks')),
        getDocs(collection(db, 'blocks', uid, 'by')),
      ]);
      return [...new Set([...mine.docs.map((d) => d.id), ...theirs.docs.map((d) => d.id)])];
    }),

  lastSignInAt() {
    // Sync by contract: the screen decides, before deleting, whether to re-authenticate.
    const time = auth.currentUser?.metadata.lastSignInTime;
    const ms = time ? Date.parse(time) : NaN;
    // Unknown counts as "not recent": the screen then asks for a fresh sign-in.
    return Number.isFinite(ms) ? ms : null;
  },

  deleteAccount: (uid) =>
    run(async () => {
      // Reads first: later steps are queries, and a batch cannot see its own writes.
      const [swipes, receivedLikes, myBlocks, matches] = await Promise.all([
        getDocs(collection(db, 'users', uid, 'swipes')),
        getDocs(collection(db, 'likes', uid, 'from')),
        getDocs(collection(db, 'users', uid, 'blocks')),
        getDocs(query(collection(db, 'matches'), where('users', 'array-contains', uid))),
      ]);

      // 1. My swipes, and the public like that each 'like' swipe wrote.
      await deleteInBatches([
        ...swipes.docs.map((d) => doc(db, 'users', uid, 'swipes', d.id)),
        ...swipes.docs
          .filter((d) => d.data().direction === 'like')
          .map((d) => doc(db, 'likes', d.id, 'from', uid)),
      ]);

      // 2. Likes I received: only I can still read them, so only I can clear them.
      await deleteInBatches(receivedLikes.docs.map((d) => doc(db, 'likes', uid, 'from', d.id)));

      // 3. Blocks I wrote: both mirror docs.
      await deleteInBatches(
        myBlocks.docs.flatMap((d) => [
          doc(db, 'blocks', d.id, 'by', uid),
          doc(db, 'users', uid, 'blocks', d.id),
        ]),
      );

      // 4. My messages in each match, then the match itself.
      for (const match of matches.docs) {
        const sent = await getDocs(
          query(collection(db, 'matches', match.id, 'messages'), where('from', '==', uid)),
        );
        await deleteInBatches(sent.docs.map((d) => doc(db, 'matches', match.id, 'messages', d.id)));
      }
      await deleteInBatches(matches.docs.map((d) => doc(db, 'matches', d.id)));

      // 5. My public card, then my private account.
      await deleteInBatches([doc(db, 'profiles', uid), doc(db, 'users', uid)]);

      // 6. The sign-in itself, last: without it no step above can be retried.
      const user = auth.currentUser;
      if (!user) throw new BackendError('unknown');
      await deleteUser(user);
    }),
};
