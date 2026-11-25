import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore, type Firestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { fileURLToPath } from 'node:url';
import { loadRuleSet } from '../src/gamification/ruleset.js';
import type { GamRuleSet } from '../src/gamification/model.js';
import {
  approvePublish,
  approveRollback,
  auditList,
  createDraft,
  getRuleSet,
  listRuleSets,
  requestPublish,
  requestRollback,
  updateDraft,
} from '../src/gamification/admin/rulesets.js';

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
if (!emulatorHost || !['127.0.0.1', 'localhost', '::1'].includes(emulatorHost.split(':')[0] ?? '')) {
  throw new Error('Functions integration tests require a local FIRESTORE_EMULATOR_HOST.');
}

const seedRuleSet = loadRuleSet(
  fileURLToPath(new URL('../src/gamification/seed/ruleset-v1.json', import.meta.url)),
);

const app = initializeApp({ projectId: 'demo-comradia' }, `admin-rulesets-${randomUUID()}`);
let firestore: Firestore;

const ADMIN_A = { uid: `admin-a-${randomUUID().slice(0, 8)}` };
const ADMIN_B = { uid: `admin-b-${randomUUID().slice(0, 8)}` };

/** The seed rule set with a version/status override, as stored for a test. */
function storedSeed(overrides: Partial<GamRuleSet>): GamRuleSet {
  return { ...seedRuleSet, ...overrides };
}

async function seedPublished(id: string, version: number): Promise<void> {
  await firestore.doc(`gamRuleSets/${id}`).set(storedSeed({ version, status: 'published' }));
  await firestore.doc('gamConfig/active').set({
    ruleSetId: id,
    publishedAt: FieldValue.serverTimestamp(),
    publishedBy: 'seed',
  });
}

function draftData(ruleSet: unknown, extra: Record<string, unknown> = {}): unknown {
  return { ruleSet, ...extra };
}

function httpsErrorCode(error: unknown): string {
  return error instanceof HttpsError ? error.code : `not-an-https-error: ${String(error)}`;
}

before(async () => {
  firestore = getFirestore(app);
});

after(async () => {
  await deleteApp(app);
});

describe('rule set listing and reading', () => {
  it('lists versions newest first with the active pointer', async () => {
    const id = `rs-${randomUUID().slice(0, 8)}`;
    await seedPublished(id, 1);
    const { ruleSets, active } = await listRuleSets(firestore, ADMIN_A, {});
    const listed = ruleSets.find((entry) => entry.id === id);
    assert.ok(listed);
    assert.equal(listed.status, 'published');
    assert.equal(listed.earnRuleCount, seedRuleSet.earnRules.length);
    assert.ok(active);
    assert.equal(active.ruleSetId, id);
  });

  it('returns the full rule set for a get', async () => {
    const id = `rs-${randomUUID().slice(0, 8)}`;
    await seedPublished(id, 2);
    const { ruleSet } = await getRuleSet(firestore, ADMIN_A, { ruleSetId: id });
    assert.equal(ruleSet.version, 2);
    assert.equal(ruleSet.earnRules.length, seedRuleSet.earnRules.length);
  });
});

describe('drafting', () => {
  it('creates a draft from the active rule set, one version up', async () => {
    const id = `rs-${randomUUID().slice(0, 8)}`;
    await seedPublished(id, 3);
    const before = await listRuleSets(firestore, ADMIN_A, {});
    const maxVersion = before.ruleSets.reduce((max, entry) => Math.max(max, entry.version), 0);
    const draft = await createDraft(firestore, ADMIN_A, { notes: 'Tune the toast values.' });
    assert.equal(draft.version, maxVersion + 1);
    const { ruleSet } = await getRuleSet(firestore, ADMIN_A, { ruleSetId: draft.id });
    assert.equal(ruleSet.status, 'draft');
    assert.equal(ruleSet.author, ADMIN_A.uid);
    assert.equal(ruleSet.parentVersion, 3);
    assert.deepEqual(ruleSet.earnRules.map((rule) => rule.id), seedRuleSet.earnRules.map((rule) => rule.id));
  });

  it('creates a draft from an explicit rule set id', async () => {
    const id = `rs-${randomUUID().slice(0, 8)}`;
    await seedPublished(id, 4);
    const draft = await createDraft(firestore, ADMIN_A, { fromRuleSetId: id });
    const { ruleSet } = await getRuleSet(firestore, ADMIN_A, { ruleSetId: draft.id });
    assert.equal(ruleSet.parentVersion, 4);
  });

  it('refuses to draft when nothing is active and no source is given', async () => {
    const active = await listRuleSets(firestore, ADMIN_A, {});
    const savedActive = active.active;
    if (savedActive) await firestore.doc('gamConfig/active').delete();
    try {
      await assert.rejects(
        () => createDraft(firestore, ADMIN_A, {}),
        (error: unknown) => httpsErrorCode(error) === 'failed-precondition',
      );
    } finally {
      if (savedActive) {
        await firestore.doc('gamConfig/active').set({
          ruleSetId: savedActive.ruleSetId,
          publishedAt: FieldValue.serverTimestamp(),
          publishedBy: 'seed',
        });
      }
    }
  });
});

