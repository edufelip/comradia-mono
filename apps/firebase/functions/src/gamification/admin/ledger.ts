// Ledger lookup and signed adjustments (spec §9 "Ledger lookup", §11 "Self-dealing by
// staff"). The ledger is append-only: a correction is a new signed `adjust` entry, never
// an edit. Server-enforced rules the admin UI only mirrors:
//   - an admin can never adjust their own uid;
//   - |amount| > 500 Cravos does not apply immediately: it waits as `pending` in
//     gamAdjustments until a DIFFERENT admin approves it.
import { createHash, randomUUID } from 'node:crypto';
import { FieldValue, Timestamp, type Firestore, type Transaction } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { GAM_LEDGER_KINDS, type GamAdjustmentDoc, type GamLedgerEntry, type GamLedgerKind, type GamProjection } from '../model';
import { highWaterMark, levelForHighWaterMark } from '../level-for-lifetime';
import { appendAudit, AUDIT_ACTIONS } from './audit';
import { isRecord, reqInt, reqRecord, reqString } from './request';
import type { GamAdminActor } from './guard';

/** Above this signed amount an adjustment needs a second approver (spec §9). */
export const ADJUSTMENT_SECOND_APPROVER_THRESHOLD = 500;
/** Spec §9: "Reason (required, 10+ characters)". */
export const MIN_ADJUSTMENT_REASON_LENGTH = 10;
const MAX_ADJUSTMENT_ABS = 100_000;
const ADJUSTMENT_RULE_ID = 'admin_adjustment';
const LEDGER_PAGE = 50;

/** An entry as it is written, before the server resolves `createdAt`. */
type GamLedgerEntryWrite = Omit<GamLedgerEntry, 'createdAt'> & { createdAt: FieldValue };
/** An adjustment doc as it is written, before the server resolves `createdAt`. */
type GamAdjustmentWrite = Omit<GamAdjustmentDoc, 'createdAt'> & { createdAt: FieldValue };
/** Projection fields an adjustment may fold; `streak` and `quest` are engine-owned. */
type GamProjectionAdjustUpdate = {
  balance: number;
  lifetimeNet: number;
  levelHighWaterMark: number;
  levelId: string;
  updatedAt: FieldValue;
};

/** Pseudonymized id for screens and screenshots (spec §9's `demo-7f3a` shape). */
export function memberDisplayId(uid: string): string {
  return `demo-${createHash('sha256').update(uid).digest('hex').slice(0, 4)}`;
}

async function readActiveRuleSetVersion(firestore: Firestore): Promise<number> {
  const snap = await firestore.doc('gamConfig/active').get();
  const data = snap.data();
  if (!snap.exists || typeof data?.ruleSetId !== 'string') return 0;
  const ruleSetSnap = await firestore.doc(`gamRuleSets/${data.ruleSetId}`).get();
  const version = ruleSetSnap.get('version');
  return typeof version === 'number' && Number.isInteger(version) ? version : 0;
}

export type LedgerEntryView = Omit<GamLedgerEntry, 'createdAt'> & {
  id: string;
  createdAt: Timestamp;
};

export type AdjustmentView = Omit<GamAdjustmentDoc, 'createdAt'> & {
  id: string;
  createdAt: Timestamp;
};

export type LedgerLookupResult = {
  uid: string;
  displayId: string;
  projection: { balance: number; lifetimeNet: number; levelId: string } | null;
  entries: LedgerEntryView[];
  adjustments: AdjustmentView[];
};

