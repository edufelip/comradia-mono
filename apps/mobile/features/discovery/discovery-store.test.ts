import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { INITIAL_COMRADES, useDiscoveryStore } from './discovery-store';

describe('Comradia discovery store', () => {
  it('moves a candidate to matches when sending solidarity and resets cleanly', () => {
    useDiscoveryStore.getState().resetDeck();
    assert.equal(useDiscoveryStore.getState().candidates.length, INITIAL_COMRADES.length);

    const first = INITIAL_COMRADES[0]!;
    useDiscoveryStore.getState().sendSolidarity(first.id);

    assert.equal(useDiscoveryStore.getState().candidates.length, INITIAL_COMRADES.length - 1);
    assert.equal(useDiscoveryStore.getState().matches[0]?.id, first.id);

    useDiscoveryStore.getState().resetDeck();
    assert.equal(useDiscoveryStore.getState().candidates.length, INITIAL_COMRADES.length);
  });
});
