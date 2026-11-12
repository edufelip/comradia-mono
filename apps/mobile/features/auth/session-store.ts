import { create } from 'zustand';
import type { PublicProfile } from '@/features/profile/profile-schema';
import type { AuthUser } from '@/services/backend/types';

/**
 * loading         → waiting for Firebase to restore the session
 * signedOut       → Welcome, S1B, S1C
 * needsOnboarding → signed in without a profile: S2–S4
 * ready           → signed in with a profile: tabs
 * error           → signed in but the profile could not be read (retry)
 */
export type SessionStatus = 'loading' | 'signedOut' | 'needsOnboarding' | 'ready' | 'error';

type SessionState = {
  status: SessionStatus;
  user: AuthUser | null;
  profile: PublicProfile | null;
  setSignedOut: () => void;
  setSignedIn: (user: AuthUser, profile: PublicProfile | null) => void;
  setProfileError: (user: AuthUser) => void;
  completeOnboarding: (profile: PublicProfile) => void;
  /** Replaces my card after an edit (photo); ignored when signed out. */
  updateProfile: (profile: PublicProfile) => void;
};

export const INITIAL_SESSION = { status: 'loading', user: null, profile: null } as const;

export const useSessionStore = create<SessionState>((set) => ({
  ...INITIAL_SESSION,
  setSignedOut: () => set({ status: 'signedOut', user: null, profile: null }),
  setSignedIn: (user, profile) =>
    set({ status: profile ? 'ready' : 'needsOnboarding', user, profile }),
  setProfileError: (user) => set({ status: 'error', user, profile: null }),
  completeOnboarding: (profile) =>
    set((state) => (state.user ? { status: 'ready', profile } : state)),
  updateProfile: (profile) => set((state) => (state.user && state.profile ? { profile } : state)),
}));
