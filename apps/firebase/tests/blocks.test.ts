import assert from 'node:assert/strict';
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
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { block, db, testEnvironment, without } from './helpers';

let env: RulesTestEnvironment;
let alice: ReturnType<RulesTestEnvironment['authenticatedContext']>;
let bob: ReturnType<RulesTestEnvironment['authenticatedContext']>;
let carol: ReturnType<RulesTestEnvironment['authenticatedContext']>;
let signedOut: ReturnType<RulesTestEnvironment['unauthenticatedContext']>;

before(async () => {
  env = await testEnvironment('blocks');
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

/** `users/{uid}/blocks/{targetUid}` — `uid` blocked `target`. */
const blockRef = (context: RulesTestContext, uid: string, target: string) =>
  doc(db(context), `users/${uid}/blocks/${target}`);

/** `blocks/{targetUid}/by/{blockerUid}` — the reverse index, read from the target's side. */
const reverseRef = (context: RulesTestContext, target: string, blocker: string) =>
  doc(db(context), `blocks/${target}/by/${blocker}`);

function seed(path: string, data: Record<string, unknown>) {
  return env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(db(context), path), data);
  });
}

describe('users/{uid}/blocks create', () => {
  it('allows the blocker to create the block in their own list', async () => {
    await assertSucceeds(setDoc(blockRef(alice, 'alice', 'bob'), block()));
  });

  it('denies blocking yourself', async () => {
    await assertFails(setDoc(blockRef(alice, 'alice', 'alice'), block()));
  });

  it("denies writing a block into somebody else's list", async () => {
    await assertFails(setDoc(blockRef(bob, 'alice', 'carol'), block()));
  });

  it('denies a signed-out create', async () => {
    await assertFails(setDoc(blockRef(signedOut, 'alice', 'bob'), block()));
  });

  it('denies an extra or missing key', async () => {
    await assertFails(setDoc(blockRef(alice, 'alice', 'bob'), block({ note: 'ignore them' })));
    await assertFails(setDoc(blockRef(alice, 'alice', 'bob'), without(block(), 'createdAt')));
  });

  it('denies a client timestamp instead of request.time', async () => {
    await assertFails(
      setDoc(
        blockRef(alice, 'alice', 'bob'),
        block({ createdAt: Timestamp.fromDate(new Date('2020-01-01')) }),
      ),
    );
  });

  it('denies a second write: a block is never edited', async () => {
    await assertSucceeds(setDoc(blockRef(alice, 'alice', 'bob'), block()));
    await assertFails(setDoc(blockRef(alice, 'alice', 'bob'), block()));
    await assertFails(
      updateDoc(blockRef(alice, 'alice', 'bob'), { createdAt: serverTimestamp() }),
    );
  });
});

describe('users/{uid}/blocks read and delete', () => {
  beforeEach(async () => {
    await seed('users/alice/blocks/bob', block());
  });

  it('allows the owner to get and list their blocks', async () => {
    await assertSucceeds(getDoc(blockRef(alice, 'alice', 'bob')));
    await assertSucceeds(getDocs(collection(db(alice), 'users/alice/blocks')));
  });

  it('denies a stranger and a signed-out reader', async () => {
    await assertFails(getDoc(blockRef(bob, 'alice', 'bob')));
    await assertFails(getDocs(collection(db(carol), 'users/alice/blocks')));
    await assertFails(getDoc(doc(db(signedOut), 'users/alice/blocks/bob')));
  });

  it('allows only the owner to delete the block', async () => {
    await assertFails(deleteDoc(blockRef(bob, 'alice', 'bob')));
    await assertFails(deleteDoc(blockRef(carol, 'alice', 'bob')));
    await assertSucceeds(deleteDoc(blockRef(alice, 'alice', 'bob')));
  });
});

