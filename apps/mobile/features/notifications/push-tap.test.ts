import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { matchIdFor } from '@/services/backend/shared';
import { createPushTapRouter, type PushTapRouterDependencies } from './push-tap';
import type { Match } from '@/services/backend/types';

function createHarness(options: { blocked?: string[]; returnedMatch?: Match | null } = {}) {
  const calls: string[] = [];
  let session: { status: string; uid: string | null } = { status: 'loading', uid: null };
  const matchId = matchIdFor('alice', 'bob');
  const match: Match = {
    id: matchId,
    other: {
      id: 'bob',
      displayName: 'Bob',
      age: 30,
      vibe: 'bookworm',
      lookingFor: 'everyone',
      unionMember: false,
      union: null,
      values: ['cycling'],
      promptId: 'perfect_sunday',
      promptAnswer: 'A long walk.',
      photoPath: null,
    },
    createdAt: 1,
  };
  const dependencies: PushTapRouterDependencies = {
    getSession: () => session,
    getMatch: async (uid, id) => {
      calls.push(`get-match:${uid}:${id}`);
      if (id !== matchId || uid !== 'alice') return null;
      return Object.prototype.hasOwnProperty.call(options, 'returnedMatch')
        ? (options.returnedMatch ?? null)
        : match;
    },
    listBlockedUids: async (uid) => {
      calls.push(`list-blocked:${uid}`);
      return options.blocked ?? [];
    },
    route: (type, id) => calls.push(`route:${type}:${id}`),
  };
  return {
    router: createPushTapRouter(dependencies),
    calls,
    matchId,
    match,
    setSession(next: { status: string; uid: string | null }) {
      session = next;
    },
  };
}

describe('push notification taps', () => {
  it('queues a cold-start tap until the authenticated session is ready', async () => {
    const { router, calls, matchId, setSession } = createHarness();

    await router.handle({ type: 'message', matchId, recipientUid: 'alice' });
    assert.deepEqual(calls, []);

    setSession({ status: 'ready', uid: 'alice' });
    await router.onSessionReady();

    assert.deepEqual(calls, [
      `get-match:alice:${matchId}`,
      'list-blocked:alice',
      `route:message:${matchId}`,
    ]);
  });

  it('rejects a payload for a previous account before reading any match data', async () => {
    const { router, calls, matchId, setSession } = createHarness();
    setSession({ status: 'ready', uid: 'bob' });

    await router.handle({ type: 'match', matchId, recipientUid: 'alice' });

    assert.deepEqual(calls, []);
  });

  it('does not route when the current account cannot access that match', async () => {
    const { router, calls, matchId, setSession } = createHarness({ returnedMatch: null });
    setSession({ status: 'ready', uid: 'alice' });

    await router.handle({ type: 'message', matchId, recipientUid: 'alice' });

    assert.deepEqual(calls, [`get-match:alice:${matchId}`]);
  });

  it('does not route from a push when the other profile is hidden', async () => {
    const baseline = createHarness();
    const { router, calls, matchId, setSession } = createHarness({
      returnedMatch: { ...baseline.match, other: { id: 'bob', hidden: true } },
    });
    setSession({ status: 'ready', uid: 'alice' });

    await router.handle({ type: 'message', matchId, recipientUid: 'alice' });

    assert.deepEqual(calls, [`get-match:alice:${matchId}`]);
  });

  it('does not route when either person in the match is blocked', async () => {
    const { router, calls, matchId, setSession } = createHarness({ blocked: ['bob'] });
    setSession({ status: 'ready', uid: 'alice' });

    await router.handle({ type: 'message', matchId, recipientUid: 'alice' });

    assert.ok(calls.includes(`get-match:alice:${matchId}`));
    assert.ok(calls.includes('list-blocked:alice'));
    assert.equal(
      calls.some((call) => call.startsWith('route:')),
      false,
    );
  });

  it('ignores malformed payloads and payloads without recipient binding', async () => {
    const { router, calls, matchId, setSession } = createHarness();
    setSession({ status: 'ready', uid: 'alice' });

    await router.handle({ type: 'other', matchId, recipientUid: 'alice' });
    await router.handle({ type: 'message', matchId, recipientUid: 'bob' });
    await router.handle({ type: 'message', matchId });
    await router.handle({
      type: 'message',
      matchId: 'https://attacker.invalid',
      recipientUid: 'alice',
    });

    assert.deepEqual(calls, []);
  });

  it('ignores owner report alerts, which carry no match to open', async () => {
    const { router, calls, setSession } = createHarness();
    setSession({ status: 'ready', uid: 'alice' });

    await router.handle({ type: 'report', reportId: 'report-1' });

    assert.deepEqual(calls, []);
  });

  it('checks that the returned match id is canonical for the signed-in member', async () => {
    const baseline = createHarness();
    const { router, calls, matchId, setSession } = createHarness({
      returnedMatch: { ...baseline.match, id: 'alice_carol' },
    });
    setSession({ status: 'ready', uid: 'alice' });

    await router.handle({ type: 'match', matchId, recipientUid: 'alice' });

    assert.ok(calls.includes(`get-match:alice:${matchId}`));
    assert.equal(
      calls.some((call) => call.startsWith('route:')),
      false,
    );
  });

  it('drops a tap when the session changes while match access is being checked', async () => {
    let resolveMatch!: (match: Match | null) => void;
    let requestStarted!: () => void;
    const started = new Promise<void>((resolve) => (requestStarted = resolve));
    const harness = createHarness();
    // Replace the normal ready session with one whose match check can be held in flight.
    const router = createPushTapRouter({
      getSession: () => ({ status: 'ready', uid: currentUid }),
      getMatch: () => {
        requestStarted();
        return new Promise<Match | null>((resolve) => (resolveMatch = resolve));
      },
      listBlockedUids: async () => [],
      route: (type, id) => harness.calls.push(`route:${type}:${id}`),
    });
    let currentUid: string | null = 'alice';

    const pending = router.handle({
      type: 'message',
      matchId: harness.matchId,
      recipientUid: 'alice',
    });
    await started;
    currentUid = 'bob';
    resolveMatch(harness.match);
    await pending;

    assert.equal(
      harness.calls.some((call) => call.startsWith('route:')),
      false,
    );
  });
});
