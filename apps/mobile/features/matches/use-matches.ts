import { useCallback, useEffect, useState } from 'react';

import type { Backend, Match, Unsubscribe } from '@/services/backend/types';
import { markReconciliationForSession } from './reconcile-session';

/** The backend calls S9 needs. Passed in, so this module never imports Firebase. */
export type MatchesBackend = Pick<Backend, 'reconcileMatches' | 'onMatches'>;

export type MatchesStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * S9's live list. Opening Matches first repairs any match both people created at the same
 * moment without seeing each other's like once per app session, then follows the matches
 * collection until the screen unmounts. Repair failures do not stop the live list.
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

    if (markReconciliationForSession(uid)) {
      void backend.reconcileMatches(uid).catch(() => undefined);
    }
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

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [backend, uid, attempt]);

  return { status, matches, retry };
}
