import { useCallback, useEffect, useState } from 'react';

import type { Backend, ChatMessage, Match, Unsubscribe } from '@/services/backend/types';

/** The backend calls S10 needs. Passed in, so this module never imports Firebase. */
export type ChatBackend = Pick<Backend, 'getMatch' | 'onMessages'>;

export type ChatStatus = 'idle' | 'loading' | 'ready' | 'not_found' | 'error';

/**
 * S10: reads the match once (name and shared values for the header) and then follows its
 * messages, oldest first, until the screen unmounts.
 */
export function useChat(backend: ChatBackend, uid: string | undefined, matchId: string) {
  const [status, setStatus] = useState<ChatStatus>('idle');
  const [match, setMatch] = useState<Match | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    if (!uid) return;
    let active = true;
    let unsubscribe: Unsubscribe | undefined;
    setStatus('loading');

    backend
      .getMatch(uid, matchId)
      .then((found) => {
        if (!active) return;
        if (!found) {
          setStatus('not_found');
          return;
        }
        setMatch(found);
        unsubscribe = backend.onMessages(
          matchId,
          (list) => {
            if (!active) return;
            setMessages(list);
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
  }, [backend, uid, matchId, attempt]);

  return { status, match, messages, retry };
}
