import type {
  DiscoveryProfile,
  PublicProfile,
} from '@/features/profile/profile-schema';

export type AuthUser = {
  uid: string;
  phoneNumber: string | null;
  email: string | null;
  displayName: string | null;
};

export type SwipeDirection = 'like' | 'pass';

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
  recordSwipe(uid: string, targetId: string, direction: SwipeDirection): Promise<void>;
};
