// Rule-set admin handlers (spec §9 "Rule sets"): list, read, draft from the active
// version, edit with contract validation, and the two-person publish / rollback flow.
// The request-approve pair is enforced from gamAudit: `requestPublish` appends the
// request, and `approvePublish` only applies when the newest audit entry for that rule
// set is still the request and was written by a DIFFERENT admin. The client (apps/admin)
// only mirrors that state; it cannot bypass it.
import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import type { GamConfig, GamRuleSet } from '../model';
import { validateRuleSet } from '../ruleset';
import { AUDIT_ACTIONS, appendAudit, auditEntryFields, latestAuditForTarget, type GamAuditEntryRead } from './audit';
import { optionalString, reqInt, reqRecord, reqString } from './request';
import type { GamAdminActor } from './guard';

/** A gamAudit entry as the admin UI receives it: the timestamp as plain seconds. */
export type AuditEntryView = {
  id: string;
  actor: string;
  action: string;
  reason: string;
  target?: string;
  secondApprover?: string;
  createdAt: { seconds: number; nanoseconds: number } | null;
};

/** gamRuleSets/{id} reads re-validate the stored JSON, so a drifted document fails
 * loudly instead of flowing into a publish. */
function readRuleSetSnapshot(id: string, data: { [field: string]: unknown }): GamRuleSet {
  try {
    return validateRuleSet(data);
  } catch (error) {
    throw new HttpsError(
      'failed-precondition',
      `gamRuleSets/${id} fails contract validation: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
  }
}

async function readRuleSet(firestore: Firestore, id: string): Promise<GamRuleSet> {
  const snap = await firestore.doc(`gamRuleSets/${id}`).get();
  if (!snap.exists) {
    throw new HttpsError('not-found', `Rule set ${id} does not exist.`);
  }
  return readRuleSetSnapshot(id, snap.data() ?? {});
}

async function readActiveConfig(firestore: Firestore): Promise<GamConfig | null> {
  const snap = await firestore.doc('gamConfig/active').get();
  const data = snap.data();
  if (!snap.exists || !data || typeof data.ruleSetId !== 'string') return null;
  return {
    ruleSetId: data.ruleSetId,
    publishedAt: data.publishedAt,
    publishedBy: data.publishedBy,
  };
}

export type RuleSetSummary = {
  id: string;
  version: number;
  status: GamRuleSet['status'];
  parentVersion: number | null;
  author: string;
  notes: string;
  earnRuleCount: number;
};

export type ListRuleSetsResult = {
  ruleSets: RuleSetSummary[];
  active: GamConfig | null;
};

export async function listRuleSets(
  firestore: Firestore,
  actor: GamAdminActor,
  data: unknown,
): Promise<ListRuleSetsResult> {
  void actor; void data;
  const snaps = await firestore.collection('gamRuleSets').orderBy('version', 'desc').get();
  const ruleSets = snaps.docs.map((snap) => {
    const ruleSet = readRuleSetSnapshot(snap.id, snap.data());
    return {
      id: snap.id,
      version: ruleSet.version,
      status: ruleSet.status,
      parentVersion: ruleSet.parentVersion,
      author: ruleSet.author,
      notes: ruleSet.notes,
      earnRuleCount: ruleSet.earnRules.length,
    };
  });
  return { ruleSets, active: await readActiveConfig(firestore) };
}

export type GetRuleSetResult = {
  ruleSet: GamRuleSet;
  active: GamConfig | null;
};

export async function getRuleSet(
  firestore: Firestore,
  actor: GamAdminActor,
  data: unknown,
): Promise<GetRuleSetResult> {
  const id = reqString(reqRecord(data), 'ruleSetId');
  const ruleSet = await readRuleSet(firestore, id);
  return { ruleSet, active: await readActiveConfig(firestore) };
}

function validateDraftInput(input: unknown): GamRuleSet {
  try {
    return validateRuleSet(input);
  } catch (error) {
    throw new HttpsError(
      'invalid-argument',
      error instanceof Error ? error.message : 'The rule set is not valid.',
    );
  }
}

export async function createDraft(
  firestore: Firestore,
  actor: GamAdminActor,
  data: unknown,
): Promise<{ id: string; version: number }> {
  const request = reqRecord(data);
  const fromId = optionalString(request, 'fromRuleSetId');
  const notes = optionalString(request, 'notes', { min: 1, max: 1000 });
  let source: GamRuleSet;
  if (fromId !== undefined) {
    source = await readRuleSet(firestore, fromId);
  } else {
    const active = await readActiveConfig(firestore);
    if (!active) {
      throw new HttpsError(
        'failed-precondition',
        'There is no active rule set to draft from; pass fromRuleSetId.',
      );
    }
    source = await readRuleSet(firestore, active.ruleSetId);
  }
  const highest = await firestore.collection('gamRuleSets').orderBy('version', 'desc').limit(1).get();
  const nextVersion = (highest.docs.length === 0 ? 0 : readRuleSetSnapshot(highest.docs[0].id, highest.docs[0].data()).version) + 1;
  const id = `v${nextVersion}`;
  const draft: GamRuleSet = {
    ...source,
    version: nextVersion,
    status: 'draft',
    parentVersion: source.version,
    author: actor.uid,
    notes: notes ?? `Draft from v${source.version}`,
  };
  // create() (not set()) so two simultaneous draft requests can never share a version id.
  await firestore.doc(`gamRuleSets/${id}`).create(draft);
  await appendAudit(firestore, {
    actor: actor.uid,
    action: AUDIT_ACTIONS.draftCreate,
    reason: draft.notes,
    target: id,
  });
  return { id, version: nextVersion };
}

export async function updateDraft(
  firestore: Firestore,
  actor: GamAdminActor,
  data: unknown,
): Promise<{ ok: true }> {
  const request = reqRecord(data);
  const ruleSetId = reqString(request, 'ruleSetId');
  const validated = validateDraftInput(request.ruleSet);
  const reason = optionalString(request, 'reason', { min: 1, max: 500 }) ?? 'Draft edited.';
  const ref = firestore.doc(`gamRuleSets/${ruleSetId}`);
  await firestore.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', `Rule set ${ruleSetId} does not exist.`);
    const stored = readRuleSetSnapshot(ruleSetId, snap.data() ?? {});
    if (stored.status !== 'draft' && stored.status !== 'simulated') {
      throw new HttpsError(
        'failed-precondition',
        `Only a draft can be edited (v${stored.version} is ${stored.status}).`,
      );
    }
    if (validated.version !== stored.version) {
      throw new HttpsError(
        'failed-precondition',
        `Version drift: the stored draft is v${stored.version}; reload and edit that.`,
      );
    }
    tx.set(ref, {
      ...validated,
      // Identity fields stay server-owned: editing resets status (a simulation is stale
      // after an edit) and never reauthors the draft.
      status: 'draft',
      author: stored.author,
      parentVersion: stored.parentVersion,
    });
  });
  await appendAudit(firestore, {
    actor: actor.uid,
    action: AUDIT_ACTIONS.draftUpdate,
    reason,
    target: ruleSetId,
  });
  return { ok: true };
}

/** The two-person gate shared by publish and rollback approvals: the newest audit entry
 * for the target must still be the request (a later edit invalidates it), and its author
 * must be a different admin than the approver. */
async function readOpenRequest(
  firestore: Firestore,
  ruleSetId: string,
  requestedAction: string,
  approveAction: string,
  actor: GamAdminActor,
): Promise<GamAuditEntryRead> {
  const latest = await latestAuditForTarget(firestore, ruleSetId);
  if (!latest || latest.action !== requestedAction) {
    throw new HttpsError(
      'failed-precondition',
      `No open ${requestedAction} for ${ruleSetId}; request it first.`,
    );
  }
  if (latest.actor === actor.uid) {
    throw new HttpsError(
      'permission-denied',
      `A different admin must ${approveAction}: the requester cannot approve it.`,
    );
  }
  return latest;
}

export async function requestPublish(
  firestore: Firestore,
  actor: GamAdminActor,
  data: unknown,
): Promise<{ ok: true }> {
  const request = reqRecord(data);
  const ruleSetId = reqString(request, 'ruleSetId');
  const reason = reqString(request, 'reason', { min: 10, max: 500 });
  const ruleSet = await readRuleSet(firestore, ruleSetId);
  if (ruleSet.status !== 'draft' && ruleSet.status !== 'simulated') {
    throw new HttpsError(
      'failed-precondition',
      `Only a draft can be published (v${ruleSet.version} is ${ruleSet.status}).`,
    );
  }
  await appendAudit(firestore, {
    actor: actor.uid,
    action: AUDIT_ACTIONS.publishRequest,
    reason,
    target: ruleSetId,
  });
  return { ok: true };
}

export async function approvePublish(
  firestore: Firestore,
  actor: GamAdminActor,
  data: unknown,
): Promise<{ ok: true }> {
  const request = reqRecord(data);
  const ruleSetId = reqString(request, 'ruleSetId');
  const reason = reqString(request, 'reason', { min: 10, max: 500 });
  await readOpenRequest(firestore, ruleSetId, AUDIT_ACTIONS.publishRequest, 'approve the publish', actor);
  const ref = firestore.doc(`gamRuleSets/${ruleSetId}`);
  await firestore.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', `Rule set ${ruleSetId} does not exist.`);
    const stored = readRuleSetSnapshot(ruleSetId, snap.data() ?? {});
    if (stored.status !== 'draft' && stored.status !== 'simulated') {
      throw new HttpsError(
        'failed-precondition',
        `Only a draft can be published (v${stored.version} is ${stored.status}).`,
      );
    }
    const configRef = firestore.doc('gamConfig/active');
    const configSnap = await tx.get(configRef);
    const configData = configSnap.data();
    const previousId = configSnap.exists && configData !== undefined
      && typeof configData.ruleSetId === 'string' && configData.ruleSetId.length > 0
      ? configData.ruleSetId
      : null;
    if (previousId !== null && previousId !== ruleSetId) {
      const previousRef = firestore.doc(`gamRuleSets/${previousId}`);
      const previousSnap = await tx.get(previousRef);
      if (previousSnap.exists) {
        const previous = readRuleSetSnapshot(previousId, previousSnap.data() ?? {});
        tx.set(previousRef, { ...previous, status: 'archived' });
      }
    }
    tx.set(ref, { ...stored, status: 'published' });
    tx.set(configRef, {
      ruleSetId,
      publishedAt: FieldValue.serverTimestamp(),
      publishedBy: actor.uid,
    });
    tx.create(firestore.collection('gamAudit').doc(), auditEntryFields({
      actor: actor.uid,
      action: AUDIT_ACTIONS.publishApprove,
      reason,
      target: ruleSetId,
      secondApprover: actor.uid,
    }));
  });
  return { ok: true };
}

export async function requestRollback(
  firestore: Firestore,
  actor: GamAdminActor,
  data: unknown,
): Promise<{ ok: true }> {
  const request = reqRecord(data);
  const ruleSetId = reqString(request, 'ruleSetId');
  const reason = reqString(request, 'reason', { min: 10, max: 500 });
  const ruleSet = await readRuleSet(firestore, ruleSetId);
  if (ruleSet.status !== 'published' && ruleSet.status !== 'archived') {
    throw new HttpsError(
      'failed-precondition',
      `Rollback targets a published (or previously published) rule set (v${ruleSet.version} is ${ruleSet.status}).`,
    );
  }
  await appendAudit(firestore, {
    actor: actor.uid,
    action: AUDIT_ACTIONS.rollbackRequest,
    reason,
    target: ruleSetId,
  });
  return { ok: true };
}

export async function approveRollback(
  firestore: Firestore,
  actor: GamAdminActor,
  data: unknown,
): Promise<{ ok: true }> {
  const request = reqRecord(data);
  const ruleSetId = reqString(request, 'ruleSetId');
  const reason = reqString(request, 'reason', { min: 10, max: 500 });
  await readOpenRequest(firestore, ruleSetId, AUDIT_ACTIONS.rollbackRequest, 'approve the rollback', actor);
  const ref = firestore.doc(`gamRuleSets/${ruleSetId}`);
  await firestore.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', `Rule set ${ruleSetId} does not exist.`);
    const stored = readRuleSetSnapshot(ruleSetId, snap.data() ?? {});
    if (stored.status !== 'published' && stored.status !== 'archived') {
      throw new HttpsError(
        'failed-precondition',
        `Rollback targets a published (or previously published) rule set (v${stored.version} is ${stored.status}).`,
      );
    }
    const configRef = firestore.doc('gamConfig/active');
    const configSnap = await tx.get(configRef);
    const configData = configSnap.data();
    const outgoingId = configSnap.exists && configData !== undefined
      && typeof configData.ruleSetId === 'string' && configData.ruleSetId.length > 0
      && configData.ruleSetId !== ruleSetId
      ? configData.ruleSetId
      : null;
    if (outgoingId !== null) {
      const outgoingRef = firestore.doc(`gamRuleSets/${outgoingId}`);
      const outgoingSnap = await tx.get(outgoingRef);
      if (outgoingSnap.exists) {
        const outgoing = readRuleSetSnapshot(outgoingId, outgoingSnap.data() ?? {});
        tx.set(outgoingRef, { ...outgoing, status: 'archived' });
      }
    }
    // The rolled-back-to version becomes the live one again; the outgoing one archives.
    tx.set(ref, { ...stored, status: 'published' });
    tx.set(configRef, {
      ruleSetId,
      publishedAt: FieldValue.serverTimestamp(),
      publishedBy: actor.uid,
    });
    tx.create(firestore.collection('gamAudit').doc(), auditEntryFields({
      actor: actor.uid,
      action: AUDIT_ACTIONS.rollbackApprove,
      reason,
      target: ruleSetId,
      secondApprover: actor.uid,
    }));
  });
  return { ok: true };
}

export async function auditList(
  firestore: Firestore,
  actor: GamAdminActor,
  data: unknown,
): Promise<{ entries: AuditEntryView[] }> {
  void actor;
  const limit = data === undefined ? 50 : reqInt(reqRecord(data), 'limit', { min: 1, max: 200 });
  const snaps = await firestore.collection('gamAudit').orderBy('createdAt', 'desc').limit(limit).get();
  const entries: AuditEntryView[] = snaps.docs.map((snap) => {
    const value = snap.data();
    const target = value.target;
    const secondApprover = value.secondApprover;
    const createdAt = value.createdAt;
    return {
      id: snap.id,
      actor: typeof value.actor === 'string' ? value.actor : '',
      action: typeof value.action === 'string' ? value.action : '',
      reason: typeof value.reason === 'string' ? value.reason : '',
      ...(typeof target === 'string' ? { target } : {}),
      ...(typeof secondApprover === 'string' ? { secondApprover } : {}),
      ...(createdAt instanceof Timestamp
        ? { createdAt: { seconds: createdAt.seconds, nanoseconds: createdAt.nanoseconds } }
        : { createdAt: null }),
    };
  });
  return { entries };
}
