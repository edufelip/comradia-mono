import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, it, mock } from 'node:test';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { cleanupDeletedMatch } from '../src/match-cleanup.js';

if (!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? '')) {
  throw new Error('Cleanup tests require a local Firestore emulator');
}
const app = initializeApp({ projectId: 'demo-comradia' }, `cleanup-${randomUUID()}`);
const db = getFirestore(app);
after(() => deleteApp(app));

async function fixture(count = 2) {
  const seed = randomUUID().replaceAll('-', '');
  const users = [`a${seed}`, `b${seed}`];
  const id = users.join('_');
  const parent = db.doc(`matches/${id}`);
  await parent.set({ users });
  let batch = db.batch();
  for (let i = 0; i < count; i++) {
    batch.set(parent.collection('messages').doc(String(i).padStart(4, '0')), {
      from: users[i % 2], text: 'private fixture',
    });
    if ((i + 1) % 450 === 0) { await batch.commit(); batch = db.batch(); }
  }
  await batch.commit();
  await parent.delete();
  return { users, id, parent };
}

it('cleans both authors from an already deleted match and is duplicate-safe', async () => {
  const { users, id, parent } = await fixture();
  assert.equal(await cleanupDeletedMatch(db, id, users), 2);
  assert.equal((await parent.collection('messages').get()).size, 0);
  assert.equal((await parent.get()).exists, false);
  assert.equal(await cleanupDeletedMatch(db, id, users), 0);
});

it('paginates more than one transaction batch', async () => {
  const { users, id, parent } = await fixture(205);
  assert.equal(await cleanupDeletedMatch(db, id, users), 205);
  assert.equal((await parent.collection('messages').get()).size, 0);
});

it('does not delete a recreated match or its new messages on a stale event', async () => {
  const { users, id, parent } = await fixture();
  await parent.set({ users, generation: 'new' });
  await parent.collection('messages').doc('new').set({ from: users[0], text: 'new conversation' });
  assert.equal(await cleanupDeletedMatch(db, id, users), 0);
  assert.equal((await parent.get()).get('generation'), 'new');
  assert.equal((await parent.collection('messages').get()).size, 3);
});

it('resumes after a page committed before a transient failure', async () => {
  const { users, id, parent } = await fixture(205);
  const original = db.runTransaction.bind(db);
  let calls = 0;
  const interception = mock.method(db, 'runTransaction', async (...args: Parameters<typeof db.runTransaction>) => {
    calls++;
    if (calls === 2) throw new Error('fixture interruption');
    return original(...args);
  });
  try {
    await assert.rejects(cleanupDeletedMatch(db, id, users), /fixture interruption/);
  } finally {
    interception.mock.restore();
  }
  assert.equal((await parent.collection('messages').get()).size, 105);
  assert.equal(await cleanupDeletedMatch(db, id, users), 105);
});

it('rejects malformed event membership and paths without deleting anything', async () => {
  const { users, id, parent } = await fixture();
  for (const invalid of [null, [], users.slice(0, 1), [users[1], users[0]], ['x', 'y']]) {
    assert.equal(await cleanupDeletedMatch(db, id, invalid), 0);
  }
  assert.equal(await cleanupDeletedMatch(db, `${id}/messages`, users), 0);
  assert.equal((await parent.collection('messages').get()).size, 2);
});

it('bounds each attempt and continues remaining pages on retry', async () => {
  const { users, id, parent } = await fixture(2005);
  await assert.rejects(cleanupDeletedMatch(db, id, users), /page budget reached/);
  assert.equal((await parent.collection('messages').get()).size, 5);
  assert.equal(await cleanupDeletedMatch(db, id, users), 5);
});

it('preserves a new message committed atomically with a racing match recreation', async () => {
  const { users, id, parent } = await fixture(205);
  const batch = db.batch();
  batch.set(parent, { users, generation: 'racing' });
  batch.set(parent.collection('messages').doc('new'), { from: users[0], text: 'new history' });
  await Promise.all([cleanupDeletedMatch(db, id, users), batch.commit()]);
  assert.equal((await parent.get()).get('generation'), 'racing');
  assert.equal((await parent.collection('messages').doc('new').get()).get('text'), 'new history');
});
