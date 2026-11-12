import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createPushLifecycle, type PushLifecycleDependencies } from './push-lifecycle';

function createHarness(overrides: Partial<PushLifecycleDependencies> = {}) {
  const calls: string[] = [];
  const state = {
    enabled: new Set<string>(['alice']),
    tokenHashes: new Map<string, string>([['alice', 'hash-old']]),
    permission: 'authorized' as 'authorized' | 'provisional' | 'denied' | 'not-determined',
    token: 'token-old',
  };
  const dependencies: PushLifecycleDependencies = {
    async getPermission() {
      calls.push('permission');
      return state.permission;
    },
    async requestPermission() {
      calls.push('request-permission');
      return state.permission;
    },
    async getToken() {
      calls.push(`get-token:${state.token}`);
      return state.token;
    },
    async hashToken(token) {
      return `hash-${token}`;
    },
    async isEnabled(uid) {
      return state.enabled.has(uid);
    },
    async setEnabled(uid, enabled) {
      calls.push(`enabled:${uid}:${enabled}`);
      if (enabled) state.enabled.add(uid);
      else state.enabled.delete(uid);
    },
    async getStoredTokenHash(uid) {
      return state.tokenHashes.get(uid) ?? null;
    },
    async setStoredTokenHash(uid, hash) {
      calls.push(`stored:${uid}:${hash ?? 'none'}`);
      if (hash) state.tokenHashes.set(uid, hash);
      else state.tokenHashes.delete(uid);
    },
    async registerToken(uid, token, hash) {
      calls.push(`register:${uid}:${token}:${hash}`);
    },
    async revokeToken(uid, hash) {
      calls.push(`revoke:${uid}:${hash}`);
    },
    async revokeAllTokens(uid) {
      calls.push(`revoke-all:${uid}`);
      state.tokenHashes.delete(uid);
    },
    ...overrides,
  };
  return { lifecycle: createPushLifecycle(dependencies), calls, state };
}

describe('push notification permission and registration', () => {
  it('asks for permission only from the explicit enable action', async () => {
    const { lifecycle, calls } = createHarness();

    await lifecycle.onReady('alice');

    assert.equal(calls.filter((call) => call === 'request-permission').length, 0);
    assert.ok(calls.includes('register:alice:token-old:hash-token-old'));
  });

  it('does not register or persist an opt-in when the explicit permission request is denied', async () => {
    const { lifecycle, calls, state } = createHarness();
    state.permission = 'denied';

    const permission = await lifecycle.enable('alice');

    assert.equal(permission, 'denied');
    assert.equal(calls.filter((call) => call.startsWith('register:')).length, 0);
    assert.ok(calls.includes('enabled:alice:false'));
    assert.equal(state.enabled.has('alice'), false);
  });

  it('revokes a saved token when OS permission was later disabled without prompting again', async () => {
    const { lifecycle, calls, state } = createHarness();
    state.permission = 'denied';

    await lifecycle.onReady('alice');

    assert.ok(calls.includes('revoke:alice:hash-old'));
    assert.equal(state.tokenHashes.has('alice'), false);
    assert.equal(calls.includes('request-permission'), false);
    assert.equal(state.enabled.has('alice'), true);
  });

  it('registers again after the user restores OS permission and the ready session is refreshed', async () => {
    const { lifecycle, calls, state } = createHarness();
    state.permission = 'denied';
    await lifecycle.onReady('alice');
    calls.length = 0;
    state.permission = 'authorized';

    await lifecycle.onReady('alice');

    assert.ok(calls.includes('register:alice:token-old:hash-token-old'));
    assert.equal(state.tokenHashes.get('alice'), 'hash-token-old');
  });

  it('removes the old registration before storing a refreshed token', async () => {
    const { lifecycle, calls, state } = createHarness();
    state.token = 'token-new';

    await lifecycle.onReady('alice');

    assert.ok(
      calls.indexOf('revoke:alice:hash-old') <
        calls.indexOf('register:alice:token-new:hash-token-new'),
      calls.join('\n'),
    );
    assert.equal(state.tokenHashes.get('alice'), 'hash-token-new');
  });

  it('revokes the previous account token before syncing the next ready account', async () => {
    const { lifecycle, calls, state } = createHarness();
    state.enabled.add('bob');
    await lifecycle.onReady('alice');
    calls.length = 0;
    state.token = 'token-bob';

    await lifecycle.onReady('bob');

    assert.ok(
      calls.indexOf('revoke:alice:hash-token-old') <
        calls.indexOf('register:bob:token-bob:hash-token-bob'),
      calls.join('\n'),
    );
  });
});

describe('push notification account ownership', () => {
  it('prevents a delayed token read from registering after sign-out begins', async () => {
    let finishToken!: (token: string) => void;
    let tokenRequested!: () => void;
    const requestStarted = new Promise<void>((resolve) => (tokenRequested = resolve));
    const { lifecycle, calls } = createHarness({
      getToken: () => {
        tokenRequested();
        return new Promise<string>((resolve) => (finishToken = resolve));
      },
    });

    const syncing = lifecycle.onReady('alice');
    await requestStarted;
    const signingOut = lifecycle.beforeSignOut('alice');
    finishToken('late-token');
    await Promise.all([syncing, signingOut]);

    assert.equal(calls.filter((call) => call.startsWith('register:')).length, 0);
    assert.ok(calls.includes('revoke:alice:hash-old'));
  });

  it('stops token registration when a ready session becomes unavailable', async () => {
    let finishToken!: (token: string) => void;
    let tokenRequested!: () => void;
    const requestStarted = new Promise<void>((resolve) => (tokenRequested = resolve));
    const { lifecycle, calls } = createHarness({
      getToken: () => {
        tokenRequested();
        return new Promise<string>((resolve) => (finishToken = resolve));
      },
    });

    const syncing = lifecycle.onReady('alice');
    await requestStarted;
    const invalidating = lifecycle.onUnavailable();
    finishToken('late-token');
    await Promise.all([syncing, invalidating]);

    assert.equal(calls.filter((call) => call.startsWith('register:')).length, 0);
  });

  it('revokes all owned registrations before account deletion', async () => {
    const { lifecycle, calls } = createHarness();

    await lifecycle.beforeAccountDeletion('alice');

    assert.ok(calls.includes('revoke-all:alice'));
    assert.ok(calls.includes('enabled:alice:false'));
  });
});
