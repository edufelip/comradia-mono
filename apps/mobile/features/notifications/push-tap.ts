import { matchIdFor } from '@/services/backend/shared';
import { matchHasCard, type Match } from '@/services/backend/types';

export type PushTapIntent = {
  type: 'match' | 'message';
  matchId: string;
  recipientUid: string;
};

export type PushTapRouterDependencies = {
  getSession(): { status: string; uid: string | null };
  getMatch(uid: string, matchId: string): Promise<Match | null>;
  listBlockedUids(uid: string): Promise<string[]>;
  route(type: PushTapIntent['type'], matchId: string): void;
};

function parseIntent(data: Record<string, unknown> | null | undefined): PushTapIntent | null {
  if (!data || (data.type !== 'match' && data.type !== 'message')) return null;
  if (typeof data.matchId !== 'string' || !data.matchId || data.matchId.length > 256) return null;
  if (/[\/?#\u0000-\u001f]/.test(data.matchId)) return null;
  if (typeof data.recipientUid !== 'string' || !data.recipientUid) return null;
  return { type: data.type, matchId: data.matchId, recipientUid: data.recipientUid };
}

/** Queues taps during auth restoration and validates every route against current backend state. */
export function createPushTapRouter(dependencies: PushTapRouterDependencies) {
  const pending: PushTapIntent[] = [];

  const readySession = (uid: string) => {
    const session = dependencies.getSession();
    return session.status === 'ready' && session.uid === uid;
  };

  const verifyAndRoute = async (intent: PushTapIntent) => {
    const uid = intent.recipientUid;
    if (!readySession(uid)) return;

    try {
      const match = await dependencies.getMatch(uid, intent.matchId);
      if (!readySession(uid) || !match || match.id !== intent.matchId) return;
      if (!matchHasCard(match)) return;
      if (!match.other.id || match.other.id === uid || matchIdFor(uid, match.other.id) !== match.id)
        return;

      const blocked = await dependencies.listBlockedUids(uid);
      if (!readySession(uid) || blocked.includes(match.other.id)) return;

      dependencies.route(intent.type, match.id);
    } catch {
      // A denied read, offline state, or deleted match is a discarded tap, not a route guess.
    }
  };

  return {
    handle(data: Record<string, unknown> | null | undefined): Promise<void> {
      const intent = parseIntent(data);
      if (!intent) return Promise.resolve();

      const session = dependencies.getSession();
      if (session.status === 'loading' || session.status === 'needsOnboarding') {
        if (pending.length === 10) pending.shift();
        pending.push(intent);
        return Promise.resolve();
      }
      if (session.status !== 'ready' || !session.uid) return Promise.resolve();
      return verifyAndRoute(intent);
    },

    /** Call after session/profile resolution; pending taps never bypass current account checks. */
    async onSessionReady(): Promise<void> {
      const session = dependencies.getSession();
      if (session.status === 'signedOut' || session.status === 'error') {
        pending.length = 0;
        return;
      }
      if (session.status !== 'ready' || !session.uid) return;
      const intents = pending.splice(0);
      for (const intent of intents) await verifyAndRoute(intent);
    },
  };
}
