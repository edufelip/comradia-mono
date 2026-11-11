import { after, before, beforeEach, describe, it } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  type RulesTestContext,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { db, like, testEnvironment, without } from './helpers';

let env: RulesTestEnvironment;
let alice: ReturnType<RulesTestEnvironment['authenticatedContext']>;
let bob: ReturnType<RulesTestEnvironment['authenticatedContext']>;
let carol: ReturnType<RulesTestEnvironment['authenticatedContext']>;
let signedOut: ReturnType<RulesTestEnvironment['unauthenticatedContext']>;

before(async () => {
  env = await testEnvironment('likes');
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

/** `likes/{targetUid}/from/{likerUid}` — `liker` likes `target`. */
const likeRef = (context: RulesTestContext, target: string, liker: string) =>
  doc(db(context), `likes/${target}/from/${liker}`);

function seed(path: string, data: Record<string, unknown>) {
  return env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(db(context), path), data);
  });
}

describe('likes create', () => {
  it('allows the liker to create the like', async () => {
    await assertSucceeds(setDoc(likeRef(alice, 'bob', 'alice'), like()));
  });

  it('denies liking yourself', async () => {
    await assertFails(setDoc(likeRef(alice, 'alice', 'alice'), like()));
  });

  it('denies writing a like as somebody else', async () => {
    await assertFails(setDoc(likeRef(bob, 'carol', 'alice'), like()));
  });

  it('denies a signed-out create', async () => {
    await assertFails(setDoc(likeRef(signedOut, 'bob', 'alice'), like()));
  });

  it('denies an extra or missing key', async () => {
    await assertFails(setDoc(likeRef(alice, 'bob', 'alice'), like({ note: 'hello' })));
    await assertFails(setDoc(likeRef(alice, 'bob', 'alice'), without(like(), 'createdAt')));
  });

  it('denies a client timestamp instead of request.time', async () => {
    await assertFails(
      setDoc(
        likeRef(alice, 'bob', 'alice'),
        like({ createdAt: Timestamp.fromDate(new Date('2020-01-01')) }),
      ),
    );
  });

  it('denies a second write: a like is never edited', async () => {
    await assertSucceeds(setDoc(likeRef(alice, 'bob', 'alice'), like()));
    await assertFails(setDoc(likeRef(alice, 'bob', 'alice'), like()));
    await assertFails(
      updateDoc(likeRef(alice, 'bob', 'alice'), {
        createdAt: serverTimestamp(),
      }),
    );
  });
});

describe('likes read and delete', () => {
  beforeEach(async () => {
    await seed('likes/alice/from/bob', like());
  });

  it('allows the liked person and the liker to read the like', async () => {
    await assertSucceeds(getDoc(likeRef(alice, 'alice', 'bob')));
    await assertSucceeds(getDoc(likeRef(bob, 'alice', 'bob')));
  });

  it('denies a third person and a signed-out reader', async () => {
    await assertFails(getDoc(likeRef(carol, 'alice', 'bob')));
    await assertFails(getDoc(doc(db(signedOut), 'likes/alice/from/bob')));
  });

  it('allows only the liker to delete the like', async () => {
    await assertFails(deleteDoc(likeRef(alice, 'alice', 'bob')));
    await assertFails(deleteDoc(likeRef(carol, 'alice', 'bob')));
    await assertSucceeds(deleteDoc(likeRef(bob, 'alice', 'bob')));
  });
});
