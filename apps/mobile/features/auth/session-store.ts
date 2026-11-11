import { create } from 'zustand';

// shortcut: in-memory flag, so the welcome screen shows on every cold start; replace with the real Google / phone session when S1B (register) lands.
type SessionState = {
  signedIn: boolean;
  signIn: () => void;
  signOut: () => void;
};

export const useSessionStore = create<SessionState>((set) => ({
  signedIn: false,
  signIn: () => set({ signedIn: true }),
  signOut: () => set({ signedIn: false }),
}));
