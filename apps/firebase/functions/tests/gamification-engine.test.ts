import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, it } from 'node:test';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { processEvent } from '../src/gamification/engine/evaluator.js';
import { SAFE_FLAGS, StaticFlagsProvider } from '../src/gamification/engine/flags.js';
import { seedRuleSet, StaticRuleSetLoader } from '../src/gamification/engine/ruleset-loader.js';
import { GamEngineStore } from '../src/gamification/engine/store.js';

if (!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? '')) {
  throw new Error('Gamification engine tests require a local Firestore emulator');
}
const app = initializeApp({ projectId: 'demo-comradia' }, 'gamification-engine-test');
const db = getFirestore(app);
after(() => deleteApp(app));

async function fixture(overrides: Partial<typeof SAFE_FLAGS> = {}) {
  const id = randomUUID();
  const first = `a${id}`;
  const second = `b${id}`;
  const matchId = `${first}_${second}`;
  const at = Timestamp.fromDate(new Date('2026-11-25T12:00:00Z'));
  const store = new GamEngineStore(db, 'fixture-salt');
  await db.batch()
    .set(db.doc(`users/${first}`), { createdAt: at })
    .set(db.doc(`users/${second}`), { createdAt: at })
    .set(db.doc(`matches/${matchId}`), { users: [first, second], createdAt: at })
    .commit();
  return {
    first, second, matchId, at, store,
    deps: {
      store,
      flags: new StaticFlagsProvider({ ...SAFE_FLAGS, ...overrides }),
      rules: new StaticRuleSetLoader(seedRuleSet()),
      now: () => at.toMillis(),
    },
    input: {
      event: {
        kind: 'match.created' as const, uid: first, pairKey: matchId,
        source: `matches/${matchId}`, eventId: id, at,
      },
      facts: {},
    },
  };
}

it('commits exactly one award per pair member across concurrent deliveries', async () => {
  const { first, second, deps, input, store } = await fixture({ shadow: false, uiEnabled: true, experimentPct: 100 });
  const results = await Promise.all([processEvent(input, deps), processEvent(input, deps)]);
  assert.equal(results.reduce((sum, result) => sum + result.awards, 0), 2);
  for (const uid of [first, second]) {
    const projection = store.projectionRef(uid, false);
    assert.equal((await projection.get()).get('balance'), 5);
    assert.equal((await projection.collection('ledger').get()).size, 1);
    assert.equal((await projection.collection('lots').get()).size, 1);
  }
});

it('writes only shadow data when the shadow flag is explicitly enabled', async () => {
  const { first, deps, input, store } = await fixture({ shadow: true });
  assert.equal((await processEvent(input, deps)).awards, 2);
  assert.equal((await store.projectionRef(first, true).get()).get('balance'), 5);
  assert.equal((await store.projectionRef(first, false).get()).exists, false);
});

it('does not issue from default or kill-switch configuration', async () => {
  for (const overrides of [{}, { killSwitch: true, shadow: true }, { killSwitch: true, uiEnabled: true, experimentPct: 100 }]) {
    const { first, deps, input, store } = await fixture(overrides);
    assert.equal((await processEvent(input, deps)).awards, 0);
    assert.equal((await store.projectionRef(first, true).get()).exists, false);
    assert.equal((await store.projectionRef(first, false).get()).exists, false);
  }
});

it('releases a verified hold once without counting its reserved cap twice', async () => {
  const { releaseHold } = await import('../src/gamification/engine/evaluator.js');
  const { first, matchId, deps, input, store, at } = await fixture({
    shadow: false, uiEnabled: true, experimentPct: 100,
  });
  const ruleSet = seedRuleSet();
  const flags = await deps.flags.getFlags();
  const rule = ruleSet.earnRules.find((candidate) => candidate.event === 'conversation.started')!;
  const hold = {
    event: { ...input.event, kind: rule.event, source: `matches/${matchId}/messages/m6` },
    facts: { 'conversation.messagesEach': 3, 'conversation.spanMinutes': 11, 'account.ageDays': 8 },
  };
  assert.equal((await processEvent(hold, deps)).holds, 2);
  assert.equal((await processEvent(hold, deps)).holds, 0);
  const bucket = store.pairBucketKey(matchId);
  const core = { store, flags, ruleSet, now: () => at.toMillis() + 24 * 3_600_000 };
  assert.equal(await releaseHold(core, first, false, rule, bucket, false), 'released');
  assert.equal(await releaseHold(core, first, false, rule, bucket, false), 'missing');
  assert.equal((await store.projectionRef(first, false).get()).get('balance'), 30);
  assert.equal((await store.counterRef(first, false, `pair:${rule.id}:${bucket}`).get()).get('count'), 1);
});

