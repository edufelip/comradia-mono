import { after, before, beforeEach, describe, it } from 'node:test';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { db, swipe, testEnvironment, without } from './helpers';

let env: RulesTestEnvironment;
let alice: ReturnType<RulesTestEnvironment['authenticatedContext']>;
let bob: ReturnType<RulesTestEnvironment['authenticatedContext']>;
let signedOut: ReturnType<RulesTestEnvironment['unauthenticatedContext']>;

before(async () => {
  env = await testEnvironment('swipes');
  alice = env.authenticatedContext('alice');
  bob = env.authenticatedContext('bob');
  signedOut = env.unauthenticatedContext();
});

after(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

/** `users/{owner}/swipes/{targetUid}` */
const swipeRef = (
  context: ReturnType<RulesTestEnvironment['authenticatedContext']>,
  owner: string,
  target: string,
) => doc(db(context), `users/${owner}/swipes/${target}`);

function seed(path: string, data: Record<string, unknown>) {
  return env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(db(context), path), data);
  });
}

describe('swipes write', () => {
  it('allows the owner to like and to change it to a pass', async () => {
    await assertSucceeds(setDoc(swipeRef(alice, 'alice', 'bob'), swipe()));
    await assertSucceeds(
      updateDoc(swipeRef(alice, 'alice', 'bob'), { direction: 'pass', createdAt: serverTimestamp() }),
    );
  });

  it('denies a swipe on yourself', async () => {
    await assertFails(setDoc(swipeRef(alice, 'alice', 'alice'), swipe()));
  });

  it('denies a write under another user', async () => {
    await assertFails(setDoc(swipeRef(bob, 'alice', 'carol'), swipe()));
    await assertFails(setDoc(swipeRef(signedOut, 'alice', 'bob'), swipe()));
  });

  it('denies a direction outside like / pass, and a missing direction', async () => {
    await assertFails(setDoc(swipeRef(alice, 'alice', 'bob'), swipe({ direction: 'superlike' })));
    await assertFails(setDoc(swipeRef(alice, 'alice', 'bob'), without(swipe(), 'direction')));
  });

  it('denies extra and missing keys', async () => {
    await assertFails(setDoc(swipeRef(alice, 'alice', 'bob'), swipe({ note: 'hello' })));
    await assertFails(setDoc(swipeRef(alice, 'alice', 'bob'), without(swipe(), 'createdAt')));
  });

  it('denies a client timestamp instead of request.time', async () => {
    await assertFails(
      setDoc(
        swipeRef(alice, 'alice', 'bob'),
        swipe({ createdAt: Timestamp.fromDate(new Date('2020-01-01')) }),
      ),
    );
  });
});

describe('swipes read and delete', () => {
  beforeEach(async () => {
    await seed('users/alice/swipes/bob', swipe());
  });

  it('allows only the owner to read the swipe', async () => {
    await assertSucceeds(getDoc(swipeRef(alice, 'alice', 'bob')));
    await assertFails(getDoc(swipeRef(bob, 'alice', 'bob')));
    await assertFails(getDoc(swipeRef(signedOut, 'alice', 'bob')));
  });

  it('allows only the owner to delete the swipe', async () => {
    await assertFails(deleteDoc(swipeRef(bob, 'alice', 'bob')));
    await assertSucceeds(deleteDoc(swipeRef(alice, 'alice', 'bob')));
  });
});
