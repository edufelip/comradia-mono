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
import { account, db, testEnvironment, without } from './helpers';

let env: RulesTestEnvironment;
let alice: ReturnType<RulesTestEnvironment['authenticatedContext']>;
let bob: ReturnType<RulesTestEnvironment['authenticatedContext']>;
let aliceMax: ReturnType<RulesTestEnvironment['authenticatedContext']>;
let signedOut: ReturnType<RulesTestEnvironment['unauthenticatedContext']>;

before(async () => {
  env = await testEnvironment('users');
  alice = env.authenticatedContext('alice');
  bob = env.authenticatedContext('bob');
  aliceMax = env.authenticatedContext('alice-max');
  signedOut = env.unauthenticatedContext();
});

after(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

const aliceAccount = () => doc(db(alice), 'users/alice');

function seed(path: string, data: Record<string, unknown>) {
  return env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(db(context), path), data);
  });
}

describe('users/{uid} read', () => {
  it('allows only the owner to read the account', async () => {
    await seed('users/alice', account());
    await assertSucceeds(getDoc(aliceAccount()));
    await assertFails(getDoc(doc(db(bob), 'users/alice')));
    await assertFails(getDoc(doc(db(signedOut), 'users/alice')));
  });
});

describe('users/{uid} create', () => {
  it('allows the owner to create a valid account', async () => {
    await assertSucceeds(setDoc(aliceAccount(), account()));
  });

  it('allows the shared-passion weight boundaries 0 and 100', async () => {
    // A second account needs a second owner: the rules require uid == document id, and a
    // second write to alice's own document would be an update.
    await assertSucceeds(setDoc(aliceAccount(), account({ sharedPassionWeight: 0 })));
    await assertSucceeds(
      setDoc(doc(db(aliceMax), 'users/alice-max'), account({ sharedPassionWeight: 100 })),
    );
  });

  it('denies creating an account for another user or while signed out', async () => {
    await assertFails(setDoc(doc(db(bob), 'users/alice'), account()));
    await assertFails(setDoc(doc(db(signedOut), 'users/alice'), account()));
  });

  it('denies a birthDate that is not YYYY-MM-DD', async () => {
    await assertFails(setDoc(aliceAccount(), account({ birthDate: '1990-1-2' })));
    await assertFails(setDoc(aliceAccount(), account({ birthDate: '02/01/1990' })));
    await assertFails(setDoc(aliceAccount(), account({ birthDate: 19900102 })));
  });

  it('denies a weight outside 0–100 or that is not an int', async () => {
    await assertFails(setDoc(aliceAccount(), account({ sharedPassionWeight: -1 })));
    await assertFails(setDoc(aliceAccount(), account({ sharedPassionWeight: 101 })));
    await assertFails(setDoc(aliceAccount(), account({ sharedPassionWeight: 60.5 })));
  });

  it('denies missing and extra keys', async () => {
    await assertFails(setDoc(aliceAccount(), without(account(), 'birthDate')));
    await assertFails(setDoc(aliceAccount(), account({ email: 'alice@example.com' })));
  });

  it('denies client timestamps instead of request.time', async () => {
    await assertFails(
      setDoc(aliceAccount(), account({ createdAt: Timestamp.fromDate(new Date('2020-01-01')) })),
    );
    await assertFails(
      setDoc(aliceAccount(), account({ updatedAt: Timestamp.fromDate(new Date('2020-01-01')) })),
    );
  });
});

describe('users/{uid} update and delete', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(db(context), 'users/alice'), account());
    });
  });

  it('allows the owner to update a field and refresh updatedAt', async () => {
    await assertSucceeds(
      updateDoc(aliceAccount(), { sharedPassionWeight: 80, updatedAt: serverTimestamp() }),
    );
  });

  it('denies an update that changes createdAt or leaves updatedAt stale', async () => {
    await assertFails(
      updateDoc(aliceAccount(), {
        createdAt: Timestamp.fromDate(new Date('2020-01-01')),
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(aliceAccount(), {
        sharedPassionWeight: 20,
        updatedAt: Timestamp.fromDate(new Date('2020-01-01')),
      }),
    );
  });

  it("denies updating another user's account", async () => {
    await assertFails(
      updateDoc(doc(db(bob), 'users/alice'), {
        sharedPassionWeight: 20,
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('allows the owner to delete and denies anyone else', async () => {
    await assertFails(deleteDoc(doc(db(bob), 'users/alice')));
    await assertSucceeds(deleteDoc(aliceAccount()));
  });
});