describe('draft editing', () => {
  it('stores a validated edit and records it in gamAudit', async () => {
    const id = `rs-${randomUUID().slice(0, 8)}`;
    await seedPublished(id, 5);
    const draft = await createDraft(firestore, ADMIN_A, { fromRuleSetId: id });
    const { ruleSet } = await getRuleSet(firestore, ADMIN_A, { ruleSetId: draft.id });
    const edited: GamRuleSet = {
      ...ruleSet,
      earnRules: ruleSet.earnRules.map((rule) =>
        rule.id === 'conversation_started' ? { ...rule, award: { ...rule.award, amount: 35 } } : rule),
    };
    await updateDraft(firestore, ADMIN_B, draftData(edited, { ruleSetId: draft.id, reason: 'Raise the core earn.' }));
    const after = await getRuleSet(firestore, ADMIN_A, { ruleSetId: draft.id });
    const changed = after.ruleSet.earnRules.find((rule) => rule.id === 'conversation_started');
    assert.equal(changed?.award.amount, 35);
    assert.equal(after.ruleSet.author, ADMIN_A.uid, 'editing does not reauthor the draft');
    const audit = await auditList(firestore, ADMIN_A, { limit: 50 });
    const entry = audit.entries.find((row) => row.target === draft.id && row.action === 'gam.ruleset.update');
    assert.ok(entry);
    assert.equal(entry.actor, ADMIN_B.uid);
  });

  it('rejects an edit that fails contract validation, with the field path', async () => {
    const id = `rs-${randomUUID().slice(0, 8)}`;
    await seedPublished(id, 6);
    const draft = await createDraft(firestore, ADMIN_A, { fromRuleSetId: id });
    const { ruleSet } = await getRuleSet(firestore, ADMIN_A, { ruleSetId: draft.id });
    const broken = { ...ruleSet, earnRules: ruleSet.earnRules.map((rule) => ({ ...rule, caps: {} })) };
    await assert.rejects(
      () => updateDraft(firestore, ADMIN_A, draftData(broken, { ruleSetId: draft.id })),
      (error: unknown) => error instanceof HttpsError && error.code === 'invalid-argument'
        && error.message.includes('needs at least one cap'),
    );
  });

  it('refuses to edit a published rule set', async () => {
    const id = `rs-${randomUUID().slice(0, 8)}`;
    await seedPublished(id, 7);
    const { ruleSet } = await getRuleSet(firestore, ADMIN_A, { ruleSetId: id });
    await assert.rejects(
      () => updateDraft(firestore, ADMIN_A, draftData(ruleSet, { ruleSetId: id })),
      (error: unknown) => httpsErrorCode(error) === 'failed-precondition',
    );
  });
});

