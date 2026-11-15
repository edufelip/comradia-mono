import { useCallback, useEffect, useState } from 'react';

import { MESSAGE_PAGE_SIZE } from '@/services/backend/shared';
import type { Backend, ChatMessage, Match, Unsubscribe } from '@/services/backend/types';

/** The backend calls S10 needs. Passed in, so this module never imports Firebase. */
export type ChatBackend = Pick<Backend, 'getMatch' | 'onMessages' | 'loadOlderMessages'>;

export type ChatStatus = 'idle' | 'loading' | 'ready' | 'not_found' | 'error';

/**
 * S10: reads the match once (name and shared values for the header) and then follows its
 * messages, oldest first, until the screen unmounts.
 */
export function useChat(backend: ChatBackend, uid: string | undefined, matchId: string) {
  const [status, setStatus] = useState<ChatStatus>('idle');
  const [match, setMatch] = useState<Match | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [olderMessages, setOlderMessages] = useState<ChatMessage[]>([]);
  const [olderPageWasFull, setOlderPageWasFull] = useState(false);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [earlierFailed, setEarlierFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    if (!uid) return;
    let active = true;
    let unsubscribe: Unsubscribe | undefined;
    setStatus('loading');
    setMessages([]);
    setOlderMessages([]);
    setOlderPageWasFull(false);
    setLoadingEarlier(false);
    setEarlierFailed(false);

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

  const combinedMessages = [...olderMessages, ...messages].filter(
    (message, index, all) => all.findIndex((candidate) => candidate.id === message.id) === index,
  );
  const canLoadEarlier = messages.length >= MESSAGE_PAGE_SIZE || olderPageWasFull;

  const loadEarlier = useCallback(async () => {
    if (loadingEarlier) return;
    const earliest = combinedMessages.find((message) => message.createdAt !== null);
    if (!earliest?.createdAt) return;
    setLoadingEarlier(true);
    setEarlierFailed(false);
    try {
      const page = await backend.loadOlderMessages(matchId, earliest.createdAt);
      setOlderMessages((current) => {
        const existing = new Set(current.map((message) => message.id));
        return [...page.filter((message) => !existing.has(message.id)), ...current];
      });
      setOlderPageWasFull(page.length >= MESSAGE_PAGE_SIZE);
    } catch {
      setEarlierFailed(true);
    } finally {
      setLoadingEarlier(false);
    }
  }, [backend, combinedMessages, loadingEarlier, matchId]);

  return {
    status,
    match,
    messages: combinedMessages,
    canLoadEarlier,
    loadingEarlier,
    earlierFailed,
    loadEarlier,
    retry,
  };
}
