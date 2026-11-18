import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { getApp } from '@react-native-firebase/app';
import { initializeAppCheck } from '@react-native-firebase/app-check';
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
  documentId,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  limitToLast,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  endBefore,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';
import {
  connectStorageEmulator,
  deleteObject,
  getDownloadURL,
  getStorage,
  listAll,
  putFile,
  ref,
} from '@react-native-firebase/storage';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import {
  resumeNotificationsAfterAccountDeletionFailure,
  revokeNotificationsBeforeAccountDeletion,
  revokeNotificationsBeforeSignOut,
} from '@/features/notifications/notifications';
import { buildProfileEdits } from '@/features/profile/profile-edits';
import { newPhotoId, PHOTO_METADATA, photoPathFor } from '@/features/profile/profile-schema';
import { appCheckProviderOptions } from './app-check';
import { chunk, DELETE_BATCH_SIZE } from './batches';
import {
  AUTH_EMULATOR_PORT,
  DISCOVERY_PAGE_SIZE,
  emulatorHost,
  FIRESTORE_EMULATOR_PORT,
  STORAGE_EMULATOR_PORT,
} from './config';
import { BackendError, toBackendError } from './errors';
import { phoneFailureSummary } from './phone-diagnostics';
import {
  cachedProfile,
  chatMatch,
  collectDiscoveryCandidates,
  invalidateDisappearedProfiles,
  isPermissionDenied,
  mapWithConcurrency,
  matchIdFor,
  matchRow,
  MESSAGE_MAX,
  MESSAGE_PAGE_SIZE,
  otherUid,
  processQueryPages,
  reconcileLikePairs,
  reportIdFor,
  toPublicProfile,
} from './shared';
import type { AuthUser, Backend, ChatMessage, LikeResult, Match } from './types';

const host = emulatorHost();

// Before the first Firebase call below. Emulators don't check App Check, so skip them.
if (!host) {
  const app = getApp();
  const provider = app.appCheck().newReactNativeFirebaseAppCheckProvider();
  const extra = Constants.expoConfig?.extra;
  const debugToken =
    typeof extra?.appCheckDebugToken === 'string' ? extra.appCheckDebugToken : undefined;
  provider.configure(appCheckProviderOptions(debugToken, extra?.appVariant));
  initializeAppCheck(app, { provider, isTokenAutoRefreshEnabled: true }).catch((error: unknown) => {
    console.warn('[Comradia] App Check did not start; requests go out without a token.', error);
  });
}

const auth = getAuth();
const db = getFirestore();
const storage = getStorage();

