import { create } from 'zustand';
import type { DiscoveryProfile } from '@/features/profile/profile-schema';
import type { Backend, LikeResult } from '@/services/backend/types';

/**
 * The backend calls Discover needs. Screens pass the real backend in, which keeps this
 * module free of Firebase at runtime (the `tsx` unit runner cannot load React Native code
 * and the backend module pulls in `react-native`).
 */
export type DiscoveryBackend = Pick<
  Backend,
  'listDiscovery' | 'recordSwipe' | 'like' | 'listBlockedUids'
>;

export type DiscoveryStatus = 'idle' | 'loading' | 'ready' | 'error';

type DiscoveryState = {
  status: DiscoveryStatus;
  /** The deck, top card first. */
  candidates: DiscoveryProfile[];
  /**
   * Replaces the deck with the people the backend says are still available, minus everyone
   * in `listBlockedUids` (people I blocked and people who blocked me).
   */
  load: (backend: DiscoveryBackend, uid: string) => Promise<void>;
  /** Drops one person from the deck, e.g. right after I blocked or reported them. */
  removeCandidate: (id: string) => void;
  /**
   * Saves the like and removes the card at once. Resolves with the backend's answer (a
   * match when the other person liked first), or null when the card is unknown or the
   * write failed and the card came back.
   */
  like: (backend: DiscoveryBackend, uid: string, id: string) => Promise<LikeResult | null>;
  pass: (backend: DiscoveryBackend, uid: string, id: string) => Promise<void>;
};

export const INITIAL_DISCOVERY: Pick<DiscoveryState, 'status' | 'candidates'> = {
  status: 'idle',
  candidates: [],
};

/** Only the newest load may write; a slower, older one must not resurrect stale cards. */
let latestLoad = 0;

export const useDiscoveryStore = create<DiscoveryState>((set, get) => ({
  ...INITIAL_DISCOVERY,

  load: async (backend, uid) => {
    const ticket = ++latestLoad;
    set({ status: 'loading' });
    try {
      // Both reads decide the deck, so a failure in either fails closed: showing someone
      // I blocked is worse than asking me to retry.
      const [people, blocked] = await Promise.all([
        backend.listDiscovery(uid),
        backend.listBlockedUids(uid),
      ]);
      if (ticket !== latestLoad) return;
      const hidden = new Set(blocked);
      set({ status: 'ready', candidates: people.filter((person) => !hidden.has(person.id)) });
    } catch {
      if (ticket !== latestLoad) return;
      set({ status: 'error' });
    }
  },

  removeCandidate: (id) => {
    set((state) => ({ candidates: state.candidates.filter((person) => person.id !== id) }));
  },

  like: async (backend, uid, id) => {
    const { candidates } = get();
    const target = candidates.find((candidate) => candidate.id === id);
    if (!target) return null;

    // Optimistic: the card leaves the deck at once (matches are created by the backend).
    set({ candidates: candidates.filter((candidate) => candidate.id !== id) });

    try {
      return await backend.like(uid, id);
    } catch {
      // Put the card back on top, ahead of anything swiped since.
      set((state) => ({
        candidates: state.candidates.some((candidate) => candidate.id === id)
          ? state.candidates
          : [target, ...state.candidates],
      }));
      return null;
    }
  },

  pass: async (backend, uid, id) => {
    const { candidates } = get();
    const target = candidates.find((candidate) => candidate.id === id);
    if (!target) return;

    set({ candidates: candidates.filter((candidate) => candidate.id !== id) });

    try {
      await backend.recordSwipe(uid, id, 'pass');
    } catch {
      set((state) => ({
        candidates: state.candidates.some((candidate) => candidate.id === id)
          ? state.candidates
          : [target, ...state.candidates],
      }));
    }
  },
}));