export async function ledgerLookup(
  firestore: Firestore,
  actor: GamAdminActor,
  data: unknown,
): Promise<LedgerLookupResult> {
  const uid = reqString(reqRecord(data), 'uid', { min: 1, max: 128 });
  void actor;
  const projectionSnap = await firestore.doc(`gamification/${uid}`).get();
  const projectionData = projectionSnap.data();
  let projection: LedgerLookupResult['projection'] = null;
  if (projectionSnap.exists && projectionData !== undefined) {
    const { balance, lifetimeNet, levelId } = projectionData;
    if (typeof balance !== 'number' || typeof lifetimeNet !== 'number' || typeof levelId !== 'string') {
      throw new HttpsError('failed-precondition', `gamification/${uid} is not a valid projection.`);
    }
    projection = { balance, lifetimeNet, levelId };
  }
const entrySnaps = await firestore
  .collection(`gamification/${uid}/ledger`)
  .orderBy('createdAt', 'desc')
  .limit(LEDGER_PAGE)
  .get();
  const entries: LedgerEntryView[] = entrySnaps.docs.map((snap) => {
    const value = snap.data();
    const kind = GAM_LEDGER_KINDS.find((candidate) => candidate === value.kind);
    const actor = value.actor === 'admin' || value.actor === 'system' ? value.actor : undefined;
    const source = isRecord(value.source) ? value.source : undefined;
    if (value.track !== 'cravos' || kind === undefined || actor === undefined
      || typeof value.amount !== 'number' || typeof value.ruleId !== 'string'
      || typeof value.ruleSetVersion !== 'number' || typeof source?.event !== 'string'
      || typeof source.path !== 'string' || typeof source.eventId !== 'string'
      || !(value.createdAt instanceof Timestamp)) {
      throw new HttpsError('internal', `gamification/${uid}/ledger/${snap.id} is not a valid ledger entry.`);
    }
    const ledgerKind: GamLedgerKind = kind;
    const lot = value.lot;
    return {
      id: snap.id,
      track: 'cravos',
      kind: ledgerKind,
      amount: value.amount,
      ruleId: value.ruleId,
      ruleSetVersion: value.ruleSetVersion,
      source: { event: source.event, path: source.path, eventId: source.eventId },
      ...(isRecord(lot) && lot.expiresAt instanceof Timestamp ? { lot: { expiresAt: lot.expiresAt } } : {}),
      actor,
      ...(typeof value.actorUid === 'string' ? { actorUid: value.actorUid } : {}),
      ...(typeof value.reason === 'string' ? { reason: value.reason } : {}),
      createdAt: value.createdAt,
    };
  });
  const adjustmentSnaps = await firestore.collection('gamAdjustments').where('uid', '==', uid).limit(50).get();
  const adjustments: AdjustmentView[] = [];
  for (const snap of adjustmentSnaps.docs) {
    const value = snap.data();
    const status = (['pending', 'applied', 'rejected'] as const).find((candidate) => candidate === value.status);
    if (typeof value.amount !== 'number' || typeof value.reason !== 'string'
      || typeof value.raisedBy !== 'string' || status === undefined
      || !(value.createdAt instanceof Timestamp)) {
      throw new HttpsError('internal', `gamAdjustments/${snap.id} is not a valid adjustment.`);
    }
    adjustments.push({
      id: snap.id,
      uid,
      amount: value.amount,
      reason: value.reason,
      raisedBy: value.raisedBy,
      ...(typeof value.secondApproverUid === 'string' ? { secondApproverUid: value.secondApproverUid } : {}),
      status,
      createdAt: value.createdAt,
    });
  }
  adjustments.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
  return { uid, displayId: memberDisplayId(uid), projection, entries, adjustments };
}

/** Writes the signed adjust entry and folds it into the projection, inside the caller's
 * transaction. The level comes from the high-water mark, so it never drops. */
async function applyAdjustment(
  firestore: Firestore,
  tx: Transaction,
  actor: GamAdminActor,
  input: {
    uid: string;
    amount: number;
    reason: string;
    adjustmentId: string;
    ruleSetVersion: number;
  },
): Promise<void> {
  const projectionRef = firestore.doc(`gamification/${input.uid}`);
  const projectionSnap = await tx.get(projectionRef);
  const data = projectionSnap.data();
  if (!projectionSnap.exists || data === undefined) {
    throw new HttpsError(
      'failed-precondition',
      `gamification/${input.uid} does not exist; adjustments need a projection to fold into.`,
    );
  }
  const { balance, lifetimeNet, levelHighWaterMark } = data;
  if (typeof balance !== 'number' || typeof lifetimeNet !== 'number'
    || typeof levelHighWaterMark !== 'number') {
    throw new HttpsError('failed-precondition', `gamification/${input.uid} is not a valid projection.`);
  }
  const entry: GamLedgerEntryWrite = {
    track: 'cravos',
    kind: 'adjust',
    amount: input.amount,
    ruleId: ADJUSTMENT_RULE_ID,
    ruleSetVersion: input.ruleSetVersion,
    source: { event: 'admin.adjust', path: `gamification/${input.uid}`, eventId: input.adjustmentId },
    actor: 'admin',
    actorUid: actor.uid,
    reason: input.reason,
    createdAt: FieldValue.serverTimestamp(),
  };
  // create() (not set()) keeps the append-only ledger safe against a retried id.
  tx.create(firestore.doc(`gamification/${input.uid}/ledger/adjust:${input.adjustmentId}`), entry);
  const newLifetimeNet = lifetimeNet + input.amount;
  const mark = highWaterMark(levelHighWaterMark, newLifetimeNet);
  const projectionUpdate: GamProjectionAdjustUpdate = {
    balance: balance + input.amount,
    lifetimeNet: newLifetimeNet,
    levelHighWaterMark: mark,
    levelId: levelForHighWaterMark(mark),
    updatedAt: FieldValue.serverTimestamp(),
  };
  tx.update(projectionRef, projectionUpdate);
}

