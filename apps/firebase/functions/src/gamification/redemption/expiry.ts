import { FieldValue, type DocumentReference, type Timestamp } from 'firebase-admin/firestore';
import { readLot } from './redeem';
// Lot expiry helpers for the weekly gamification job (docs/gamification/README.md §10
// money rules: lots expire 12 months after earning; notice 30 days before). Pure
// functions only: the job owns the schedule and the Firestore writes.

import type { GamLot, GamTimestamp } from '../model';

export const EXPIRY_NOTICE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Lots whose Cravos are past expiry and still await their `expire` ledger entry,
 *  oldest first so the job can process them in a deterministic order. Zero-amount
 *  tombstones (lots fully spent by redemption) never expire again. */
export function lotsToExpire(lots: GamLot[], now: GamTimestamp): GamLot[] {
  return lots
    .filter((lot) => lot.amount > 0 && lot.expiresAt.toMillis() <= now.toMillis())
    .sort((a, b) => a.expiresAt.toMillis() - b.expiresAt.toMillis());
}

/** Lots that still hold Cravos, have not been noticed yet, and reach their expiry within
 *  the 30-day notice window (but have not expired yet). A lot that expired between two
 *  job runs belongs to `lotsToExpire`, not to a notice. */
export function expiryNoticeDue(lots: GamLot[], now: GamTimestamp): GamLot[] {
  const nowMs = now.toMillis();
  return lots.filter((lot) => {
    if (lot.amount <= 0 || lot.noticeAt != null) return false;
    const remainingMs = lot.expiresAt.toMillis() - nowMs;
    return remainingMs > 0 && remainingMs <= EXPIRY_NOTICE_DAYS * DAY_MS;
  });
}

/** Settles one real lot. The transaction lets a racing redemption consume its share first. */
export async function settleLotExpiry(ref: DocumentReference, now: Timestamp): Promise<void> {
  const wallet = ref.parent.parent;
  if (wallet?.parent.id !== 'gamification') return;

  await ref.firestore.runTransaction(async (tx) => {
    const expireEntry = wallet.collection('ledger').doc(`expire:${ref.id}`);
    const notice = wallet.collection('celebrations').doc(`expiry:${ref.id}`);
    const [snapshot, member, existing] = await tx.getAll(ref, wallet, expireEntry);
    if (!snapshot.exists || !member.exists || existing.exists) return;
    const lot = readLot(snapshot);
    if (lot.amount === 0) return;

    if (lotsToExpire([lot], now).length > 0) {
      tx.create(expireEntry, {
        track: 'cravos',
        kind: 'expire',
        amount: -lot.amount,
        ruleId: 'lot_expiry',
        ruleSetVersion: 0,
        source: { event: 'lot.expired', path: ref.path, eventId: ref.id },
        actor: 'system',
        createdAt: FieldValue.serverTimestamp(),
      });
      tx.update(ref, { amount: 0 });
      tx.update(wallet, { balance: FieldValue.increment(-lot.amount), updatedAt: FieldValue.serverTimestamp() });
    } else if (expiryNoticeDue([lot], now).length > 0) {
      tx.create(notice, {
        kind: 'toast', copyKey: 'gam.toast.expiring', amount: lot.amount,
        createdAt: FieldValue.serverTimestamp(), seenAt: null,
      });
      tx.update(ref, { noticeAt: FieldValue.serverTimestamp() });
    }
  });
}
