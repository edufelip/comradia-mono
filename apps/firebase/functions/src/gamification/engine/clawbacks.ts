// Clawbacks (spec §4 and §11): match.deleted, report.created, report.upheld,
// block.created and profile.photo_removed take awards back. Entry ids are
// deterministic ({ruleId}:{sourceId}:{uid}), so no ledger queries are needed:
// the trigger computes the original entry id, checks its age against the rule's
// window, and appends a clawback:{originalId} entry. The blocker never loses
// anything; only the blocked or reported party does. Unreleased holds for the
// pair are voided, never ledgered.

import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { clawbackEntryId, ledgerEntryId, type GamRule, type GamRuleSet, type GamTriggerEvent } from '../model';
import { highWaterMark, levelFromRules } from '../level-for-lifetime';
import { isoDateInZone } from './weeks';
import { parseProjection, projectionDoc, readCounter, type ProjectionState } from './store';
import { EngineCore, pairBucketFor } from './evaluator';

export type TriggerInput = {
  kind: GamTriggerEvent;
  /** The event's subject: the blocked or reported member, or the pair's first uid. */
  uid: string;
  /** The pair the trigger is about (`{a}_{b}`, sorted). */
  pairKey: string | null;
  at: Timestamp;
  eventId: string;
  sourcePath: string;
};

export type ClawbackResult = {
  clawbacks: number;
  holdsVoided: number;
};

/** Rules that claw back on this trigger, and who they take from. */
export function clawbackRules(
  ruleSet: GamRuleSet,
  kind: GamTriggerEvent,
): Array<{ rule: GamRule; party: 'reported' | 'blocked' | 'all' }> {
  const rules: Array<{ rule: GamRule; party: 'reported' | 'blocked' | 'all' }> = [];
  for (const rule of ruleSet.earnRules) {
    const clawback = rule.clawback?.find((entry) => entry.on === kind);
    if (clawback === undefined) continue;
    rules.push({ rule, party: clawback.party ?? 'all' });
  }
  return rules;
}

/** Everyone who can lose this award for the trigger. */
export function affectedUids(
  party: 'reported' | 'blocked' | 'all',
  subjectUid: string,
  pairKey: string | null,
): string[] {
  if (party === 'all' && pairKey !== null) {
    const [first, second] = pairKey.split('_');
    return first < second ? [first, second] : [second, first];
  }
  return [subjectUid];
}

/**
 * Applies one trigger event. One transaction per trigger: reads the original
 * entries and the affected projections, writes clawback entries, deletes the
 * matching lots, reverts quest progress when the clawed event was the member's
 * current-week quest part, and voids unreleased holds.
 */
