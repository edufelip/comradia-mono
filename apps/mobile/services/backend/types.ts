import type { DiscoveryProfile, PublicProfile } from '@/features/profile/profile-schema';

export type AuthUser = {
  uid: string;
  phoneNumber: string | null;
  email: string | null;
  displayName: string | null;
};

export type SwipeDirection = 'like' | 'pass';

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
  account: { birthDate: string; sharedPassionWeight: number };
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
  /** Writes the public profile and private account documents in one batch. */
  saveOnboarding(uid: string, docs: OnboardingDocuments): Promise<void>;
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
  sendMessage(uid: string, matchId: string, text: string): Promise<void>;
};
