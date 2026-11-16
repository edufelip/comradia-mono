import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  cachedProfile,
  collectDiscoveryCandidates,
  filterDiscovery,
  invalidateDisappearedProfiles,
  mapWithConcurrency,
  matchIdFor,
  otherUid,
  processQueryPages,
  reconcileLikePairs,
  reportIdFor,
  toPublicProfile,
} from './shared';

const CARD = {
  displayName: 'Ana',
  age: 29,
  vibe: 'bookworm',
  lookingFor: 'everyone',
  unionMember: true,
  union: 'apeoesp',
  values: ['bookshops_coffee', 'tenant_rights', 'cycling'],
  promptId: 'perfect_sunday',
  promptAnswer: 'Feira, then a long lunch.',
  photoPath: null,
};

describe('toPublicProfile', () => {
  it('drops the Firestore timestamps and any other extra key', () => {
    const stored = {
      ...CARD,
      createdAt: { seconds: 1, nanoseconds: 0 },
      updatedAt: { seconds: 2, nanoseconds: 0 },
      phoneNumber: '+5511987654321',
    };
    const profile = toPublicProfile(stored);
    assert.deepEqual(profile, CARD);
    assert.deepEqual(Object.keys(profile).sort(), Object.keys(CARD).sort());
  });

  it('keeps null union and empty-ish values as stored', () => {
    const profile = toPublicProfile({ ...CARD, unionMember: false, union: null, values: [] });
    assert.equal(profile.union, null);
    assert.deepEqual(profile.values, []);
  });

  it('does not mutate its input', () => {
    const stored = { ...CARD, createdAt: 'x' };
    toPublicProfile(stored);
    assert.equal(stored.createdAt, 'x');
  });

  it('keeps a string photoPath', () => {
    const path = 'photos/u1/abc.jpg';
    assert.equal(toPublicProfile({ ...CARD, photoPath: path }).photoPath, path);
  });

  it('returns photoPath null when it is missing or not a string', () => {
    const { photoPath: _unused, ...withoutPhoto } = { ...CARD, photoPath: 'x' };
    assert.equal(toPublicProfile(withoutPhoto).photoPath, null);
    assert.equal(toPublicProfile({ ...CARD, photoPath: 42 }).photoPath, null);
    assert.equal(toPublicProfile({ ...CARD, photoPath: undefined }).photoPath, null);
  });
});

describe('filterDiscovery', () => {
  const docs = [
    { id: 'me', data: { ...CARD, displayName: 'Me' } },
    { id: 'maya', data: { ...CARD, displayName: 'Maya', createdAt: 'stamp' } },
    { id: 'lucas', data: { ...CARD, displayName: 'Lucas' } },
  ];

  it('excludes the current user and anyone already swiped', () => {
    const deck = filterDiscovery('me', docs, new Set(['lucas']));
    assert.deepEqual(
      deck.map((profile) => profile.id),
      ['maya'],
    );
    assert.equal(deck[0]?.displayName, 'Maya');
    assert.equal('createdAt' in (deck[0] as object), false);
  });

  it('keeps everyone when nothing was swiped', () => {
    const deck = filterDiscovery('someone-else', docs, new Set());
    assert.deepEqual(
      deck.map((profile) => profile.id),
      ['me', 'maya', 'lucas'],
    );
  });

  it('returns an empty deck when everything was swiped', () => {
    assert.deepEqual(filterDiscovery('me', docs, new Set(['maya', 'lucas'])), []);
    assert.deepEqual(filterDiscovery('me', [], new Set()), []);
  });
});

describe('collectDiscoveryCandidates', () => {
  it('pages past swiped profiles until the deck fills and checks only page ids', async () => {
    const pages = [
      ['me', 'a', 'b'].map((id) => ({ id, data: CARD })),
      ['c', 'd', 'e'].map((id) => ({ id, data: CARD })),
    ];
    const requested: string[][] = [];
    const result = await collectDiscoveryCandidates(
      'me',
      3,
      5,
      async (cursor) => {
        const index = cursor === undefined ? 0 : (cursor as number) + 1;
        const docs = pages[index] ?? [];
        return { docs, cursor: docs.length ? index : undefined };
      },
      async (ids) => {
        requested.push(ids);
        return new Set(ids.filter((id) => ['a', 'b', 'c'].includes(id)));
      },
    );
    assert.deepEqual(
      result.candidates.map((person) => person.id),
      ['d', 'e'],
    );
    // Page 1 held nothing new, page 2 did: the next load resumes after page 1.
    assert.equal(result.resume, 0);
    assert.deepEqual(requested, [
      ['me', 'a', 'b'],
      ['c', 'd', 'e'],
    ]);
  });

  it('stops after the hard page cap', async () => {
    let pageCount = 0;
    const result = await collectDiscoveryCandidates(
      'me',
      1,
      2,
      async () => {
        pageCount += 1;
        return { docs: [{ id: `swiped-${pageCount}`, data: CARD }], cursor: pageCount };
      },
      async (ids) => new Set(ids),
    );
    assert.equal(pageCount, 2);
    assert.deepEqual(result.candidates, []);
    assert.equal(result.resume, 2);
  });
});