describe('blocks/{targetUid}/by/{blockerUid} create', () => {
  it('allows the blocker to write both sides in one batch', async () => {
    const batch = writeBatch(db(alice));
    batch.set(blockRef(alice, 'alice', 'bob'), block());
    batch.set(reverseRef(alice, 'bob', 'alice'), block());
    await assertSucceeds(batch.commit());
  });

  it('denies a reverse index written by someone other than the blocker', async () => {
    await assertFails(setDoc(reverseRef(bob, 'bob', 'alice'), block()));
    await assertFails(setDoc(reverseRef(carol, 'bob', 'alice'), block()));
  });

  it('denies blocking yourself', async () => {
    await assertFails(setDoc(reverseRef(alice, 'alice', 'alice'), block()));
  });

  it('denies a signed-out create', async () => {
    await assertFails(setDoc(reverseRef(signedOut, 'bob', 'alice'), block()));
  });

  it('denies an extra or missing key, and a client timestamp', async () => {
    await assertFails(setDoc(reverseRef(alice, 'bob', 'alice'), block({ reason: 'spam' })));
    await assertFails(setDoc(reverseRef(alice, 'bob', 'alice'), without(block(), 'createdAt')));
    await assertFails(
      setDoc(
        reverseRef(alice, 'bob', 'alice'),
        block({ createdAt: Timestamp.fromDate(new Date('2020-01-01')) }),
      ),
    );
  });

  it('denies a second write: the reverse index is never edited', async () => {
    await assertSucceeds(setDoc(reverseRef(alice, 'bob', 'alice'), block()));
    await assertFails(setDoc(reverseRef(alice, 'bob', 'alice'), block()));
    await assertFails(
      updateDoc(reverseRef(alice, 'bob', 'alice'), { createdAt: serverTimestamp() }),
    );
  });
});

describe('blocks/{targetUid}/by/{blockerUid} read and delete', () => {
  beforeEach(async () => {
    await seed('blocks/bob/by/alice', block());
  });

  it('allows the target and the blocker to read it', async () => {
    await assertSucceeds(getDoc(reverseRef(bob, 'bob', 'alice')));
    await assertSucceeds(getDoc(reverseRef(alice, 'bob', 'alice')));
  });

  it('denies a third person and a signed-out reader', async () => {
    await assertFails(getDoc(reverseRef(carol, 'bob', 'alice')));
    await assertFails(getDocs(collection(db(carol), 'blocks/bob/by')));
    await assertFails(getDoc(doc(db(signedOut), 'blocks/bob/by/alice')));
  });

  it('allows only the blocker to delete it: the target cannot un-block themselves', async () => {
    await assertFails(deleteDoc(reverseRef(bob, 'bob', 'alice')));
    await assertFails(deleteDoc(reverseRef(carol, 'bob', 'alice')));
    await assertSucceeds(deleteDoc(reverseRef(alice, 'bob', 'alice')));
  });

  it('lets the blocker unblock in one batch that removes both sides', async () => {
    await seed('users/alice/blocks/bob', block());
    const batch = writeBatch(db(alice));
    batch.delete(blockRef(alice, 'alice', 'bob'));
    batch.delete(reverseRef(alice, 'bob', 'alice'));
    await assertSucceeds(batch.commit());
    assert.equal((await getDoc(reverseRef(bob, 'bob', 'alice'))).exists(), false);
    assert.equal((await getDoc(blockRef(alice, 'alice', 'bob'))).exists(), false);
  });

  it('keeps the other direction when the target blocked the blocker too', async () => {
    await seed('users/alice/blocks/bob', block());
    await seed('users/bob/blocks/alice', block());
    await seed('blocks/alice/by/bob', block());
    const batch = writeBatch(db(alice));
    batch.delete(blockRef(alice, 'alice', 'bob'));
    batch.delete(reverseRef(alice, 'bob', 'alice'));
    await assertSucceeds(batch.commit());
    assert.equal((await getDoc(reverseRef(bob, 'alice', 'bob'))).exists(), true);
  });
});