export async function adjustmentAppend(
  firestore: Firestore,
  actor: GamAdminActor,
  data: unknown,
): Promise<{ adjustmentId: string; status: 'applied' | 'pending' }> {
  const request = reqRecord(data);
  const uid = reqString(request, 'uid', { min: 1, max: 128 });
  const amount = reqInt(request, 'amount', { min: -MAX_ADJUSTMENT_ABS, max: MAX_ADJUSTMENT_ABS, nonzero: true });
  const reason = reqString(request, 'reason', { min: MIN_ADJUSTMENT_REASON_LENGTH, max: 500 });
  if (actor.uid === uid) {
    throw new HttpsError('permission-denied', 'An admin cannot adjust their own balance.');
  }
  const adjustmentId = randomUUID();
  if (Math.abs(amount) <= ADJUSTMENT_SECOND_APPROVER_THRESHOLD) {
    const ruleSetVersion = await readActiveRuleSetVersion(firestore);
    await firestore.runTransaction((tx) =>
      applyAdjustment(firestore, tx, actor, { uid, amount, reason, adjustmentId, ruleSetVersion }));
    const applied: GamAdjustmentWrite = {
      uid,
      amount,
      reason,
      raisedBy: actor.uid,
      status: 'applied',
      createdAt: FieldValue.serverTimestamp(),
    };
    await firestore.doc(`gamAdjustments/${adjustmentId}`).create(applied);
    await appendAudit(firestore, {
      actor: actor.uid,
      action: AUDIT_ACTIONS.adjustmentAppend,
      reason,
      target: uid,
    });
    return { adjustmentId, status: 'applied' };
  }
  const pending: GamAdjustmentWrite = {
    uid,
    amount,
    reason,
    raisedBy: actor.uid,
    status: 'pending',
    createdAt: FieldValue.serverTimestamp(),
  };
  await firestore.doc(`gamAdjustments/${adjustmentId}`).create(pending);
  await appendAudit(firestore, {
    actor: actor.uid,
    action: AUDIT_ACTIONS.adjustmentRequest,
    reason,
    target: uid,
  });
  return { adjustmentId, status: 'pending' };
}

export async function adjustmentApprove(
  firestore: Firestore,
  actor: GamAdminActor,
  data: unknown,
): Promise<{ adjustmentId: string; status: 'applied' }> {
  const request = reqRecord(data);
  const adjustmentId = reqString(request, 'adjustmentId');
  const reason = reqString(request, 'reason', { min: MIN_ADJUSTMENT_REASON_LENGTH, max: 500 });
  const ref = firestore.doc(`gamAdjustments/${adjustmentId}`);
  const ruleSetVersion = await readActiveRuleSetVersion(firestore);
  await firestore.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const value = snap.data();
    if (!snap.exists || value === undefined) {
      throw new HttpsError('not-found', `Adjustment ${adjustmentId} does not exist.`);
    }
    if (typeof value.uid !== 'string' || typeof value.amount !== 'number'
      || typeof value.reason !== 'string' || typeof value.raisedBy !== 'string'
      || typeof value.status !== 'string') {
      throw new HttpsError('internal', `gamAdjustments/${adjustmentId} is not a valid adjustment.`);
    }
    if (value.status !== 'pending') {
      throw new HttpsError('failed-precondition', `Adjustment ${adjustmentId} is ${value.status}, not pending.`);
    }
    if (value.raisedBy === actor.uid) {
      throw new HttpsError(
        'permission-denied',
        'A different admin must approve an adjustment over 500 Cravos.',
      );
    }
    await applyAdjustment(firestore, tx, actor, {
      uid: value.uid,
      amount: value.amount,
      reason: `${value.reason} — approved: ${reason}`,
      adjustmentId,
      ruleSetVersion,
    });
    tx.update(ref, { status: 'applied', secondApproverUid: actor.uid });
    tx.create(firestore.collection('gamAudit').doc(), {
      actor: actor.uid,
      action: AUDIT_ACTIONS.adjustmentApprove,
      reason: `${value.reason} — approved: ${reason}`,
      target: value.uid,
      secondApprover: actor.uid,
      createdAt: FieldValue.serverTimestamp(),
    });
  });
  return { adjustmentId, status: 'applied' };
}
