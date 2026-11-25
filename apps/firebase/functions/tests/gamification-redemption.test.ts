import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, it, mock } from 'node:test';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { redeemItem, RedeemError } from '../src/gamification/redemption/redeem.js';

if (!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? '')) {
  throw new Error('Redemption tests require a local Firestore emulator');
}

const app = initializeApp({ projectId: 'demo-comradia' }, 'redemption-test');
const db = getFirestore(app);
after(() => deleteApp(app));

async function fixture({ stock = 1, code = true, expired = false } = {}) {
  const uid = `member-${randomUUID()}`;
  const itemId = `item-${randomUUID()}`;
  const now = Timestamp.fromDate(new Date('2026-11-25T12:00:00Z'));
  const at = (iso: string) => Timestamp.fromDate(new Date(iso));
  const wallet = db.doc(`gamification/${uid}`);
  const item = db.doc(`catalog/${itemId}`);
  const batch = db.batch()
    .set(db.doc(`users/${uid}`), { createdAt: at('2026-08-01') })
    .set(wallet, { balance: 100, lifetimeNet: 300, levelId: 'flor' })
    .set(item, { title: 'Partner item', description: 'Fixture reward', priceCravos: 70,
      kind: 'partner_funded', partner: 'Fixture', stock, active: true })
    .set(wallet.collection('lots').doc('old'), { amount: 50, sourceLedgerId: 'old',
      earnedAt: at('2026-08-01'), expiresAt: at(expired ? '2026-11-24' : '2027-08-01') })
    .set(wallet.collection('lots').doc('new'), { amount: 50, sourceLedgerId: 'new',
      earnedAt: at('2026-08-02'), expiresAt: at('2027-08-02') });
  if (code) batch.set(db.doc(`catalogCodes/${itemId}/codes/VOUCHER`), { assignedTo: null });
  await batch.commit();
  const deps = { firestore: db, now: () => now, isRedemptionEnabled: async () => true };
  const data = { itemId, idempotencyKey: 'first-purchase' };
  return { uid, item, wallet, deps, data };
}

it('rejects expired lots even when the projection still shows enough Cravos', async () => {
  const { uid, data, deps, wallet } = await fixture({ expired: true });
  await assert.rejects(redeemItem(uid, data, deps), (error) =>
    error instanceof RedeemError && error.reason === 'insufficient_balance');
  assert.equal((await wallet.get()).get('balance'), 100);
});

it('spends FIFO and returns one claim for concurrent retries', async () => {
  const { uid, data, deps, wallet, item } = await fixture();
  const [first, second] = await Promise.all([redeemItem(uid, data, deps), redeemItem(uid, data, deps)]);
  assert.equal(first.redemptionId, second.redemptionId);
  assert.equal(first.code, 'VOUCHER');
  assert.equal(second.code, first.code);
  const projection = await wallet.get();
  assert.equal(projection.get('balance'), 30);
  assert.equal(projection.get('lifetimeNet'), 300);
  assert.equal((await wallet.collection('lots').doc('old').get()).get('amount'), 0);
  assert.equal((await wallet.collection('lots').doc('new').get()).get('amount'), 30);
  assert.equal((await wallet.collection('ledger').get()).size, 2);
  assert.equal((await item.get()).get('stock'), 0);
});

it('refunds lot balances and stock once when fulfillment fails', async () => {
  const { uid, data, deps, wallet, item } = await fixture({ code: false });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await assert.rejects(redeemItem(uid, data, deps), (error) =>
      error instanceof RedeemError && error.reason === 'out_of_stock');
  }
  assert.equal((await wallet.get()).get('balance'), 100);
  assert.equal((await item.get()).get('stock'), 1);
  assert.equal((await wallet.collection('ledger').where('kind', '==', 'refund').get()).size, 2);
});

it('settles an expired lot once while preserving lifetime earnings', async () => {
  const { settleLotExpiry } = await import('../src/gamification/redemption/expiry.js');
  const { wallet, deps } = await fixture({ expired: true });
  const lot = wallet.collection('lots').doc('old');
  await settleLotExpiry(lot, deps.now());
  await settleLotExpiry(lot, deps.now());
  assert.equal((await wallet.get()).get('balance'), 50);
  assert.equal((await wallet.get()).get('lifetimeNet'), 300);
  assert.equal((await lot.get()).get('amount'), 0);
  assert.equal((await wallet.collection('ledger').doc('expire:old').get()).get('amount'), -50);
});

it('resumes an existing pending claim when new redemptions have been disabled', async () => {
  const { uid, data, deps, wallet } = await fixture();
  const run = db.runTransaction.bind(db);
  let calls = 0;
  const interception = mock.method(db, 'runTransaction', async (...args: Parameters<typeof db.runTransaction>) => {
    calls += 1;
    if (calls === 2) throw new Error('interrupted before fulfillment');
    return run(...args);
  });
  try {
    await assert.rejects(redeemItem(uid, data, deps), /interrupted before fulfillment/);
  } finally {
    interception.mock.restore();
  }
  const off = { ...deps, isRedemptionEnabled: async () => false };
  assert.equal((await redeemItem(uid, data, off)).code, 'VOUCHER');
  assert.equal((await wallet.get()).get('balance'), 30);
  await assert.rejects(redeemItem(uid, { ...data, idempotencyKey: 'new-key' }, off), (error) =>
    error instanceof RedeemError && error.reason === 'disabled');
});