describe('collectDiscoveryCandidates resume', () => {
  it('starts from the saved cursor instead of the oldest profile', async () => {
    const seen: unknown[] = [];
    const result = await collectDiscoveryCandidates(
      'me',
      2,
      5,
      async (cursor) => {
        seen.push(cursor);
        return { docs: [{ id: 'new', data: CARD }], cursor: 'after-new' };
      },
      async () => new Set(),
      'saved',
    );
    assert.deepEqual(seen, ['saved']);
    assert.deepEqual(
      result.candidates.map((person) => person.id),
      ['new'],
    );
    assert.equal(result.resume, 'saved');
  });
});

describe('cachedProfile', () => {
  it('reuses an in-flight profile request and treats permission denial as missing', async () => {
    const cache = new Map<string, Promise<string | null>>();
    let reads = 0;
    const read = async () => {
      reads += 1;
      throw Object.assign(new Error('blocked'), { code: 'permission-denied' });
    };
    const first = cachedProfile(cache, 'blocked-user', read);
    const second = cachedProfile(cache, 'blocked-user', read);
    assert.equal(await first, null);
    assert.equal(await second, null);
    assert.equal(reads, 1);
  });

  it('drops failed non-permission reads so a later attempt can retry', async () => {
    const cache = new Map<string, Promise<string | null>>();
    await assert.rejects(
      cachedProfile(cache, 'user', async () => {
        throw new Error('offline');
      }),
    );
    assert.equal(cache.has('user'), false);
  });
});

it('invalidates cached profiles when their match disappears', () => {
  const cache = new Map([
    ['still-matched', Promise.resolve(CARD)],
    ['unmatched', Promise.resolve(CARD)],
  ]);
  invalidateDisappearedProfiles(
    cache,
    new Set(['still-matched', 'unmatched']),
    new Set(['still-matched']),
  );
  assert.deepEqual([...cache.keys()], ['still-matched']);
});

it('processes authored message query pages of 300 until the query is exhausted', async () => {
  const source = Array.from({ length: 601 }, (_, index) => index);
  const processed: number[] = [];
  const cursors: number[] = [];
  await processQueryPages(
    300,
    async (cursor) => {
      const start = typeof cursor === 'number' ? cursor : 0;
      cursors.push(start);
      const items = source.slice(start, start + 300);
      return { items, cursor: items.length ? start + items.length : undefined };
    },
    async (items) => {
      processed.push(...items);
    },
  );
  assert.deepEqual(cursors, [0, 300, 600]);
  assert.deepEqual(processed, source);
});

it('mapWithConcurrency bounds simultaneous tasks', async () => {
  let active = 0;
  let maximum = 0;
  await mapWithConcurrency([1, 2, 3, 4, 5, 6, 7], 3, async () => {
    active += 1;
    maximum = Math.max(maximum, active);
    await Promise.resolve();
    active -= 1;
  });
  assert.equal(maximum, 3);
});

describe('matchIdFor', () => {
  it('sorts the two uids and joins them with _', () => {
    assert.equal(matchIdFor('alice', 'bob'), 'alice_bob');
    assert.equal(matchIdFor('bob', 'alice'), 'alice_bob');
  });

  it('does not depend on the like order or on prefix length', () => {
    assert.equal(matchIdFor('ana', 'anabel'), 'ana_anabel');
    assert.equal(matchIdFor('anabel', 'ana'), 'ana_anabel');
  });
});

describe('otherUid', () => {
  it('returns the uid in the match id that is not mine', () => {
    assert.equal(otherUid('alice_bob', 'alice'), 'bob');
    assert.equal(otherUid('alice_bob', 'bob'), 'alice');
  });
});

describe('create-only report and block planning', () => {
  it('uses the reporter and target as a stable report id', () => {
    assert.equal(reportIdFor('reporter', 'target'), 'reporter_target');
  });
});

it('skips either-side blocked pairs and continues after a per-pair reconcile failure', async () => {
  const repaired: string[] = [];
  await reconcileLikePairs(
    ['blocked', 'one', 'fails', 'two'],
    new Set(['blocked', 'one', 'fails', 'two']),
    new Set(['blocked']),
    async (targetUid) => {
      if (targetUid === 'fails') throw new Error('permission-denied');
      repaired.push(targetUid);
    },
  );
  assert.deepEqual(repaired, ['one', 'two']);
});
