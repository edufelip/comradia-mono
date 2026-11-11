import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { useSessionStore } from './session-store';

describe('Comradia session store', () => {
  it('starts signed out and flips with sign in and sign out', () => {
    useSessionStore.getState().signOut();
    assert.equal(useSessionStore.getState().signedIn, false);

    useSessionStore.getState().signIn();
    assert.equal(useSessionStore.getState().signedIn, true);

    useSessionStore.getState().signOut();
    assert.equal(useSessionStore.getState().signedIn, false);
  });
});