describe('the two-person publish flow', () => {
  it('publishes only when a different admin approves the request', async () => {
    const id = `rs-${randomUUID().slice(0, 8)}`;
    await seedPublished(id, 8);
    const draft = await createDraft(firestore, ADMIN_A, { fromRuleSetId: id });
    const { ruleSet } = await getRuleSet(firestore, ADMIN_A, { ruleSetId: draft.id });

    await assert.rejects(
      () => approvePublish(firestore, ADMIN_B, { ruleSetId: draft.id, reason: 'Nobody requested it yet.' }),
      (error: unknown) => httpsErrorCode(error) === 'failed-precondition',
    );

    await requestPublish(firestore, ADMIN_A, { ruleSetId: draft.id, reason: 'Ready to ship the tuning.' });

    await assert.rejects(
      () => approvePublish(firestore, ADMIN_A, { ruleSetId: draft.id, reason: 'Approving my own request.' }),
      (error: unknown) => httpsErrorCode(error) === 'permission-denied',
    );

    await approvePublish(firestore, ADMIN_B, { ruleSetId: draft.id, reason: 'Reviewed the diff; shipping it.' });

    const published = await getRuleSet(firestore, ADMIN_A, { ruleSetId: draft.id });
    assert.equal(published.ruleSet.status, 'published');
    assert.ok(published.active);
    assert.equal(published.active.ruleSetId, draft.id);
    const previous = await getRuleSet(firestore, ADMIN_A, { ruleSetId: id });
    assert.equal(previous.ruleSet.status, 'archived');

    const audit = await auditList(firestore, ADMIN_A, { limit: 50 });
    const approval = audit.entries.find(
      (row) => row.target === draft.id && row.action === 'gam.publish.approve');
    assert.ok(approval);
    assert.equal(approval.secondApprover, ADMIN_B.uid);
  });

  it('invalidates the request when the draft changes after it', async () => {
    const id = `rs-${randomUUID().slice(0, 8)}`;
    await seedPublished(id, 9);
    const draft = await createDraft(firestore, ADMIN_A, { fromRuleSetId: id });
    const { ruleSet } = await getRuleSet(firestore, ADMIN_A, { ruleSetId: draft.id });
    await requestPublish(firestore, ADMIN_A, { ruleSetId: draft.id, reason: 'Publishing this state.' });
    await updateDraft(firestore, ADMIN_A, draftData(ruleSet, { ruleSetId: draft.id, reason: 'One more tweak.' }));
    await assert.rejects(
      () => approvePublish(firestore, ADMIN_B, { ruleSetId: draft.id, reason: 'Approving the newer state.' }),
      (error: unknown) => httpsErrorCode(error) === 'failed-precondition',
    );
  });
});

describe('the two-person rollback flow', () => {
  it('rolls the active pointer back to an archived version, with two people', async () => {
    const id = `rs-${randomUUID().slice(0, 8)}`;
    await seedPublished(id, 10);
    const draft = await createDraft(firestore, ADMIN_A, { fromRuleSetId: id });
    await requestPublish(firestore, ADMIN_A, { ruleSetId: draft.id, reason: 'Rolling out the new set.' });
    await approvePublish(firestore, ADMIN_B, { ruleSetId: draft.id, reason: 'Reviewed; shipping.' });
    const archived = await getRuleSet(firestore, ADMIN_A, { ruleSetId: id });
    assert.equal(archived.ruleSet.status, 'archived');

    await requestRollback(firestore, ADMIN_A, { ruleSetId: id, reason: 'The new set over-rewards replies.' });
    await assert.rejects(
      () => approveRollback(firestore, ADMIN_A, { ruleSetId: id, reason: 'Approving my own rollback.' }),
      (error: unknown) => httpsErrorCode(error) === 'permission-denied',
    );
    await approveRollback(firestore, ADMIN_B, { ruleSetId: id, reason: 'Agreed; back to the last good set.' });

    const rolledBack = await getRuleSet(firestore, ADMIN_A, { ruleSetId: id });
    assert.equal(rolledBack.ruleSet.status, 'published');
    assert.ok(rolledBack.active);
    assert.equal(rolledBack.active.ruleSetId, id);
    const outgoing = await getRuleSet(firestore, ADMIN_A, { ruleSetId: draft.id });
    assert.equal(outgoing.ruleSet.status, 'archived');
  });

  it('refuses to roll back to a draft', async () => {
    const draft = await createDraft(firestore, ADMIN_A, {});
    await assert.rejects(
      () => requestRollback(firestore, ADMIN_A, { ruleSetId: draft.id, reason: 'Not a published version.' }),
      (error: unknown) => httpsErrorCode(error) === 'failed-precondition',
    );
  });
});

describe('the audit log', () => {
  it('lists newest first', async () => {
    const id = `rs-audit-${randomUUID().slice(0, 8)}`;
    await firestore.doc(`gamRuleSets/${id}`).set(storedSeed({ version: 11, status: 'published' }));
    await requestRollback(firestore, ADMIN_A, { ruleSetId: id, reason: 'Reading the audit log order.' });
    const audit = await auditList(firestore, ADMIN_A, { limit: 200 });
    assert.ok(audit.entries.length >= 1);
    const newest = audit.entries[0];
    assert.equal(newest.action, 'gam.rollback.request');
    assert.equal(newest.target, id);
    if (audit.entries.length >= 2) {
      assert.ok(audit.entries[0].createdAt !== null && audit.entries[1].createdAt !== null);
      assert.ok(audit.entries[0].createdAt.seconds >= audit.entries[1].createdAt.seconds);
    }
  });
});
