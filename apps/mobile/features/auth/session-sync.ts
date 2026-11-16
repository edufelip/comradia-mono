import type { Backend } from '@/services/backend/types';

import { useSessionStore } from './session-store';

/**
 * Mirrors Firebase's auth state into the session store, loading the profile to decide
 * between onboarding and the tabs. Returns the unsubscribe function.
 */
export function syncSession(backend: Backend): () => void {
  let latest = 0;
  return backend.onAuthChanged(async (user) => {
    const call = ++latest;
    const store = useSessionStore.getState();
    if (!user) {
      store.setSignedOut();
      return;
    }
    try {
      const profile = await backend.getProfile(user.uid);
      // A newer auth event (sign-out, another account) wins over this slower read.
      if (call === latest) useSessionStore.getState().setSignedIn(user, profile);
    } catch {
      if (call === latest) useSessionStore.getState().setProfileError(user);
    }
  });
}
