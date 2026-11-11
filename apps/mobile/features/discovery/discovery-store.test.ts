import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import type { DiscoveryProfile } from '@/features/profile/profile-schema';
import type { LikeResult } from '@/services/backend/types';

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
const MATCH_ID = 'me_p-maya';

function fakeBackend(
  deck: DiscoveryProfile[] = [MAYA, LUCAS, VAL],
  likeResult: LikeResult = { matched: false },
) {
  const swipes: { uid: string; id: string; direction: 'like' | 'pass' }[] = [];
  const likes: { uid: string; id: string }[] = [];
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
    async like(uid, id) {
      likes.push({ uid, id });
      return likeResult;
    },
  };

  return { backend, swipes, likes, calls };
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
  useDiscoveryStore.setState({ ...INITIAL_DISCOVERY, candidates: [] });
});

describe('discovery store', () => {
  it('starts idle with an empty deck', () => {
    assert.deepEqual(state().status, 'idle');
    assert.deepEqual(state().candidates, []);
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

  it('likes the top card: removes it and resolves with the backend answer', async () => {
    const { backend, likes } = fakeBackend();
    await state().load(backend, UID);

    const result = await state().like(backend, UID, MAYA.id);

    assert.deepEqual(result, { matched: false });
    assert.deepEqual(ids(state().candidates), ['p-lucas', 'p-val']);
    assert.deepEqual(likes, [{ uid: UID, id: MAYA.id }]);
  });

  it('resolves with the new match id when the like is mutual', async () => {
    const { backend } = fakeBackend([MAYA, LUCAS, VAL], { matched: true, matchId: MATCH_ID });
    await state().load(backend, UID);

    const result = await state().like(backend, UID, MAYA.id);

    assert.deepEqual(result, { matched: true, matchId: MATCH_ID });
    assert.deepEqual(ids(state().candidates), ['p-lucas', 'p-val']);
  });

  it('ignores likes for a card that is no longer in the deck', async () => {
    const { backend, likes } = fakeBackend();
    await state().load(backend, UID);
    await state().like(backend, UID, MAYA.id);

    const again = await state().like(backend, UID, MAYA.id);
    const nobody = await state().like(backend, UID, 'p-nobody');

    assert.equal(again, null);
    assert.equal(nobody, null);
    assert.deepEqual(ids(state().candidates), ['p-lucas', 'p-val']);
    assert.equal(likes.length, 1);
  });

  it('likes optimistically and puts the card back first when the like fails', async () => {
    const failure = deferred<LikeResult>();
    const { backend } = fakeBackend();
    await state().load(backend, UID);
    const slowLike: DiscoveryBackend = { ...backend, like: () => failure.promise };

    const pending = state().like(slowLike, UID, MAYA.id);
    assert.deepEqual(ids(state().candidates), ['p-lucas', 'p-val']);

    failure.reject(new Error('offline'));
    const result = await pending;

    assert.equal(result, null);
    assert.deepEqual(ids(state().candidates), ['p-maya', 'p-lucas', 'p-val']);
  });

  it('puts a failed like back on top of cards swiped afterwards', async () => {
    const first = deferred<LikeResult>();
    const { backend } = fakeBackend();
    await state().load(backend, UID);

    const pending = state().like({ ...backend, like: () => first.promise }, UID, MAYA.id);
    await state().like(backend, UID, LUCAS.id);
    first.reject(new Error('offline'));
    await pending;

    assert.deepEqual(ids(state().candidates), ['p-maya', 'p-val']);
  });

  it('passes the card: removes it and records the pass', async () => {
    const { backend, swipes } = fakeBackend();
    await state().load(backend, UID);

    await state().pass(backend, UID, LUCAS.id);

    assert.deepEqual(ids(state().candidates), ['p-maya', 'p-val']);
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
  });

  it('ignores actions on an empty deck', async () => {
    const { backend, swipes, likes } = fakeBackend();

    await state().like(backend, UID, MAYA.id);
    await state().pass(backend, UID, MAYA.id);

    assert.deepEqual(state().candidates, []);
    assert.deepEqual(swipes, []);
    assert.deepEqual(likes, []);
  });
});
