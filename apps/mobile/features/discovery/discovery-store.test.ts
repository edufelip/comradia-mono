import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import type { DiscoveryProfile } from '@/features/profile/profile-schema';

import { INITIAL_DISCOVERY, useDiscoveryStore, type DiscoveryBackend } from './discovery-store';

function profile(id: string, name: string): DiscoveryProfile {
  return {
    id,
    displayName: name,
    age: 30,
    vibe: 'bookworm',
    lookingFor: 'everyone',
    unionMember: false,
    union: null,
    values: ['bookshops_coffee', 'tenant_rights', 'cycling'],
    promptId: 'perfect_sunday',
    promptAnswer: 'Feira, then a long lunch.',
  };
}

const MAYA = profile('p-maya', 'Maya');
const LUCAS = profile('p-lucas', 'Lucas');
const VAL = profile('p-val', 'Val');

const UID = 'me';

function fakeBackend(deck: DiscoveryProfile[] = [MAYA, LUCAS, VAL]) {
  const swipes: { uid: string; id: string; direction: 'like' | 'pass' }[] = [];
  const calls = { list: 0 };

  const backend: DiscoveryBackend = {
    async listDiscovery(uid) {
      calls.list += 1;
      assert.equal(uid, UID);
      return deck;
    },
    async recordSwipe(uid, id, direction) {
      swipes.push({ uid, id, direction });
    },
  };

  return { backend, swipes, calls };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const state = () => useDiscoveryStore.getState();
const ids = (people: { id: string }[]) => people.map((person) => person.id);

beforeEach(() => {
  useDiscoveryStore.setState({ ...INITIAL_DISCOVERY, candidates: [], liked: [] });
});

describe('discovery store', () => {
  it('starts idle with an empty deck and no likes', () => {
    assert.deepEqual(state().status, 'idle');
    assert.deepEqual(state().candidates, []);
    assert.deepEqual(state().liked, []);
  });

  it('loads the deck from the backend for the signed-in uid', async () => {
    const { backend, calls } = fakeBackend();

    const pending = state().load(backend, UID);
    assert.equal(state().status, 'loading');
    await pending;

    assert.equal(calls.list, 1);
    assert.equal(state().status, 'ready');
    assert.deepEqual(ids(state().candidates), ['p-maya', 'p-lucas', 'p-val']);
  });

  it('replaces the previous deck instead of appending to it', async () => {
    const { backend } = fakeBackend();
    await state().load(backend, UID);
    await state().load(backend, UID);

    assert.deepEqual(ids(state().candidates), ['p-maya', 'p-lucas', 'p-val']);
  });

  it('keeps the session likes when the deck is reloaded', async () => {
    const { backend } = fakeBackend();
    await state().load(backend, UID);
    await state().like(backend, UID, MAYA.id);

    await state().load(backend, UID);

    assert.deepEqual(ids(state().liked), ['p-maya']);
  });

  it('reports an error and leaves the old deck alone when loading fails', async () => {
    const { backend } = fakeBackend();
    await state().load(backend, UID);

    const failing: DiscoveryBackend = {
      ...backend,
      listDiscovery: async () => {
        throw new Error('offline');
      },
    };
    await state().load(failing, UID);

    assert.equal(state().status, 'error');
    assert.deepEqual(ids(state().candidates), ['p-maya', 'p-lucas', 'p-val']);
  });

  it('ignores an older load that resolves after a newer one', async () => {
    const { backend } = fakeBackend();
    const slow = deferred<DiscoveryProfile[]>();
    const slowBackend: DiscoveryBackend = { ...backend, listDiscovery: () => slow.promise };

    const first = state().load(slowBackend, UID);
    await state().load(backend, UID);
    slow.resolve([]);
    await first;

    assert.equal(state().status, 'ready');
    assert.deepEqual(ids(state().candidates), ['p-maya', 'p-lucas', 'p-val']);
  });

  it('likes the top card: removes it, records the swipe and adds it to the likes', async () => {
    const { backend, swipes } = fakeBackend();
    await state().load(backend, UID);

    await state().like(backend, UID, MAYA.id);

    assert.deepEqual(ids(state().candidates), ['p-lucas', 'p-val']);
    assert.deepEqual(ids(state().liked), ['p-maya']);
    assert.deepEqual(swipes, [{ uid: UID, id: MAYA.id, direction: 'like' }]);
  });

  it('keeps the newest like first', async () => {
    const { backend } = fakeBackend();
    await state().load(backend, UID);

    await state().like(backend, UID, MAYA.id);
    await state().like(backend, UID, LUCAS.id);

    assert.deepEqual(ids(state().liked), ['p-lucas', 'p-maya']);
    assert.deepEqual(ids(state().candidates), ['p-val']);
  });

  it('does not list the same person twice when they come back around', async () => {
    const { backend } = fakeBackend();
    await state().load(backend, UID);
    // A refresh can bring back someone already liked in this session (e.g. a failed write
    // elsewhere), so liking them again must not duplicate the match list.
    useDiscoveryStore.setState({ liked: [MAYA] });

    await state().like(backend, UID, MAYA.id);

    assert.deepEqual(ids(state().liked), ['p-maya']);
    assert.deepEqual(ids(state().candidates), ['p-lucas', 'p-val']);
  });

  it('ignores likes for a card that is no longer in the deck', async () => {
    const { backend, swipes } = fakeBackend();
    await state().load(backend, UID);
    await state().like(backend, UID, MAYA.id);

    await state().like(backend, UID, MAYA.id);
    await state().like(backend, UID, 'p-nobody');

    assert.deepEqual(ids(state().liked), ['p-maya']);
    assert.equal(swipes.length, 1);
  });

  it('likes optimistically and puts the card back first when the swipe fails', async () => {
    const failure = deferred<void>();
    const { backend } = fakeBackend();
    await state().load(backend, UID);
    const slowSwipe: DiscoveryBackend = { ...backend, recordSwipe: () => failure.promise };

    const pending = state().like(slowSwipe, UID, MAYA.id);
    assert.deepEqual(ids(state().candidates), ['p-lucas', 'p-val']);
    assert.deepEqual(ids(state().liked), ['p-maya']);

    failure.reject(new Error('offline'));
    await pending;

    assert.deepEqual(ids(state().candidates), ['p-maya', 'p-lucas', 'p-val']);
    assert.deepEqual(state().liked, []);
  });

  it('puts a failed like back on top of cards swiped afterwards', async () => {
    const first = deferred<void>();
    const { backend } = fakeBackend();
    await state().load(backend, UID);

    const pending = state().like({ ...backend, recordSwipe: () => first.promise }, UID, MAYA.id);
    await state().like(backend, UID, LUCAS.id);
    first.reject(new Error('offline'));
    await pending;

    assert.deepEqual(ids(state().candidates), ['p-maya', 'p-val']);
    assert.deepEqual(ids(state().liked), ['p-lucas']);
  });

  it('passes the card: removes it, records the swipe and creates no like', async () => {
    const { backend, swipes } = fakeBackend();
    await state().load(backend, UID);

    await state().pass(backend, UID, LUCAS.id);

    assert.deepEqual(ids(state().candidates), ['p-maya', 'p-val']);
    assert.deepEqual(state().liked, []);
    assert.deepEqual(swipes, [{ uid: UID, id: LUCAS.id, direction: 'pass' }]);
  });

  it('puts a failed pass back first and keeps the deck otherwise intact', async () => {
    const failure = deferred<void>();
    const { backend } = fakeBackend();
    await state().load(backend, UID);
    const failing: DiscoveryBackend = { ...backend, recordSwipe: () => failure.promise };

    const pending = state().pass(failing, UID, VAL.id);
    assert.deepEqual(ids(state().candidates), ['p-maya', 'p-lucas']);

    failure.reject(new Error('offline'));
    await pending;

    assert.deepEqual(ids(state().candidates), ['p-val', 'p-maya', 'p-lucas']);
    assert.deepEqual(state().liked, []);
  });

  it('ignores actions on an empty deck', async () => {
    const { backend, swipes } = fakeBackend();

    await state().like(backend, UID, MAYA.id);
    await state().pass(backend, UID, MAYA.id);

    assert.deepEqual(state().candidates, []);
    assert.deepEqual(state().liked, []);
    assert.deepEqual(swipes, []);
  });
});
