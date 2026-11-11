import { useCallback, useEffect, useState } from 'react';

import type { Backend, Match, Unsubscribe } from '@/services/backend/types';

/** The backend calls S9 needs. Passed in, so this module never imports Firebase. */
export type MatchesBackend = Pick<Backend, 'reconcileMatches' | 'onMatches'>;

export type MatchesStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * S9's live list. Opening Matches first repairs any match both people created at the same
 * moment without seeing each other's like (decision #8), then follows the matches
 * collection until the screen unmounts.
 */
export function useMatches(backend: MatchesBackend, uid: string | undefined) {
  const [status, setStatus] = useState<MatchesStatus>('idle');
  const [matches, setMatches] = useState<Match[]>([]);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    if (!uid) return;
    let active = true;
    let unsubscribe: Unsubscribe | undefined;
    setStatus('loading');

    backend
      .reconcileMatches(uid)
      .then(() => {
        if (!active) return;
        unsubscribe = backend.onMatches(
          uid,
          (list) => {
            if (!active) return;
            setMatches(list);
            setStatus('ready');
          },
          () => {
            if (!active) return;
            setStatus('error');
          },
        );
      })
      .catch(() => {
        if (active) setStatus('error');
      });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [backend, uid, attempt]);

  return { status, matches, retry };
}
