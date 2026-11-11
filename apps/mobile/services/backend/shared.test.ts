import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { filterDiscovery, toPublicProfile } from './shared';

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
