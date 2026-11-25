// gamAudit is the only place the admin's actions live: every write callable appends one
// entry, and the publish/rollback request-approve pairs below are read back from it, so
// the two-person rule is enforced from data the server wrote, never from client state.
import { FieldValue, Timestamp, type DocumentReference, type Firestore, type Transaction } from 'firebase-admin/firestore';
import type { GamAuditEntry } from '../model';

export const AUDIT_ACTIONS = {
  draftCreate: 'gam.ruleset.create',
  draftUpdate: 'gam.ruleset.update',
  publishRequest: 'gam.publish.request',
  publishApprove: 'gam.publish.approve',
  rollbackRequest: 'gam.rollback.request',
  rollbackApprove: 'gam.rollback.approve',
  simulate: 'gam.simulate',
  adjustmentAppend: 'gam.adjustment.append',
  adjustmentRequest: 'gam.adjustment.request',
  adjustmentApprove: 'gam.adjustment.approve',
} as const;

export type GamAuditEntryRead = Omit<GamAuditEntry, 'createdAt'> & { createdAt: Timestamp };

export function auditEntryFields(entry: Omit<GamAuditEntry, 'createdAt'>): Record<string, unknown> {
  return {
    actor: entry.actor,
    action: entry.action,
    reason: entry.reason,
    ...(entry.target !== undefined ? { target: entry.target } : {}),
    ...(entry.secondApprover !== undefined ? { secondApprover: entry.secondApprover } : {}),
    createdAt: FieldValue.serverTimestamp(),
  };
}

export function appendAudit(
  firestore: Firestore,
  entry: Omit<GamAuditEntry, 'createdAt'>,
): Promise<DocumentReference> {
  return firestore.collection('gamAudit').add(auditEntryFields(entry));
}

function readAuditEntry(id: string, data: { [field: string]: unknown }): GamAuditEntryRead {
  if (typeof data.actor !== 'string' || typeof data.action !== 'string'
    || typeof data.reason !== 'string' || !(data.createdAt instanceof Timestamp)) {
    throw new Error(`gamAudit/${id} is not a valid audit entry`);
  }
  const target = data.target;
  const secondApprover = data.secondApprover;
  return {
    actor: data.actor,
    action: data.action,
    reason: data.reason,
    ...(typeof target === 'string' ? { target } : {}),
    ...(typeof secondApprover === 'string' ? { secondApprover } : {}),
    createdAt: data.createdAt,
  };
}

/** Read the approval request within the same transaction that moves the active pointer. */
export async function latestAuditForTarget(
  firestore: Firestore, target: string, tx: Transaction,
): Promise<GamAuditEntryRead | null> {
  const { docs } = await tx.get(firestore.collection('gamAudit')
    .where('target', '==', target).orderBy('createdAt', 'desc').limit(1));
  const latest = docs[0];
  return latest === undefined ? null : readAuditEntry(latest.id, latest.data());
}
