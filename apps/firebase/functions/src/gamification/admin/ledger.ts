// Ledger lookup and signed adjustments (spec §9 "Ledger lookup", §11 "Self-dealing by
// staff"). The ledger is append-only: a correction is a new signed `adjust` entry, never
// an edit. Server-enforced rules the admin UI only mirrors:
//   - an admin can never adjust their own uid;
//   - |amount| > 500 Cravos does not apply immediately: it waits as `pending` in
//     gamAdjustments until a DIFFERENT admin approves it.
import { createHash, randomUUID } from 'node:crypto';
import { FieldValue, Timestamp, type Firestore, type Transaction } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { GAM_LEDGER_KINDS, type GamAdjustmentDoc, type GamLedgerEntry, type GamLedgerKind, type GamProjection, type GamRuleSet } from '../model';
import { highWaterMark, levelFromRules } from '../level-for-lifetime';
import { FirestoreRuleSetLoader } from '../engine/ruleset-loader';
import { parseProjection } from '../engine/store';
import { auditEntryFields, AUDIT_ACTIONS } from './audit';
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
  levels: GamRuleSet['levels'];
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
    ruleSet: GamRuleSet;
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
    ruleSetVersion: input.ruleSet.version,
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
    levelId: levelFromRules(mark, parseProjection(data).levelId, input.ruleSet.levels),
    levels: input.ruleSet.levels,
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (input.amount > 0) {
    const earnedAt = Timestamp.now();
    const sourceLedgerId = `adjust:${input.adjustmentId}`;
    tx.create(projectionRef.collection('lots').doc(sourceLedgerId), {
      amount: input.amount, earnedAt,
      expiresAt: Timestamp.fromMillis(earnedAt.toMillis() + 365 * 86_400_000),
      sourceLedgerId,
    });
  }
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
  const idempotencyKey = request.idempotencyKey === undefined
    ? randomUUID() : reqString(request, 'idempotencyKey', { min: 1, max: 128 });
  const adjustmentId = createHash('sha256').update(`${actor.uid}:${idempotencyKey}`).digest('hex');
  const ref = firestore.doc(`gamAdjustments/${adjustmentId}`);
  const immediate = Math.abs(amount) <= ADJUSTMENT_SECOND_APPROVER_THRESHOLD;
  const ruleSet = immediate ? await new FirestoreRuleSetLoader(firestore).loadActive() : null;
  return firestore.runTransaction(async (tx) => {
    const previous = await tx.get(ref);
    if (previous.exists) {
      if (previous.get('uid') !== uid || previous.get('amount') !== amount || previous.get('reason') !== reason) {
        throw new HttpsError('invalid-argument', 'The key belongs to a different adjustment.');
      }
      return { adjustmentId, status: previous.get('status') === 'applied' ? 'applied' : 'pending' };
    }
    if (ruleSet !== null) {
      await applyAdjustment(firestore, tx, actor, { uid, amount, reason, adjustmentId, ruleSet });
    }
    const status = immediate ? 'applied' : 'pending';
    const adjustment: GamAdjustmentWrite = {
      uid, amount, reason, raisedBy: actor.uid, status, createdAt: FieldValue.serverTimestamp(),
    };
    tx.create(ref, adjustment);
    tx.create(firestore.collection('gamAudit').doc(), auditEntryFields({
      actor: actor.uid,
      action: immediate ? AUDIT_ACTIONS.adjustmentAppend : AUDIT_ACTIONS.adjustmentRequest,
      reason, target: uid,
    }));
    return { adjustmentId, status };
  });
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
  const ruleSet = await new FirestoreRuleSetLoader(firestore).loadActive();
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
    if (value.uid === actor.uid) throw new HttpsError('permission-denied', 'An admin cannot adjust their own balance.');
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
      ruleSet,
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