export async function applyTrigger(
  core: EngineCore,
  input: TriggerInput,
  published: readonly GamRuleSet[] = [],
): Promise<ClawbackResult> {
  const { store, ruleSet, now } = core;
  const nowMs = now();
  const day = isoDateInZone(input.at.toMillis(), ruleSet.streakRules.timezone);
  type Target = { uid: string; shadow: boolean; ledgerId: string; rules: Map<number, GamRule> };
  const targets = new Map<string, Target>();
  const versions = new Map([...published, ruleSet].map((version) => [version.version, version]));
  for (const version of versions.values()) {
    for (const { rule, party } of clawbackRules(version, input.kind)) {
      for (const uid of affectedUids(party, input.uid, input.pairKey)) {
        const sourceId = rule.idempotencyKey.split(':')[1] === '{matchId}' ? input.pairKey : uid;
        if (sourceId === null) continue;
        const ledgerId = ledgerEntryId(rule.id, sourceId, uid);
        for (const shadow of [false, true]) {
          const key = store.ledgerRef(uid, shadow, ledgerId).path;
          const target = targets.get(key) ?? { uid, shadow, ledgerId, rules: new Map<number, GamRule>() };
          target.rules.set(version.version, rule);
          targets.set(key, target);
        }
      }
    }
  }
  if (targets.size === 0) return { clawbacks: 0, holdsVoided: 0 };

  return store.runTransaction(async (tx) => {
    const states = new Map<string, ProjectionState>();
    const deletedHolds = new Set<string>();
    let clawbacks = 0;
    let holdsVoided = 0;

    for (const target of targets.values()) {
      const { ledgerId } = target;
      const originalRef = store.ledgerRef(target.uid, target.shadow, ledgerId);
      const clawbackRef = store.ledgerRef(target.uid, target.shadow, clawbackEntryId(ledgerId));
      const projectionRef = store.projectionRef(target.uid, target.shadow);

      const [originalSnap, clawbackSnap, projectionSnap, expired] = await tx.getAll(
        originalRef,
        clawbackRef,
        projectionRef,
        store.ledgerRef(target.uid, target.shadow, `expire:${ledgerId}`),
      );

      for (const [version, rule] of target.rules) {
        if (rule.hold === undefined) continue;
        const bucket = pairBucketFor(store, rule, input.pairKey) ?? input.pairKey ?? target.uid;
        const holdRef = store.holdRef(target.uid, target.shadow, rule.id, bucket);
        if (deletedHolds.has(holdRef.path)) continue;
        const hold = await tx.get(holdRef);
        if (hold.exists && (hold.get('ruleSetVersion') ?? version) === version) {
          tx.delete(holdRef);
          deletedHolds.add(holdRef.path);
          holdsVoided += 1;
        }
      }
      if (!projectionSnap.exists || !originalSnap.exists || clawbackSnap.exists) continue;
      const version: unknown = originalSnap.get('ruleSetVersion');
      if (typeof version !== 'number') continue;
      const rule = target.rules.get(version);
      if (rule === undefined) continue;

      const amount = originalSnap.get('amount');
      const createdAt = originalSnap.get('createdAt');
      if (typeof amount !== 'number' || !(createdAt instanceof Timestamp)) continue;

      // The window counts from the earn to the trigger (match deleted within 7
      // days of the earn, block within 7 days, report within 3).
      const clawback = rule.clawback?.find((entry) => entry.on === input.kind);
      if (clawback?.withinDays !== undefined
        && input.at.toMillis() - createdAt.toMillis() > clawback.withinDays * 86_400_000) continue;

      const state = states.get(projectionRef.path) ?? parseProjection(projectionSnap.data());

      tx.create(clawbackRef, {
        track: 'cravos',
        kind: 'clawback',
        amount: -amount,
        ruleId: rule.id,
        ruleSetVersion: version,
        source: { event: input.kind, path: input.sourcePath, eventId: input.eventId },
        actor: 'system',
        reason: input.kind,
        createdAt: FieldValue.serverTimestamp(),
      });
      tx.delete(store.lotRef(target.uid, target.shadow, ledgerId));
      // Expiry already debited this share. Reverse that debit before applying the full
      // earned-amount clawback so both the ledger and projected balance reconcile.
      const expiredDebit: unknown = expired.get('amount');
      const restored = typeof expiredDebit === 'number' && expiredDebit < 0 ? Math.min(amount, -expiredDebit) : 0;
      if (restored > 0) {
        tx.create(store.ledgerRef(target.uid, target.shadow, `reverse-expiry:${ledgerId}`), {
          track: 'cravos', kind: 'refund', amount: restored, ruleId: 'reverse_lot_expiry',
          ruleSetVersion: ruleSet.version,
          source: { event: 'lot.expiry_reversed', path: expired.ref.path, eventId: input.eventId },
          actor: 'system', createdAt: FieldValue.serverTimestamp(),
        });
      }

      const next: ProjectionState = { ...state, streak: { ...state.streak }, quest: { ...state.quest } };
      next.balance = state.balance - amount + restored;
      next.lifetimeNet = state.lifetimeNet - amount;
      // The high-water mark only rises: a clawback never demotes the level.
      next.levelHighWaterMark = highWaterMark(state.levelHighWaterMark, next.lifetimeNet);
      next.levelId = levelFromRules(next.levelHighWaterMark, state.levelId, ruleSet.levels);

      // Revert the quest part this earn counted toward (the weekly quest is
      // "re-evaluated if its parts are clawed back", spec §4).
      const weekStart = isoWeekStartOf(createdAt, ruleSet);
      if (weekStart !== null) {
        const quest = state.quest.questId !== null && state.quest.weekStart === weekStart
          ? ruleSet.quests.find((candidate) => candidate.id === state.quest.questId)
          : null;
        const partIndex = quest?.parts.findIndex((part) => part.event === rule.event) ?? -1;
        if (quest !== undefined && quest !== null && partIndex >= 0) {
          const partRef = store.counterRef(target.uid, target.shadow, `quest:${weekStart}:${quest.id}:${partIndex}`);
          const partSnap = await tx.get(partRef);
          const partCount = readCounter(partSnap.data()).count;
          if (partCount > 0) {
            tx.set(partRef, { count: FieldValue.increment(-1), updatedAt: new Date(nowMs).toISOString() }, { merge: true });
          }
          next.quest = { ...next.quest, progress: Math.max(0, state.quest.progress - 1) };
          const questEntryId = ledgerEntryId(
            ruleSet.earnRules.find((rule) => rule.event === 'quest.completed')?.id ?? 'quest_completed',
            weekStart,
            target.uid,
          );
          const questEntry = await tx.get(store.ledgerRef(target.uid, target.shadow, questEntryId));
          if (questEntry.exists && state.questCompletedAt !== null) {
            const questClawbackRef = store.ledgerRef(target.uid, target.shadow, clawbackEntryId(questEntryId));
            const questClawback = await tx.get(questClawbackRef);
            if (!questClawback.exists) {
              const questAmount = questEntry.get('amount');
              if (typeof questAmount === 'number') {
                tx.create(questClawbackRef, {
                  track: 'cravos',
                  kind: 'clawback',
                  amount: -questAmount,
                  ruleId: questEntry.get('ruleId') ?? 'quest_completed',
                  ruleSetVersion: ruleSet.version,
                  source: { event: 'quest.part_clawed_back', path: input.sourcePath, eventId: input.eventId },
                  actor: 'system',
                  reason: 'quest.part_clawed_back',
                  createdAt: FieldValue.serverTimestamp(),
                });
                next.balance -= questAmount;
                next.lifetimeNet -= questAmount;
                next.levelHighWaterMark = highWaterMark(next.levelHighWaterMark, next.lifetimeNet);
                next.levelId = levelFromRules(next.levelHighWaterMark, state.levelId, ruleSet.levels);
                next.questCompletedAt = null;
                clawbacks += 1;
              }
            }
          }
        }
      }

      tx.set(projectionRef, projectionDoc(next, FieldValue.serverTimestamp()), { merge: true });
      states.set(projectionRef.path, next);
      clawbacks += 1;
    }

    if (clawbacks > 0 || holdsVoided > 0) {
      tx.set(store.metricsRef(day), {
        clawbacks: FieldValue.increment(clawbacks),
        holdsVoided: FieldValue.increment(holdsVoided),
      }, { merge: true });
    }
    return { clawbacks, holdsVoided };
  });
}

/** The zone-local week start of a Timestamp, or null when it is not one. */
function isoWeekStartOf(value: unknown, ruleSet: GamRuleSet): string | null {
  if (!(value instanceof Timestamp)) return null;
  const ms = value.toMillis();
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: ruleSet.streakRules.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms));
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: ruleSet.streakRules.timezone,
    weekday: 'short',
  }).format(new Date(ms));
  const index = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday);
  if (index < 0) return null;
  const [year, month, date] = day.split('-').map(Number);
  const back = (index + 6) % 7;
  const shifted = new Date(Date.UTC(year, month - 1, date - back));
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(shifted);
}
