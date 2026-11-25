import type { ChatMessage } from '@/services/backend/types';

/** Why the message list's content size is about to change. */
export type ChatScrollIntent = 'none' | 'latest' | 'anchor';

export type ChatScrollAction =
  { kind: 'none' } | { kind: 'latest' } | { kind: 'anchor'; y: number };

/**
 * Why the list changed, from what it held before and holds now: the newest message on the
 * first page and on every arrival, the visible position when older messages prepend above
 * it, nothing when the same list settles again (a refocus re-delivery).
 */
export function scrollIntentFor(
  previous: readonly Pick<ChatMessage, 'id'>[],
  next: readonly Pick<ChatMessage, 'id'>[],
): ChatScrollIntent {
  if (next.length === 0) return 'none';
  if (previous.length === 0) return 'latest';
  if (next[next.length - 1].id !== previous[previous.length - 1].id) return 'latest';
  return next.length > previous.length ? 'anchor' : 'none';
}

/** The offset that keeps the content the user is looking at in place after a prepend. */
export function anchoredOffset(offset: number, previousHeight: number, nextHeight: number): number {
  return Math.max(0, offset + (nextHeight - previousHeight));
}

/** What to do with the viewport when the message content size changed. */
export function chatScrollAction(input: {
  intent: ChatScrollIntent;
  offset: number;
  previousHeight: number;
  height: number;
}): ChatScrollAction {
  if (input.intent === 'latest') return { kind: 'latest' };
  if (input.intent === 'anchor') {
    return { kind: 'anchor', y: anchoredOffset(input.offset, input.previousHeight, input.height) };
  }
  return { kind: 'none' };
}
