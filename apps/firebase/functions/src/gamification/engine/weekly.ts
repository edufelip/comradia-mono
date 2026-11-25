import { FieldPath, FieldValue, Timestamp, type Query, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { loadEngine } from './activity';
import { applyAward, applyConditions, releaseHold, type EngineCore, type EngineDeps } from './evaluator';
import { shadowTarget } from './flags';
import { parseProjection, projectionDoc } from './store';
import { lastClosedWeekStart, weekStartInstant, weekStartOf } from './weeks';

export async function settleWeek(core: EngineCore, uid: string, shadow: boolean, nowMs: number) {
  const { ruleSet, store } = core;
  const rules = ruleSet.streakRules;
  const closed = lastClosedWeekStart(nowMs, rules.timezone);
  const current = weekStartOf(nowMs, rules.timezone);
  const projectionRef = store.projectionRef(uid, shadow);
  const qualifiedRef = store.counterRef(uid, shadow, `qualweek:${closed}`);
  const thisWeekRef = store.counterRef(uid, shadow, `qualweek:${current}`);
  const closedAt = weekStartInstant(current, rules.timezone) - 1;

  await store.runTransaction(async (tx) => {
    const [account, projection, qualified, thisWeek] = await tx.getAll(
      store.firestore.doc(`users/${uid}`), projectionRef, qualifiedRef, thisWeekRef,
    );
    if (!account.exists || account.get('gamOptedOut') === true || !projection.exists) return;
    let state = parseProjection(projection.data());
    if (state.streak.lastClosedWeek >= closed) return;

    const streak = state.streak;
    if (qualified.exists) {
      streak.currentWeeks += 1;
      streak.recordWeeks = Math.max(streak.currentWeeks, streak.recordWeeks);
      if (streak.currentWeeks % rules.pauseEarnEveryWeeks === 0) {
        streak.pauseBank = Math.min(streak.pauseBank + 1, rules.pauseBankByLevel[state.levelId]);
      }
    } else if (streak.currentWeeks > 0 && (streak.pausedUntil?.toMillis() ?? 0) < closedAt) {
      if (streak.pauseBank > 0) streak.pauseBank -= 1;
      else streak.currentWeeks = 0;
    }
    streak.lastClosedWeek = closed;
    streak.qualifiedThisWeek = thisWeek.exists;

    if (qualified.exists) {
      for (const rule of ruleSet.earnRules) {
        const milestone = rule.event === 'streak.milestone';
        if (rule.event !== 'streak.week_completed' && !milestone) continue;
        if (!applyConditions(rule.conditions, { 'streak.weeks': streak.currentWeeks })) continue;
        const award = await applyAward(tx, core, {
          rule, recipient: uid, shadow, amount: rule.award.amount, sourceId: milestone ? uid : closed,
          pairKey: null, atMs: closedAt, sourcePath: qualifiedRef.path, eventId: `week:${closed}`,
        }, state);
        state = award.state;
      }
    }
    tx.set(projectionRef, projectionDoc(state, FieldValue.serverTimestamp()), { merge: true });
  });
}

async function* pages(query: Query) {
  let cursor: QueryDocumentSnapshot | undefined;
  const ordered = query.orderBy(FieldPath.documentId()).limit(100);
  while (true) {
    const { docs } = await (cursor ? ordered.startAfter(cursor) : ordered).get();
    for (const doc of docs) yield doc;
    if (docs.length < 100) return;
    cursor = docs.at(-1);
  }
}

export async function runGamificationWeek(deps: EngineDeps, nowMs = deps.now()) {
  const core = await loadEngine(deps);
  if (core === null) return;
  const db = core.store.firestore;

  for await (const hold of pages(db.collectionGroup('counters').where('releaseAt', '<=', Timestamp.fromMillis(nowMs)).orderBy('releaseAt'))) {
    const projection = hold.ref.parent.parent;
    if (projection === null || !['gamification', 'gamShadow'].includes(projection.parent.id)) continue;
    const rule = core.ruleSet.earnRules.find((candidate) => candidate.id === hold.get('ruleId') && candidate.hold !== undefined);
    if (rule === undefined) continue;
    const shadow = projection.parent.id === 'gamShadow';
    const prefix = `hold:${rule.id}:`;
    if (hold.id.startsWith(prefix)) await releaseHold(core, projection.id, shadow, rule, hold.id.slice(prefix.length), false);
  }

  for (const root of ['gamification', 'gamShadow'] as const) {
    for await (const projection of pages(db.collection(root))) {
      const shadow = root === 'gamShadow';
      if (shadow === shadowTarget(core.flags, projection.id)) await settleWeek(core, projection.id, shadow, nowMs);
    }
  }
}