if (host) {
  connectAuthEmulator(auth, `http://${host}:${AUTH_EMULATOR_PORT}`);
  connectFirestoreEmulator(db, host, FIRESTORE_EMULATOR_PORT);
  connectStorageEmulator(storage, host, STORAGE_EMULATOR_PORT);
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

/** Download URLs per path. Photo files are never overwritten, so an entry never goes stale. */
const photoUrls = new Map<string, Promise<string>>();
const profiles = new Map<string, Promise<Record<string, unknown> | null>>();
const matchProfileIds = new Map<string, Set<string>>();

async function readProfileData(uid: string): Promise<Record<string, unknown> | null> {
  const snapshot = await getDoc(doc(db, 'profiles', uid));
  return snapshot.data() ?? null;
}

function cachedProfileRead(uid: string): Promise<Record<string, unknown> | null> {
  return cachedProfile(profiles, uid, () => readProfileData(uid));
}

function trackMatchProfiles(uid: string, docs: Snapshot[]): void {
  const current = new Set(docs.map((match) => otherUid(match.id, uid)));
  invalidateDisappearedProfiles(profiles, matchProfileIds.get(uid) ?? new Set(), current);
  matchProfileIds.set(uid, current);
}

/** Uploads a picked JPEG under a fresh id and returns its storage path. */
async function uploadPhoto(uid: string, localUri: string): Promise<string> {
  const path = photoPathFor(uid, newPhotoId());
  await putFile(ref(storage, path), localUri, PHOTO_METADATA);
  return path;
}

/** Best effort: an orphan file costs storage, but must not fail the caller. */
async function deletePhotoQuietly(path: string): Promise<void> {
  await deleteObject(ref(storage, path)).catch(() => undefined);
}

type DocRef = FirebaseFirestoreTypes.DocumentReference;

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

/** My matches, newest first. A match whose other card is unreadable (they blocked me) or
 *  gone is skipped; the denial is never cached, so a later snapshot retries the card. */
async function loadMatches(uid: string, docs: Snapshot[]): Promise<Match[]> {
  const rows = await Promise.all(
    docs.map((match) =>
      matchRow(uid, match.id, epochMs(match.data().createdAt), () =>
        cachedProfileRead(otherUid(match.id, uid)),
      ),
    ),
  );
  // Sorted on the device so the query needs no composite index (users + createdAt).
  return rows.filter((row): row is Match => row !== null).sort((a, b) => b.createdAt - a.createdAt);
}

/** Discovery cursor: `seconds:nanoseconds:profileId` of the last profile read. */
function discoveryCursorOf(snapshot: { id: string; data(): { createdAt?: unknown } }): string {
  const at = snapshot.data().createdAt as Timestamp;
  return `${at.seconds}:${at.nanoseconds}:${snapshot.id}`;
}

function discoveryCursorValues(cursor: string): [Timestamp, string] | undefined {
  const match = /^(\d+):(\d+):(.+)$/.exec(cursor);
  return match ? [new Timestamp(Number(match[1]), Number(match[2])), match[3]] : undefined;
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
      try {
        pendingConfirmation = await signInWithPhoneNumber(auth, e164Phone);
      } catch (error) {
        if (__DEV__)
          console.info(
            '[Comradia phone auth]',
            JSON.stringify({ operation: 'request', ...phoneFailureSummary(error) }),
          );
        throw error;
      }
    }),

  confirmPhoneCode: (code) =>
    run(async () => {
      if (!pendingConfirmation) throw new BackendError('no_pending_code');
      try {
        await pendingConfirmation.confirm(code);
      } catch (error) {
        if (__DEV__)
          console.info(
            '[Comradia phone auth]',
            JSON.stringify({ operation: 'confirm', ...phoneFailureSummary(error) }),
          );
        throw error;
      }
      pendingConfirmation = null;
    }),

  signOut: () =>
    run(async () => {
      const uid = auth.currentUser?.uid;
      if (uid) await revokeNotificationsBeforeSignOut(uid);
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

  saveOnboarding: (uid, docs, photoUri) =>
    run(async () => {
      const photoPath = photoUri ? await uploadPhoto(uid, photoUri) : null;
      const profile = { ...docs.profile, photoPath };
      const batch = writeBatch(db);
      batch.set(doc(db, 'profiles', uid), {
        ...profile,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.set(doc(db, 'users', uid), {
        ...docs.account,
        sensitiveDataConsentAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      try {
        await batch.commit();
      } catch (error) {
        if (photoPath) await deletePhotoQuietly(photoPath);
        throw error;
      }
      return profile;
    }),

  updateProfile: (uid, edits) =>
    run(async () => {
      await updateDoc(doc(db, 'profiles', uid), {
        ...buildProfileEdits(edits),
        updatedAt: serverTimestamp(),
      });
    }),

  setProfilePhoto: (uid, localUri) =>
    run(async () => {
      const current = await getDoc(doc(db, 'profiles', uid));
      const data = current.data();
      const previous = data ? toPublicProfile(data).photoPath : null;
      const next = localUri ? await uploadPhoto(uid, localUri) : null;
      try {
        await updateDoc(doc(db, 'profiles', uid), {
          photoPath: next,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        if (next) await deletePhotoQuietly(next);
        throw error;
      }
      if (previous && previous !== next) await deletePhotoQuietly(previous);
      return next;
    }),

  photoUrl: (path) => {
    let url = photoUrls.get(path);
    if (!url) {
      url = getDownloadURL(ref(storage, path)).catch((error: unknown) => {
        photoUrls.delete(path);
        throw toBackendError(error);
      });
      photoUrls.set(path, url);
    }
    return url;
  },

  listDiscovery: (uid) =>
    run(async () => {
      // shortcut: ranking and distance stay client-side until a Cloud Function is justified.
      const key = `comradia.discoveryCursor.${uid}`;
      const saved = await AsyncStorage.getItem(key).catch(() => null);
      const { candidates, resume } = await collectDiscoveryCandidates(
        uid,
        DISCOVERY_PAGE_SIZE,
        5,
        async (cursor) => {
          const page = await getDocs(
            cursor !== undefined
              ? query(
                  collection(db, 'profiles'),
                  orderBy('createdAt'),
                  // The id breaks createdAt ties, so a page ending inside a tie skips no one.
                  orderBy(documentId()),
                  startAfter(...discoveryCursorValues(cursor as string)!),
                  limit(DISCOVERY_PAGE_SIZE),
                )
              : query(
                  collection(db, 'profiles'),
                  orderBy('createdAt'),
                  orderBy(documentId()),
                  limit(DISCOVERY_PAGE_SIZE),
                ),
          );
          return {
            docs: page.docs.map((d: Snapshot) => ({ id: d.id, data: d.data() })),
            cursor: page.docs.length
              ? discoveryCursorOf(page.docs[page.docs.length - 1])
              : undefined,
          };
        },
        async (ids) => {
          const swipePages = await Promise.all(
            chunk(ids, 30).map((group) =>
              getDocs(
                query(collection(db, 'users', uid, 'swipes'), where(documentId(), 'in', group)),
              ),
            ),
          );
          return new Set<string>(
            swipePages.flatMap((page: { docs: Snapshot[] }) => page.docs.map((swipe) => swipe.id)),
          );
        },
        saved && discoveryCursorValues(saved) ? saved : undefined,
      );
      if (typeof resume === 'string')
        await AsyncStorage.setItem(key, resume).catch(() => undefined);
      return candidates;
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
      const [likes, swipes, blockedUids] = await Promise.all([
        getDocs(collection(db, 'likes', uid, 'from')),
        getDocs(query(collection(db, 'users', uid, 'swipes'), where('direction', '==', 'like'))),
        backend.listBlockedUids(uid),
      ]);
      const likedMe = new Set<string>(likes.docs.map((d: Snapshot) => d.id));
      await reconcileLikePairs(
        swipes.docs.map((swipe: Snapshot) => swipe.id),
        likedMe,
        new Set<string>(blockedUids),
        async (targetUid) => {
          const matchId = matchIdFor(uid, targetUid);
          const existing = await getDoc(doc(db, 'matches', matchId));
          if (existing.data()) return;
          await setDoc(doc(db, 'matches', matchId), {
            users: [uid, targetUid].sort(),
            createdAt: serverTimestamp(),
          });
        },
      );
    }),

  onMatches: (uid, listener, onError) => {
    // Each snapshot loads profiles; only the latest snapshot's result may reach the screen.
    let latest = 0;
    return onSnapshot(
      query(collection(db, 'matches'), where('users', 'array-contains', uid)),
      (snapshot: { docs: Snapshot[] }) => {
        trackMatchProfiles(uid, snapshot.docs);
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
      // Recheck profile access for a direct match read, including when a chat regains focus.
      return chatMatch(uid, matchId, epochMs(match.createdAt), () =>
        readProfileData(otherUid(matchId, uid)),
      );
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

  loadOlderMessages: (matchId, beforeId, limitCount) =>
    run<ChatMessage[]>(async () => {
      // A snapshot cursor carries createdAt and the id, so messages tied with the anchor still load.
      const anchor = await getDoc(doc(db, 'matches', matchId, 'messages', beforeId));
      const page = await getDocs(
        query(
          collection(db, 'matches', matchId, 'messages'),
          orderBy('createdAt', 'asc'),
          endBefore(anchor),
          limitToLast(limitCount ?? MESSAGE_PAGE_SIZE),
        ),
      );
      return page.docs.map((message: Snapshot) => {
        const data = message.data();
        return {
          id: message.id,
          from: String(data.from),
          text: String(data.text),
          createdAt: data.createdAt ? epochMs(data.createdAt) : null,
        };
      });
    }),

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
      // Read both sides so retries only create the block docs that are still missing.
      const own = doc(db, 'users', uid, 'blocks', targetId);
      const mirror = doc(db, 'blocks', targetId, 'by', uid);
      const [ownDoc, mirrorDoc] = await Promise.all([getDoc(own), getDoc(mirror)]);
      const ownWrite = !ownDoc.exists();
      const mirrorWrite = !mirrorDoc.exists();
      if (!ownWrite && !mirrorWrite) return;
      const batch = writeBatch(db);
      if (ownWrite) batch.set(own, { createdAt: serverTimestamp() });
      if (mirrorWrite) batch.set(mirror, { createdAt: serverTimestamp() });
      await batch.commit();
    }),

  reportUser: (uid, { targetId, reason, details, context }) =>
    run(async () => {
      if (uid === targetId) throw new BackendError('unknown');
      const reportRef = doc(db, 'reports', reportIdFor(uid, targetId));
      const ownBlockRef = doc(db, 'users', uid, 'blocks', targetId);
      const mirrorBlockRef = doc(db, 'blocks', targetId, 'by', uid);
      const [reportDoc, ownBlock, mirrorBlock] = await Promise.all([
        getDoc(reportRef),
        getDoc(ownBlockRef),
        getDoc(mirrorBlockRef),
      ]);
      const batch = writeBatch(db);
      const reportWrite = !reportDoc.exists();
      const ownWrite = !ownBlock.exists();
      const mirrorWrite = !mirrorBlock.exists();
      if (reportWrite)
        batch.set(reportRef, {
          reporter: uid,
          target: targetId,
          reason,
          details: details.trim(),
          context,
          createdAt: serverTimestamp(),
        });
      if (ownWrite) batch.set(ownBlockRef, { createdAt: serverTimestamp() });
      if (mirrorWrite) batch.set(mirrorBlockRef, { createdAt: serverTimestamp() });
      if (reportWrite || ownWrite || mirrorWrite) await batch.commit();
    }),

  listBlockedUids: (uid) =>
    run(async () => {
      // I wrote users/{uid}/blocks; other people wrote blocks/{uid}/by.
      const [mine, theirs] = await Promise.all([
        getDocs(collection(db, 'users', uid, 'blocks')),
        getDocs(collection(db, 'blocks', uid, 'by')),
      ]);
      return [
        ...new Set([
          ...mine.docs.map((d: Snapshot) => d.id),
          ...theirs.docs.map((d: Snapshot) => d.id),
        ]),
      ];
    }),

  unblockUser: (uid, targetId) =>
    run(async () => {
      // The mirror of blockUser: the rules let the blocker delete both docs. Reports stay.
      const batch = writeBatch(db);
      batch.delete(doc(db, 'users', uid, 'blocks', targetId));
      batch.delete(doc(db, 'blocks', targetId, 'by', uid));
      await batch.commit();
    }),

  listBlocked: (uid) =>
    run(async () => {
      const mine = await getDocs(collection(db, 'users', uid, 'blocks'));
      // A missing profile means the person deleted their account: the screen shows a
      // fallback. A denied one means they blocked me too: same fallback, same privacy.
      return Promise.all(
        mine.docs.map(async (d: Snapshot) => {
          const profile = await cachedProfileRead(d.id).catch((error: unknown) => {
            if (!isPermissionDenied(error)) throw error;
            return null;
          });
          return {
            id: d.id,
            displayName: profile ? String(profile.displayName) : null,
            photoPath: profile?.photoPath ? String(profile.photoPath) : null,
          };
        }),
      );
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
      await revokeNotificationsBeforeAccountDeletion(uid);
      try {
        // Reads first: later steps are queries, and a batch cannot see its own writes.
        const [swipes, receivedLikes, myBlocks, matches] = await Promise.all([
          getDocs(collection(db, 'users', uid, 'swipes')),
          getDocs(collection(db, 'likes', uid, 'from')),
          getDocs(collection(db, 'users', uid, 'blocks')),
          getDocs(query(collection(db, 'matches'), where('users', 'array-contains', uid))),
        ]);

        // 1. My swipes, and the public like that each 'like' swipe wrote.
        await deleteInBatches([
          ...swipes.docs.map((d: Snapshot) => doc(db, 'users', uid, 'swipes', d.id)),
          ...swipes.docs
            .filter((d: Snapshot) => d.data().direction === 'like')
            .map((d: Snapshot) => doc(db, 'likes', d.id, 'from', uid)),
        ]);

        // 2. Likes I received: only I can still read them, so only I can clear them.
        await deleteInBatches(
          receivedLikes.docs.map((d: Snapshot) => doc(db, 'likes', uid, 'from', d.id)),
        );

        // 3. Blocks I wrote: both mirror docs.
        await deleteInBatches(
          myBlocks.docs.flatMap((d: Snapshot) => [
            doc(db, 'blocks', d.id, 'by', uid),
            doc(db, 'users', uid, 'blocks', d.id),
          ]),
        );

        // 4. My messages in each match, then the match itself.
        for (const match of matches.docs) {
          await processQueryPages<FirebaseFirestoreTypes.QueryDocumentSnapshot>(
            300,
            async (cursor) => {
              const sent = await getDocs(
                cursor
                  ? query(
                      collection(db, 'matches', match.id, 'messages'),
                      where('from', '==', uid),
                      startAfter(cursor as FirebaseFirestoreTypes.QueryDocumentSnapshot),
                      limit(300),
                    )
                  : query(
                      collection(db, 'matches', match.id, 'messages'),
                      where('from', '==', uid),
                      limit(300),
                    ),
              );
              return { items: sent.docs, cursor: sent.docs.at(-1) };
            },
            async (sent) => {
              await deleteInBatches(
                sent.map((d) => doc(db, 'matches', match.id, 'messages', d.id)),
              );
            },
          );
        }
        await deleteInBatches(matches.docs.map((d: Snapshot) => doc(db, 'matches', d.id)));

        // 5. My portraits. Every file is tried; a real failure stops here, before the profile
        // that points at them is gone, so the deletion can be retried.
        const photos = await listAll(ref(storage, `photos/${uid}`));
        const failures: unknown[] = [];
        await mapWithConcurrency(photos.items, 5, async (item) => {
          try {
            await deleteObject(item);
          } catch (error) {
            if ((error as { code?: string }).code !== 'storage/object-not-found')
              failures.push(error);
          }
        });
        if (failures.length > 0) throw failures[0];

        // 6. My public card, then my private account.
        await deleteInBatches([doc(db, 'profiles', uid), doc(db, 'users', uid)]);

        // 7. The sign-in itself, last: without it no step above can be retried.
        const user = auth.currentUser;
        if (!user) throw new BackendError('unknown');
        await user.delete();
      } catch (error) {
        // If any later cleanup failed, the account still exists; release the session fence.
        await resumeNotificationsAfterAccountDeletionFailure(uid).catch(() => undefined);
        throw error;
      }
    }),
};
