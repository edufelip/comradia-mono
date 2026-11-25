// gamAudit is the only place the admin's actions live: every write callable appends one
// entry, and the publish/rollback request-approve pairs below are read back from it, so
// the two-person rule is enforced from data the server wrote, never from client state.
import { FieldValue, Timestamp, type DocumentReference, type Firestore } from 'firebase-admin/firestore';
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

const AUDIT_SCAN_LIMIT = 100;

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

/**
 * The newest audit entry that targets `target` (any action). The publish and rollback
 * approvals use it twice: the newest entry must be the request itself — any later edit
 * invalidates it — and the request's actor must differ from the approver.
 *
 * shortcut: scans the newest 100 gamAudit entries instead of a composite
 * (target ==, createdAt desc) index; fine while the log is in the hundreds — add the
 * index when it outgrows that.
 */
export async function latestAuditForTarget(
  firestore: Firestore,
  target: string,
): Promise<GamAuditEntryRead | null> {
  const snaps = await firestore.collection('gamAudit').orderBy('createdAt', 'desc').limit(AUDIT_SCAN_LIMIT).get();
  for (const snap of snaps.docs) {
    if (snap.get('target') !== target) continue;
    return readAuditEntry(snap.id, snap.data());
  }
  return null;
}
