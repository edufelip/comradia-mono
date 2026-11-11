import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { useSessionStore } from './session-store';

const state = () => useSessionStore.getState();

describe('Comradia session store', () => {
  beforeEach(() => useSessionStore.setState({ signedIn: false }));

  it('starts signed out and flips with sign in and sign out', () => {
    state().signOut();
    assert.equal(state().signedIn, false);

    state().signIn();
    assert.equal(state().signedIn, true);

    state().signOut();
    assert.equal(state().signedIn, false);
  });

  it('treats signIn as idempotent', () => {
    state().signIn();
    state().signIn();
    state().signIn();

    assert.equal(state().signedIn, true);
  });

  it('treats signOut as idempotent', () => {
    state().signOut();
    state().signOut();

    assert.equal(state().signedIn, false);
  });

  it('can sign in again after signing out', () => {
    state().signIn();
    state().signOut();
    state().signIn();

    assert.equal(state().signedIn, true);
  });
});