it('does not re-create a deleted account projection when a source event is retried', async () => {
  const { first, second, deps, input, store } = await fixture({ shadow: true });
  await db.doc(`users/${first}`).delete();
  assert.equal((await processEvent(input, deps)).awards, 1);
  assert.equal((await store.projectionRef(first, true).get()).exists, false);
  assert.equal((await store.projectionRef(second, true).get()).get('balance'), 5);
});

it('closes the qualified week once and pays its correctly dated award', async () => {
  const { settleWeek } = await import('../src/gamification/engine/weekly.js');
  const { first, deps, input, store } = await fixture({ shadow: true });
  await processEvent(input, deps);
  await store.counterRef(first, true, 'qualweek:2026-11-23').set({ count: 1 });
  const now = Date.parse('2026-11-30T06:00:00Z');
  const core = { store, flags: await deps.flags.getFlags(), ruleSet: seedRuleSet(), now: () => now };
  await settleWeek(core, first, true, now);
  await settleWeek(core, first, true, now);
  const projection = store.projectionRef(first, true);
  const snapshot = await projection.get();
  assert.equal(snapshot.get('streak.lastClosedWeek'), '2026-11-23');
  assert.equal(snapshot.get('streak.currentWeeks'), 1);
  assert.equal(snapshot.get('balance'), 20);
  assert.equal((await projection.collection('ledger').get()).size, 2);
});

it('stops awards for an opted-out member, and allows that member to rejoin', async () => {
  const { updatePreferences } = await import('../src/gamification/engine/preferences.js');
  const { first, deps, input, store, at } = await fixture({ shadow: true });
  await updatePreferences(db, first, { optedOut: true }, 12, 'America/Sao_Paulo', at.toMillis());
  await processEvent(input, deps);
  assert.equal((await store.projectionRef(first, true).get()).exists, false);
  await updatePreferences(db, first, { optedOut: false }, 12, 'America/Sao_Paulo', at.toMillis());
  assert.equal((await db.doc(`gamPreferences/${first}`).get()).get('optedOut'), false);
  await assert.rejects(updatePreferences(db, first, { pauseWeeks: 13 }, 12, 'America/Sao_Paulo', at.toMillis()));
});

it('lapses and regains the active weekly badge without issuing Cravos', async () => {
  const { refreshActiveBadges } = await import('../src/gamification/engine/active-badges.js');
  const { first, deps, input, store } = await fixture({ shadow: false, uiEnabled: true, experimentPct: 100 });
  await processEvent(input, deps);
  const flags = await deps.flags.getFlags();
  const core = { store, flags, ruleSet: seedRuleSet(), now: deps.now };
  for (const week of ['2026-11-02', '2026-11-09', '2026-11-23']) {
    await store.counterRef(first, false, `qualweek:${week}`).set({ count: 1 });
  }
  const badge = store.achievementRef(first, false, 'roda');
  await refreshActiveBadges(core, first, false, '2026-11-23', deps.now());
  assert.equal((await badge.get()).get('status'), 'unlocked');
  await refreshActiveBadges(core, first, false, '2026-12-21', deps.now());
  assert.equal((await badge.get()).get('status'), 'lapsed');
  for (const week of ['2026-12-21', '2026-12-28', '2027-01-04']) {
    await store.counterRef(first, false, `qualweek:${week}`).set({ count: 1 });
  }
  await refreshActiveBadges(core, first, false, '2027-01-04', deps.now());
  assert.equal((await badge.get()).get('status'), 'unlocked');
  assert.equal((await store.projectionRef(first, false).get()).get('balance'), 5);
});

it('requires Storage verification before issuing portrait points', async () => {
  const { recordProfile } = await import('../src/gamification/engine/activity.js');
  const { first, deps, store, at } = await fixture({ uiEnabled: true, experimentPct: 100 });
  const profile = db.doc(`profiles/${first}`);
  const before = await profile.get();
  const path = `photos/${first}/portrait.jpg`;
  await profile.set({ photoPath: path });
  const after = await profile.get();
  const activity = { at, id: 'profile-v1', path: profile.path };
  await recordProfile(deps, before, after, activity, async () => false);
  assert.equal((await store.projectionRef(first, false).get()).exists, false);
  await recordProfile(deps, before, after, activity, async (candidate) => candidate === path);
  assert.equal((await store.projectionRef(first, false).get()).get('balance'), 30);
});
