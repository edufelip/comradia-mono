import { after, before, beforeEach, describe, it } from 'node:test';
import {
  assertFails,
  assertSucceeds,
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

const reportRef = (id = 'alice_bob') => doc(db(alice), `reports/${id}`);

function submitReport(data: Record<string, unknown> = report()) {
  return setDoc(doc(db(alice), `reports/alice_${String(data.target)}`), data);
}

/** A report the rules let through, so the read/update/delete tests start from real data. */
async function seedValidReport(id = 'alice_bob') {
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(db(context), `reports/${id}`), report());
  });
  return reportRef(id);
}

describe('reports create', () => {
  it('allows a complete report of another person', async () => {
    await assertSucceeds(submitReport());
  });

  it('allows the boundary lengths: empty details, 500 characters, a 128-character target', async () => {
    await assertSucceeds(
      submitReport(report({ details: '', target: 'a'.repeat(128), reason: 'other' })),
    );
    await assertSucceeds(submitReport(report({ details: 'a'.repeat(500), target: 'carol' })));
  });

  it('allows every reason and both contexts', async () => {
    for (const [index, reason] of ['harassment', 'hate', 'fake', 'spam', 'underage', 'other'].entries()) {
      await assertSucceeds(submitReport(report({ reason, target: `target-${index}` })));
    }
    await assertSucceeds(submitReport(report({ context: 'profile', target: 'profile-target' })));
    await assertSucceeds(submitReport(report({ context: 'chat', target: 'chat-target' })));
  });

  it('denies a report filed as somebody else', async () => {
    await assertFails(submitReport(report({ reporter: 'bob' })));
    await assertFails(setDoc(doc(db(bob), 'reports/bob_alice'), report({ reporter: 'bob' })));
  });

  it('denies reporting yourself', async () => {
    await assertFails(submitReport(report({ target: 'alice' })));
  });

  it('denies a target that is empty, too long or not a string', async () => {
    await assertFails(submitReport(report({ target: '' })));
    await assertFails(submitReport(report({ target: 'a'.repeat(129) })));
    await assertFails(submitReport(report({ target: 42 })));
  });

  it('denies a reason outside the list', async () => {
    await assertFails(submitReport(report({ reason: 'blocked' })));
    await assertFails(submitReport(report({ reason: 'HARASSMENT' })));
  });

  it('denies details over 500 characters and a non-string', async () => {
    await assertFails(submitReport(report({ details: 'a'.repeat(501) })));
    await assertFails(submitReport(report({ details: 42 })));
  });

  it('denies a context outside the list', async () => {
    await assertFails(submitReport(report({ context: 'email' })));
  });

  it('denies an extra or missing key', async () => {
    await assertFails(submitReport(report({ status: 'open' })));
    await assertFails(submitReport(report({ reportId: 'r1' })));
    for (const key of ['reporter', 'target', 'reason', 'details', 'context', 'createdAt']) {
      await assertFails(submitReport(without(report(), key)));
    }
  });

  it('denies a client timestamp instead of request.time', async () => {
    await assertFails(
      submitReport(report({ createdAt: Timestamp.fromDate(new Date('2020-01-01')) })),
    );
  });

  it('denies a report id that is not reporter_target and prevents a duplicate report', async () => {
    await assertFails(setDoc(doc(db(alice), 'reports/random-id'), report()));
    await assertSucceeds(submitReport());
    await assertFails(submitReport());
  });

  it('denies a signed-out create', async () => {
    await assertFails(setDoc(doc(db(signedOut), 'reports/alice_bob'), report()));
  });
});

describe('reports read, update and delete', () => {
  it('allows only the reporter to get their own report and denies list', async () => {
    const ref = await seedValidReport();
    await assertSucceeds(getDoc(ref));
    await assertFails(getDoc(doc(db(bob), 'reports/alice_bob')));
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
