import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { MESSAGE_PAGE_SIZE } from '@/services/backend/shared';
import type { Backend, ChatMessage, Match, Unsubscribe } from '@/services/backend/types';

/** The backend calls S10 needs. Passed in, so this module never imports Firebase. */
export type ChatBackend = Pick<Backend, 'getMatch' | 'onMessages' | 'loadOlderMessages'>;

export type ChatStatus = 'idle' | 'loading' | 'ready' | 'not_found' | 'error';

/**
 * S10: reads the match once (name and shared values for the header) and then follows its
 * messages, oldest first, until the screen unmounts. Regaining focus reloads the match: a
 * card the rules denied (they blocked me) is never cached, so an unblock must get a fresh
 * read for the header and the composer to come back.
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
  const seenMountFocus = useRef(false);
  const conversationKey = useRef<string | null>(null);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  // The mount run below already loads once; only a regained focus reloads.
  useFocusEffect(
    useCallback(() => {
      if (!seenMountFocus.current) {
        seenMountFocus.current = true;
        return;
      }
      setAttempt((value) => value + 1);
    }, []),
  );

  useEffect(() => {
    if (!uid) return;
    let active = true;
    let unsubscribe: Unsubscribe | undefined;
    const key = `${uid}:${matchId}`;
    if (conversationKey.current !== key) {
      // Only a different conversation starts empty; a focus reload keeps what is on screen.
      conversationKey.current = key;
      setMatch(null);
      setStatus('loading');
      setMessages([]);
      setOlderMessages([]);
      setOlderPageWasFull(false);
      setLoadingEarlier(false);
      setEarlierFailed(false);
    } else {
      setStatus((current) => (current === 'error' ? 'loading' : current));
    }

    backend
      .getMatch(uid, matchId)
      .then((found) => {
        if (!active) return;
        setMatch(found);
        if (!found) {
          setStatus('not_found');
          return;
        }
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
      const page = await backend.loadOlderMessages(matchId, earliest.id);
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
