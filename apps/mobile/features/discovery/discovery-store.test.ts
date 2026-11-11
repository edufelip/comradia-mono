import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { INITIAL_COMRADES, useDiscoveryStore } from './discovery-store';

const MAYA = INITIAL_COMRADES[0];
const LUCAS = INITIAL_COMRADES[1];
const VAL = INITIAL_COMRADES[2];

const state = () => useDiscoveryStore.getState();
const ids = (profiles: { id: string }[]) => profiles.map((profile) => profile.id);

/**
 * `resetDeck()` intentionally keeps matches, so tests reset both slices
 * explicitly through the store's own setter to stay isolated.
 */
function resetStore() {
  useDiscoveryStore.setState({ candidates: [...INITIAL_COMRADES], matches: [] });
}

describe('Comradia discovery store', () => {
  beforeEach(resetStore);

  it('moves a candidate to matches when sending solidarity and resets cleanly', () => {
    resetStore();
    assert.equal(state().candidates.length, INITIAL_COMRADES.length);

    state().sendSolidarity(MAYA.id);

    assert.equal(state().candidates.length, INITIAL_COMRADES.length - 1);
    assert.equal(state().matches[0]?.id, MAYA.id);

    state().resetDeck();
    assert.equal(state().candidates.length, INITIAL_COMRADES.length);
  });

  it('starts with the full seed deck, in order, and no matches', () => {
    assert.deepEqual(ids(state().candidates), ['comrade-maya', 'comrade-lucas', 'comrade-val']);
    assert.deepEqual(state().matches, []);
  });

  it('removes a liked candidate from the deck and adds it to the front of matches', () => {
    state().sendSolidarity(MAYA.id);

    assert.deepEqual(ids(state().candidates), ['comrade-lucas', 'comrade-val']);
    assert.deepEqual(ids(state().matches), ['comrade-maya']);
    assert.deepEqual(state().matches[0], MAYA);
  });

  it('orders matches newest-first when several candidates are liked', () => {
    state().sendSolidarity(MAYA.id);
    state().sendSolidarity(LUCAS.id);

    assert.deepEqual(ids(state().matches), ['comrade-lucas', 'comrade-maya']);
    assert.deepEqual(ids(state().candidates), ['comrade-val']);
  });

  it('ignores a solidarity for an unknown candidate', () => {
    state().sendSolidarity(MAYA.id);
    const candidatesBefore = state().candidates;
    const matchesBefore = state().matches;

    state().sendSolidarity('comrade-nobody');

    assert.deepEqual(ids(state().candidates), ids(candidatesBefore));
    assert.deepEqual(ids(state().matches), ids(matchesBefore));
    assert.equal(state().matches.length, 1);
  });

  it('never adds duplicates to matches when a liked candidate is liked again after a reset', () => {
    state().sendSolidarity(MAYA.id);
    state().resetDeck();
    state().sendSolidarity(MAYA.id);

    assert.deepEqual(ids(state().matches), ['comrade-maya']);
    assert.equal(state().matches.length, 1);
    assert.deepEqual(ids(state().candidates), ['comrade-lucas', 'comrade-val']);
  });

  it('passes a candidate without creating a match', () => {
    state().passCandidate(LUCAS.id);

    assert.deepEqual(ids(state().candidates), ['comrade-maya', 'comrade-val']);
    assert.deepEqual(state().matches, []);
  });

  it('keeps existing matches when passing another candidate', () => {
    state().sendSolidarity(MAYA.id);
    state().passCandidate(LUCAS.id);

    assert.deepEqual(ids(state().candidates), ['comrade-val']);
    assert.deepEqual(ids(state().matches), ['comrade-maya']);
  });

  it('treats passing an already swiped or unknown candidate as a no-op', () => {
    state().passCandidate(VAL.id);
    const afterFirstPass = state().candidates;

    state().passCandidate(VAL.id);
    state().passCandidate('comrade-nobody');

    assert.deepEqual(ids(state().candidates), ids(afterFirstPass));
    assert.deepEqual(state().matches, []);
  });

  it('treats liking an already passed candidate as a no-op', () => {
    state().passCandidate(MAYA.id);
    state().sendSolidarity(MAYA.id);

    assert.deepEqual(ids(state().candidates), ['comrade-lucas', 'comrade-val']);
    assert.deepEqual(state().matches, []);
  });

  it('resets the deck to the original seed order without touching matches', () => {
    state().sendSolidarity(MAYA.id);
    state().passCandidate(LUCAS.id);
    state().resetDeck();

    assert.deepEqual(ids(state().candidates), ['comrade-maya', 'comrade-lucas', 'comrade-val']);
    assert.deepEqual(ids(state().matches), ['comrade-maya']);
  });

  it('does not mutate the exported seed list', () => {
    state().sendSolidarity(MAYA.id);
    state().sendSolidarity(LUCAS.id);
    state().sendSolidarity(VAL.id);
    state().resetDeck();

    assert.equal(INITIAL_COMRADES.length, 3);
    assert.deepEqual(ids(INITIAL_COMRADES), ['comrade-maya', 'comrade-lucas', 'comrade-val']);
  });

  it('exhausts the deck after liking everyone and restores it on reset', () => {
    for (const profile of INITIAL_COMRADES) state().sendSolidarity(profile.id);

    assert.deepEqual(state().candidates, []);
    assert.deepEqual(ids(state().matches), ['comrade-val', 'comrade-lucas', 'comrade-maya']);

    // Empty-deck actions must stay safe no-ops.
    state().sendSolidarity(MAYA.id);
    state().passCandidate(MAYA.id);
    assert.deepEqual(state().candidates, []);
    assert.equal(state().matches.length, 3);

    state().resetDeck();
    assert.deepEqual(ids(state().candidates), ['comrade-maya', 'comrade-lucas', 'comrade-val']);
  });

  it('exposes well-formed seed profiles', () => {
    assert.equal(new Set(ids(INITIAL_COMRADES)).size, INITIAL_COMRADES.length);

    for (const profile of INITIAL_COMRADES) {
      assert.ok(profile.id.length > 0, 'id is required');
      assert.ok(profile.displayName.trim().length > 0, `${profile.id} needs a display name`);
      assert.ok(profile.age >= 18, `${profile.id} must be an adult profile`);
      assert.ok(profile.causes.length > 0, `${profile.id} needs at least one cause`);
      assert.equal(
        typeof profile.unionMember,
        'boolean',
        `${profile.id} unionMember must be boolean`,
      );
      assert.ok(profile.bio.trim().length > 0, `${profile.id} needs a bio`);
      assert.ok(profile.praxisPrompt.trim().length > 0, `${profile.id} needs a praxis prompt`);
    }
  });
});
