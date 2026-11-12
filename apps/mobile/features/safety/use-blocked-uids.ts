import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import type { Backend } from '@/services/backend/types';

/** The one backend call the safety surfaces need to know who to hide. */
export type BlockedBackend = Pick<Backend, 'listBlockedUids'>;

/**
 * The uids I must hide: people I blocked plus people who blocked me. Reads once when the
 * screen mounts and again every time it regains focus, so a block made in the safety modal
 * shows up in Matches and Chat without a reload.
 */
export function useBlockedUids(backend: BlockedBackend, uid: string | undefined) {
  const [blockedUids, setBlockedUids] = useState<string[]>([]);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (!uid || inFlight.current) return;
    inFlight.current = true;
    try {
      setBlockedUids(await backend.listBlockedUids(uid));
    } catch {
      // Keep the list we already have: a failed read must not un-hide anyone.
    } finally {
      inFlight.current = false;
    }
  }, [backend, uid]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return { blockedUids, refresh };
}
