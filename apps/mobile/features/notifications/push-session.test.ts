import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createPushSessionController, type PushSessionDependencies } from './push-session';

function createHarness() {
  const calls: string[] = [];
  let authenticatedUid: string | null = 'alice';
  let finishInitialization!: () => void;
  let initializationStarted!: () => void;
  const started = new Promise<void>((resolve) => (initializationStarted = resolve));
  const initialization = new Promise<void>((resolve) => (finishInitialization = resolve));
  const dependencies: PushSessionDependencies = {
    getAuthenticatedUid: () => authenticatedUid,
    initialize: () => {
      initializationStarted();
      return initialization;
    },
    onReady: async (uid) => {
      calls.push(`ready:${uid}`);
    },
    enable: async (uid) => {
      calls.push(`enable:${uid}`);
      return 'authorized';
    },
    beforeSignOut: async (uid) => {
      calls.push(`sign-out:${uid}`);
    },
    beforeAccountDeletion: async (uid) => {
      calls.push(`delete:${uid}`);
    },
    onUnavailable: async () => {
      calls.push('unavailable');
    },
  };
  return {
    controller: createPushSessionController(dependencies),
    calls,
    started,
    finishInitialization: () => finishInitialization(),
    setAuthenticatedUid(uid: string | null) {
      authenticatedUid = uid;
    },
  };
}

describe('push notification session coordination', () => {
  it('does not let delayed initialization register an account after sign-out starts', async () => {
    const harness = createHarness();
    const ready = harness.controller.onReady('alice');
    await harness.started;

    const signingOut = harness.controller.beforeSignOut('alice');
    harness.finishInitialization();
    await Promise.all([ready, signingOut]);

    assert.deepEqual(harness.calls, ['sign-out:alice']);
    assert.equal(harness.controller.getActiveUid(), null);
  });

  it('does not open a permission prompt after sign-out invalidates pending initialization', async () => {
    const harness = createHarness();
    const ready = harness.controller.onReady('alice');
    await harness.started;
    const enabling = harness.controller.enable('alice');
    const signingOut = harness.controller.beforeSignOut('alice');
    harness.finishInitialization();

    const permission = await enabling;
    await Promise.all([ready, signingOut]);

    assert.equal(permission, 'denied');
    assert.deepEqual(harness.calls, ['sign-out:alice']);
  });

  it('blocks stale ready callbacks until sign-out has resolved even when auth still shows the old uid', async () => {
    const harness = createHarness();
    await harness.controller.beforeSignOut('alice');
    harness.finishInitialization();

    await harness.controller.onReady('alice');
    const permission = await harness.controller.enable('alice');

    assert.equal(permission, 'denied');
    assert.deepEqual(harness.calls, ['sign-out:alice']);
  });

  it('allows the same account to register after a signed-out session resolves and it signs in again', async () => {
    const harness = createHarness();
    await harness.controller.beforeSignOut('alice');
    harness.setAuthenticatedUid(null);
    await harness.controller.onUnavailable();
    harness.setAuthenticatedUid('alice');
    const ready = harness.controller.onReady('alice');
    await harness.started;
    harness.finishInitialization();

    await ready;

    assert.deepEqual(harness.calls, ['sign-out:alice', 'unavailable', 'ready:alice']);
  });

  it('does not initialize notifications for an auth uid that changed while initialization waited', async () => {
    const harness = createHarness();
    const ready = harness.controller.onReady('alice');
    await harness.started;
    harness.setAuthenticatedUid('bob');
    harness.finishInitialization();

    await ready;

    assert.deepEqual(harness.calls, []);
    assert.equal(harness.controller.getActiveUid(), null);
  });
});
