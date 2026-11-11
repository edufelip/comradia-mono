import { after, before, beforeEach, describe, it } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  type RulesTestContext,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, like, match, testEnvironment, without } from './helpers';

let env: RulesTestEnvironment;
let alice: ReturnType<RulesTestEnvironment['authenticatedContext']>;
let bob: ReturnType<RulesTestEnvironment['authenticatedContext']>;
let carol: ReturnType<RulesTestEnvironment['authenticatedContext']>;
let signedOut: ReturnType<RulesTestEnvironment['unauthenticatedContext']>;

before(async () => {
  env = await testEnvironment('matches');
  alice = env.authenticatedContext('alice');
  bob = env.authenticatedContext('bob');
  carol = env.authenticatedContext('carol');
  signedOut = env.unauthenticatedContext();
});

after(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

const matchRef = (context: RulesTestContext, id: string) => doc(db(context), `matches/${id}`);

function seed(path: string, data: Record<string, unknown>) {
  return env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(db(context), path), data);
  });
}

/** Both likes exist and the match does not yet. */
function seedBothLikes() {
  return Promise.all([seed('likes/alice/from/bob', like()), seed('likes/bob/from/alice', like())]);
}

describe('matches create', () => {
  it('allows one of the two to create the match when both likes exist', async () => {
    await seedBothLikes();
    await assertSucceeds(setDoc(matchRef(alice, 'alice_bob'), match('alice', 'bob')));
  });

  it('counts a like written in the same batch (existsAfter)', async () => {
    await seed('likes/bob/from/alice', like());
    const batch = writeBatch(db(bob));
    batch.set(doc(db(bob), 'likes/alice/from/bob'), like());
    batch.set(doc(db(bob), 'matches/alice_bob'), match('alice', 'bob'));
    await assertSucceeds(batch.commit());
  });

  it('denies a match when only my like exists', async () => {
    await seed('likes/bob/from/alice', like());
    await assertFails(setDoc(matchRef(alice, 'alice_bob'), match('alice', 'bob')));
  });

  it('denies a match when the like back is missing', async () => {
    await seed('likes/alice/from/bob', like());
    await assertFails(setDoc(matchRef(alice, 'alice_bob'), match('alice', 'bob')));
  });

  it('denies a match when neither like exists', async () => {
    await assertFails(setDoc(matchRef(alice, 'alice_bob'), match('alice', 'bob')));
  });

  it('denies an id that is not the two uids sorted and joined', async () => {
    await seedBothLikes();
    await assertFails(setDoc(matchRef(alice, 'bob_alice'), match('alice', 'bob')));
    await assertFails(setDoc(matchRef(alice, 'alice-bob'), match('alice', 'bob')));
  });

  it('denies users that are unsorted or the wrong length', async () => {
    await seedBothLikes();
    await assertFails(
      setDoc(matchRef(alice, 'alice_bob'), {
        users: ['bob', 'alice'],
        createdAt: serverTimestamp(),
      }),
    );
    await assertFails(
      setDoc(matchRef(alice, 'alice_bob'), {
        users: ['alice'],
        createdAt: serverTimestamp(),
      }),
    );
    await assertFails(
      setDoc(matchRef(alice, 'alice_bob_carol'), {
        users: ['alice', 'bob', 'carol'],
        createdAt: serverTimestamp(),
      }),
    );
  });

  it('denies a match the caller is not part of', async () => {
    await seedBothLikes();
    await assertFails(setDoc(matchRef(carol, 'alice_bob'), match('alice', 'bob')));
  });

  it('denies a signed-out create', async () => {
    await seedBothLikes();
    await assertFails(setDoc(matchRef(signedOut, 'alice_bob'), match('alice', 'bob')));
  });

  it('denies extra and missing keys, and a client timestamp', async () => {
    await seedBothLikes();
    await assertFails(setDoc(matchRef(alice, 'alice_bob'), match('alice', 'bob', { seen: true })));
    await assertFails(
      setDoc(matchRef(alice, 'alice_bob'), without(match('alice', 'bob'), 'createdAt')),
    );
    await assertFails(
      setDoc(
        matchRef(alice, 'alice_bob'),
        match('alice', 'bob', {
          createdAt: Timestamp.fromDate(new Date('2020-01-01')),
        }),
      ),
    );
  });

  it('denies update and delete', async () => {
    await seedBothLikes();
    await seed('matches/alice_bob', match('alice', 'bob'));
    await assertFails(updateDoc(matchRef(alice, 'alice_bob'), { createdAt: serverTimestamp() }));
    await assertFails(deleteDoc(matchRef(alice, 'alice_bob')));
    await assertFails(deleteDoc(matchRef(carol, 'alice_bob')));
  });
});

describe('matches read', () => {
  beforeEach(async () => {
    await seed('matches/alice_bob', match('alice', 'bob'));
  });

  it('allows both people to get the match', async () => {
    await assertSucceeds(getDoc(matchRef(alice, 'alice_bob')));
    await assertSucceeds(getDoc(matchRef(bob, 'alice_bob')));
  });

  it('allows a get of a match that does not exist yet', async () => {
    await assertSucceeds(getDoc(matchRef(alice, 'alice_carol')));
  });

  it('denies a third person and a signed-out reader', async () => {
    await assertFails(getDoc(matchRef(carol, 'alice_bob')));
    await assertFails(getDoc(matchRef(signedOut, 'alice_bob')));
  });

  it('allows a list filtered by array-contains on my uid', async () => {
    await assertSucceeds(
      getDocs(query(collection(db(alice), 'matches'), where('users', 'array-contains', 'alice'))),
    );
    await assertSucceeds(
      getDocs(query(collection(db(bob), 'matches'), where('users', 'array-contains', 'bob'))),
    );
  });

  it('denies a list that would include a match I am not in', async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(db(context), 'matches/bob_carol'), match('bob', 'carol'));
    });
    await assertFails(
      getDocs(query(collection(db(carol), 'matches'), where('users', 'array-contains', 'alice'))),
    );
    await assertFails(getDocs(collection(db(alice), 'matches')));
    await assertFails(getDocs(collection(db(signedOut), 'matches')));
  });
});
