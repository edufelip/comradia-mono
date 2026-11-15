import type { ProfileEdits } from '@/features/profile/profile-edits';
import type { DiscoveryProfile, PublicProfile } from '@/features/profile/profile-schema';

export type AuthUser = {
  uid: string;
  phoneNumber: string | null;
  email: string | null;
  displayName: string | null;
};

export type SwipeDirection = 'like' | 'pass';

/** Why someone reports a card or a chat. Mirrored in `firestore.rules`. */
export type ReportReason = 'harassment' | 'hate' | 'fake' | 'spam' | 'underage' | 'other';

/** The picker order in the report sheet. */
export const REPORT_REASONS: readonly ReportReason[] = [
  'harassment',
  'hate',
  'fake',
  'spam',
  'underage',
  'other',
];

export type ReportContext = 'profile' | 'chat';

/** Someone I blocked. `displayName` and `photoPath` are null when their profile is gone. */
export type BlockedPerson = {
  id: string;
  displayName: string | null;
  photoPath: string | null;
};

export type ReportInput = {
  targetId: string;
  reason: ReportReason;
  details: string;
  context: ReportContext;
};

/** A mutual like. `id` is the two uids sorted and joined by `_` (see `matchIdFor`). */
export type Match = {
  id: string;
  /** The other person's public card. */
  other: DiscoveryProfile;
  /** Epoch milliseconds. */
  createdAt: number;
};

export type ChatMessage = {
  id: string;
  from: string;
  text: string;
  /** Epoch milliseconds; null while the server timestamp is pending (own unsent message). */
  createdAt: number | null;
};

export type LikeResult = { matched: false } | { matched: true; matchId: string };

export type Unsubscribe = () => void;

export type OnboardingDocuments = {
  profile: PublicProfile;
  account: { birthDate: string; sharedPassionWeight: number; consentVersion: string };
};

/**
 * Everything the app asks of Firebase. `index.ts` (iOS / Android, @react-native-firebase)
 * and `index.web.ts` (firebase JS SDK) implement it; component tests mock this module.
 */
export type Backend = {
  onAuthChanged(listener: (user: AuthUser | null) => void): () => void;
  isAppleSignInAvailable(): Promise<boolean>;
  signInWithApple(): Promise<void>;
  signInWithGoogle(): Promise<void>;
  /** Sends the SMS code; keeps the pending verification until `confirmPhoneCode`. */
  startPhoneSignIn(e164Phone: string): Promise<void>;
  confirmPhoneCode(code: string): Promise<void>;
  signOut(): Promise<void>;
  getProfile(uid: string): Promise<PublicProfile | null>;
  /** Updates only editable public fields; preserves immutable and private account data. */
  updateProfile(uid: string, edits: ProfileEdits): Promise<void>;
  /**
   * Uploads `photoUri` (when given) to `photos/{uid}/{newPhotoId()}.jpg`, sets
   * `docs.profile.photoPath` to it, then writes the public profile and private account
   * documents in one batch. Returns the profile as written.
   */
  saveOnboarding(
    uid: string,
    docs: OnboardingDocuments,
    photoUri: string | null,
  ): Promise<PublicProfile>;
  /**
   * Replaces (`localUri`) or removes (null) my portrait: uploads the new file, points
   * `profiles/{uid}.photoPath` at it, then deletes the previous file (best effort).
   * Returns the new `photoPath`.
   */
  setProfilePhoto(uid: string, localUri: string | null): Promise<string | null>;
  /** Download URL for a `photoPath`; cached for the session. */
  photoUrl(path: string): Promise<string>;
  listDiscovery(uid: string): Promise<DiscoveryProfile[]>;
  /** Records a pass. Likes go through `like`. */
  recordSwipe(uid: string, targetId: string, direction: SwipeDirection): Promise<void>;
  /**
   * Saves the like (swipe + `likes/{targetId}/from/{uid}`). If `targetId` already liked
   * `uid`, also creates `matches/{matchId}` in the same batch and returns it.
   */
  like(uid: string, targetId: string): Promise<LikeResult>;
  /**
   * Creates any match that is missing although both people liked each other (two likes
   * written at the same moment both see "no like back"). Safe to call repeatedly.
   */
  reconcileMatches(uid: string): Promise<void>;
  /** Live list of my matches, newest first. Errors go to `onError`. */
  onMatches(uid: string, listener: (matches: Match[]) => void, onError: () => void): Unsubscribe;
  getMatch(uid: string, matchId: string): Promise<Match | null>;
  /** Live messages of one match, oldest first. Errors go to `onError`. */
  onMessages(
    matchId: string,
    listener: (messages: ChatMessage[]) => void,
    onError: () => void,
  ): Unsubscribe;
  /** Loads messages strictly before an epoch-ms cursor, oldest first. */
  loadOlderMessages(matchId: string, beforeMs: number, limit?: number): Promise<ChatMessage[]>;
  sendMessage(uid: string, matchId: string, text: string): Promise<void>;
  /** Blocks `targetId`: writes users/{uid}/blocks/{targetId} and blocks/{targetId}/by/{uid} in one batch. */
  blockUser(uid: string, targetId: string): Promise<void>;
  /** Creates reports/{reporterUid_targetUid} once and ensures both block docs exist. */
  reportUser(uid: string, input: ReportInput): Promise<void>;
  /** Uids to hide from me: people I blocked plus people who blocked me (no duplicates). */
  listBlockedUids(uid: string): Promise<string[]>;
  /** Deletes users/{uid}/blocks/{targetId} and blocks/{targetId}/by/{uid} in one batch. Reports stay. */
  unblockUser(uid: string, targetId: string): Promise<void>;
  /** People I blocked (not people who blocked me). */
  listBlocked(uid: string): Promise<BlockedPerson[]>;
  /** Epoch ms of the signed-in user's last sign-in (Auth metadata), or null when signed out. */
  lastSignInAt(): number | null;
  /**
   * Deletes everything I own, then my sign-in. Order: my swipes (and for each 'like' swipe
   * the doc likes/{target}/from/{uid}); likes I received (likes/{uid}/from/*); my blocks
   * (blocks/{t}/by/{uid} and users/{uid}/blocks/{t}); in every match where users
   * array-contains uid: my messages (from == uid) then the match doc; then every file under
   * photos/{uid}/; then profiles/{uid} and users/{uid}; finally the Firebase Auth user. Batches of at most 450 writes.
   */
  deleteAccount(uid: string): Promise<void>;
};
