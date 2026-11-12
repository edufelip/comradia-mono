import { after, before, beforeEach, describe, it } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { db, report, testEnvironment, without } from './helpers';

let env: RulesTestEnvironment;
let alice: ReturnType<RulesTestEnvironment['authenticatedContext']>;
let bob: ReturnType<RulesTestEnvironment['authenticatedContext']>;
let signedOut: ReturnType<RulesTestEnvironment['unauthenticatedContext']>;

before(async () => {
  env = await testEnvironment('reports');
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

const reports = () => collection(db(alice), 'reports');
const reportRef = (id = 'r1') => doc(db(alice), `reports/${id}`);

/** A report the rules let through, so the read/update/delete tests start from real data. */
async function seedValidReport(id = 'r1') {
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(db(context), `reports/${id}`), report());
  });
  return reportRef(id);
}

describe('reports create', () => {
  it('allows a complete report of another person', async () => {
    await assertSucceeds(addDoc(reports(), report()));
  });

  it('allows the boundary lengths: empty details, 500 characters, a 128-character target', async () => {
    await assertSucceeds(
      addDoc(reports(), report({ details: '', target: 'a'.repeat(128), reason: 'other' })),
    );
    await assertSucceeds(addDoc(reports(), report({ details: 'a'.repeat(500) })));
  });

  it('allows every reason and both contexts', async () => {
    for (const reason of ['harassment', 'hate', 'fake', 'spam', 'underage', 'other']) {
      await assertSucceeds(addDoc(reports(), report({ reason })));
    }
    await assertSucceeds(addDoc(reports(), report({ context: 'profile' })));
    await assertSucceeds(addDoc(reports(), report({ context: 'chat' })));
  });

  it('denies a report filed as somebody else', async () => {
    await assertFails(addDoc(reports(), report({ reporter: 'bob' })));
    await assertFails(addDoc(collection(db(bob), 'reports'), report()));
  });

  it('denies reporting yourself', async () => {
    await assertFails(addDoc(reports(), report({ target: 'alice' })));
  });

  it('denies a target that is empty, too long or not a string', async () => {
    await assertFails(addDoc(reports(), report({ target: '' })));
    await assertFails(addDoc(reports(), report({ target: 'a'.repeat(129) })));
    await assertFails(addDoc(reports(), report({ target: 42 })));
  });

  it('denies a reason outside the list', async () => {
    await assertFails(addDoc(reports(), report({ reason: 'blocked' })));
    await assertFails(addDoc(reports(), report({ reason: 'HARASSMENT' })));
  });

  it('denies details over 500 characters and a non-string', async () => {
    await assertFails(addDoc(reports(), report({ details: 'a'.repeat(501) })));
    await assertFails(addDoc(reports(), report({ details: 42 })));
  });

  it('denies a context outside the list', async () => {
    await assertFails(addDoc(reports(), report({ context: 'email' })));
  });

  it('denies an extra or missing key', async () => {
    await assertFails(addDoc(reports(), report({ status: 'open' })));
    await assertFails(addDoc(reports(), report({ reportId: 'r1' })));
    for (const key of ['reporter', 'target', 'reason', 'details', 'context', 'createdAt']) {
      await assertFails(addDoc(reports(), without(report(), key)));
    }
  });

  it('denies a client timestamp instead of request.time', async () => {
    await assertFails(
      addDoc(reports(), report({ createdAt: Timestamp.fromDate(new Date('2020-01-01')) })),
    );
  });

  it('denies a signed-out create', async () => {
    await assertFails(addDoc(collection(db(signedOut), 'reports'), report()));
  });
});

describe('reports read, update and delete', () => {
  it('denies reading the report back, even to the reporter', async () => {
    const ref = await seedValidReport();
    await assertFails(getDoc(ref));
    await assertFails(getDoc(doc(db(bob), 'reports/r1')));
    await assertFails(getDocs(collection(db(alice), 'reports')));
    await assertFails(getDocs(collection(db(bob), 'reports')));
  });

  it('denies update and delete to everyone, including the reporter', async () => {
    const ref = await seedValidReport();
    await assertFails(updateDoc(ref, { details: 'never mind', createdAt: serverTimestamp() }));
    await assertFails(deleteDoc(ref));
    await assertFails(deleteDoc(doc(db(bob), 'reports/r1')));
  });
});
