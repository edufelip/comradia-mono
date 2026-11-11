import { create } from 'zustand';
import type { DiscoveryProfile } from '@/features/profile/profile-schema';
import type { Backend } from '@/services/backend/types';

/**
 * The two backend calls Discover needs. Screens pass the real backend in, which keeps this
 * module free of Firebase at runtime (the `tsx` unit runner cannot load React Native code
 * and the backend module pulls in `react-native`).
 */
export type DiscoveryBackend = Pick<Backend, 'listDiscovery' | 'recordSwipe'>;

export type DiscoveryStatus = 'idle' | 'loading' | 'ready' | 'error';

type DiscoveryState = {
  status: DiscoveryStatus;
  /** The deck, top card first. */
  candidates: DiscoveryProfile[];
  /** People liked in this session. Matches are not computed server-side (decision #8). */
  liked: DiscoveryProfile[];
  /** Replaces the deck with the people the backend says are still available. */
  load: (backend: DiscoveryBackend, uid: string) => Promise<void>;
  like: (backend: DiscoveryBackend, uid: string, id: string) => Promise<void>;
  pass: (backend: DiscoveryBackend, uid: string, id: string) => Promise<void>;
};

export const INITIAL_DISCOVERY: Pick<DiscoveryState, 'status' | 'candidates' | 'liked'> = {
  status: 'idle',
  candidates: [],
  liked: [],
};

/** Only the newest load may write; a slower, older one must not resurrect stale cards. */
let latestLoad = 0;

export const useDiscoveryStore = create<DiscoveryState>((set, get) => ({
  ...INITIAL_DISCOVERY,

  load: async (backend, uid) => {
    const ticket = ++latestLoad;
    set({ status: 'loading' });
    try {
      const candidates = await backend.listDiscovery(uid);
      if (ticket !== latestLoad) return;
      set({ status: 'ready', candidates });
    } catch {
      if (ticket !== latestLoad) return;
      set({ status: 'error' });
    }
  },

  like: async (backend, uid, id) => {
    const { candidates, liked } = get();
    const target = candidates.find((candidate) => candidate.id === id);
    if (!target) return;

    // Optimistic: the card leaves the deck at once and shows up on Matches.
    set({
      candidates: candidates.filter((candidate) => candidate.id !== id),
      liked: liked.some((person) => person.id === id) ? liked : [target, ...liked],
    });

    try {
      await backend.recordSwipe(uid, id, 'like');
    } catch {
      // Put the card back on top, and take it off Matches again.
      set((state) => ({
        candidates: state.candidates.some((candidate) => candidate.id === id)
          ? state.candidates
          : [target, ...state.candidates],
        liked: state.liked.filter((person) => person.id !== id),
      }));
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
