import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import type { PublicProfile } from '@/features/profile/profile-schema';
import type { AuthUser, Backend } from '@/services/backend/types';

import { INITIAL_SESSION, useSessionStore } from './session-store';
import { syncSession } from './session-sync';

const state = () => useSessionStore.getState();
const user: AuthUser = { uid: 'u1', phoneNumber: '+5511999990000', email: null, displayName: null };
const profile = { displayName: 'Ana' } as PublicProfile;

function fakeBackend(getProfile: (uid: string) => Promise<PublicProfile | null>) {
  let listener: ((u: AuthUser | null) => void) | null = null;
  const backend = {
    onAuthChanged(l: (u: AuthUser | null) => void) {
      listener = l;
      return () => {
        listener = null;
      };
    },
    getProfile,
  } as unknown as Backend;
  return { backend, emit: (u: AuthUser | null) => listener?.(u), active: () => listener !== null };
}

const tick = () => new Promise((resolve) => setImmediate(resolve));

describe('session store', () => {
  beforeEach(() => useSessionStore.setState(INITIAL_SESSION));

  it('starts loading', () => {
    assert.equal(state().status, 'loading');
  });

  it('routes a user without a profile to onboarding, and with one to ready', () => {
    state().setSignedIn(user, null);
    assert.equal(state().status, 'needsOnboarding');
    state().setSignedIn(user, profile);
    assert.equal(state().status, 'ready');
    assert.equal(state().profile, profile);
  });

  it('completes onboarding only while signed in', () => {
    state().completeOnboarding(profile);
    assert.equal(state().status, 'loading');
    state().setSignedIn(user, null);
    state().completeOnboarding(profile);
    assert.equal(state().status, 'ready');
  });

  it('clears everything on sign-out', () => {
    state().setSignedIn(user, profile);
    state().setSignedOut();
    assert.deepEqual(
      { status: state().status, user: state().user, profile: state().profile },
      { status: 'signedOut', user: null, profile: null },
    );
  });
});

describe('syncSession', () => {
  beforeEach(() => useSessionStore.setState(INITIAL_SESSION));

  it('follows auth events and loads the profile', async () => {
    const fake = fakeBackend(async () => profile);
    const stop = syncSession(fake.backend);
    fake.emit(null);
    assert.equal(state().status, 'signedOut');
    fake.emit(user);
    await tick();
    assert.equal(state().status, 'ready');
    stop();
    assert.equal(fake.active(), false);
  });

  it('marks an error when the profile read fails', async () => {
    const fake = fakeBackend(async () => {
      throw new Error('offline');
    });
    syncSession(fake.backend);
    fake.emit(user);
    await tick();
    assert.equal(state().status, 'error');
    assert.equal(state().user, user);
  });

  it('ignores a slow profile read that finishes after sign-out', async () => {
    let resolve: (p: PublicProfile) => void = () => undefined;
    const fake = fakeBackend(() => new Promise((r) => (resolve = r)));
    syncSession(fake.backend);
    fake.emit(user);
    fake.emit(null);
    resolve(profile);
    await tick();
    assert.equal(state().status, 'signedOut');
  });
});
