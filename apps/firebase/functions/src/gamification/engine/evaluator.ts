// The Cravos evaluator: one Firestore transaction per event. It applies the
// active rule set's conditions, caps, holds, campaigns, quests, achievements and
// levels (high-water mark), and writes the ledger entry with the idempotency
// key as the document id so a retried trigger can never pay twice (spec §8).
//
// Structure:
//   processEvent  — one event -> matching rules -> holds or awards, one transaction.
//   applyAward    — one award (ledger, caps, projection, lot, achievements, quest,
//                   celebration, metrics, velocity counters), inside a caller's tx.
//   releaseHold   — a matured (or reply-released) hold becomes a real award.

import { createHash } from 'node:crypto';
import { FieldValue, Timestamp, type DocumentReference } from 'firebase-admin/firestore';
import {
  ledgerEntryId,
  type GamAchievementRule,
  type GamCampaign,
  GAM_EARN_EVENTS,
  type GamEarnEvent,
  type GamEvent,
  type GamLedgerEntry,
  type GamLevelId,
  type GamQuest,
  type GamRule,
  type GamRuleSet,
} from '../model';
import { highWaterMark, levelFromRules } from '../level-for-lifetime';
import { armFor, engineEnabled, shadowTarget, type GamFlags } from './flags';
import type { RuleSetLoader } from './ruleset-loader';
import type { GamFacts } from './normalizers';
import { isoDateInZone, weekStartOf } from './weeks';
import {
  GamEngineStore,
  parseProjection,
  projectionDoc,
  readCounter,
  type ProjectionState,
  type EngineTransaction,
} from './store';
import { velocityBreaches, type VelocityKind } from './velocity';

/** Scheduled awards land on close day for everyone; counting them toward the
 * daily velocity threshold would alert on every member's milestone week. */
const VELOCITY_EXCLUDED_EVENTS = new Set<GamEarnEvent>(['streak.week_completed', 'streak.milestone']);

const LOT_EXPIRY_DAYS = 365;

export type EngineCore = {
  store: GamEngineStore;
  flags: GamFlags;
  ruleSet: GamRuleSet;
  /** Test seam for time-based logic (holds, expiry, streak weeks). */
  now: () => number;
};

export interface GamFlagsProviderLike {
  getFlags(): Promise<GamFlags>;
}

export type EngineDeps = {
  store: GamEngineStore;
  flags: GamFlagsProviderLike;
  rules: RuleSetLoader;
  now: () => number;
  /** Out-of-band owner alert; the implementation owns claim-marker idempotency. */
  velocityAlert?: (kind: VelocityKind, uid: string, day: string) => Promise<void>;
};

// ---------------------------------------------------------------------------
// Pure rule decisions (exported for unit tests).
// ---------------------------------------------------------------------------

export function applyConditions(conditions: GamRule['conditions'], facts: GamFacts): boolean {
  if (conditions === undefined) return true;
  return conditions.every((condition) => {
    const fact = facts[condition.fact];
    if (fact === undefined) return false; // Unknown fact: fail closed.
    switch (condition.op) {
      case '>=': return fact >= condition.value;
      case '<=': return fact <= condition.value;
      case '==': return fact === condition.value;
      case '>': return fact > condition.value;
      case '<': return fact < condition.value;
    }
  });
}

/** Who receives the award: both pair members, or the event's subject. */
export function awardRecipients(rule: GamRule, event: GamEvent): string[] {
  if (rule.award.to !== 'both_participants') return [event.uid];
  const pair = event.pairKey?.split('_') ?? [];
  return pair.length === 2 && pair[0] < pair[1] && pair.includes(event.uid) ? pair : [];
}

function documentKey(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** The sourceId of a rule's idempotency template `{ruleId}:{token}:{uid}`. */
export function resolveSourceId(rule: GamRule, event: GamEvent, ruleSet: GamRuleSet): string | null {
  const token = rule.idempotencyKey.split(':')[1] ?? '';
  if (token === '{matchId}') return event.pairKey ?? event.source.split('/').pop() ?? null;
  if (token === '{messageId}') return documentKey(event.source);
  if (token === '{uid}') return rule.event === 'profile.prompt_refreshed' ? documentKey(event.eventId) : event.uid;
  if (token === '{weekStart}') return weekStartOf(event.at.toMillis(), ruleSet.streakRules.timezone);
  return null;
}

/** The campaign multiplier for an event on a day; the highest active one wins. */
export function campaignMultiplier(
  campaigns: GamCampaign[],
  event: GamEarnEvent,
  day: string,
  arm: 'treatment' | 'control',
): number {
  let multiplier = 1;
  for (const campaign of campaigns) {
    if (campaign.startsOn > day || day > campaign.endsOn) continue;
    if (campaign.appliesTo !== undefined && !campaign.appliesTo.includes(event)) continue;
    if (campaign.audience?.experiment !== undefined
      && (campaign.audience.arm ?? 'treatment') !== arm) continue;
    if (campaign.multiplier !== undefined) multiplier = Math.max(multiplier, campaign.multiplier);
  }
  return multiplier;
}

/** Achievements that tick when this rule's award lands (never the active ones:
 * those are re-evaluated on a rolling window by the weekly job). */
export function achievementsForAward(
  ruleSet: GamRuleSet,
  rule: GamRule,
  day: string,
): GamAchievementRule[] {
  return ruleSet.achievements.filter((achievement) => {
    if (achievement.kind === 'active') return false;
    if (achievement.src.startsWith('campaign:')) {
      const campaign = ruleSet.campaigns.find(
        (candidate) => candidate.id === achievement.src.slice('campaign:'.length),
      );
      if (campaign === undefined || achievement.season === undefined) return false;
      const applies = campaign.appliesTo === undefined || campaign.appliesTo.includes(rule.event);
      return applies && achievement.season.startsOn <= day && day <= achievement.season.endsOn;
    }
    return achievement.src === rule.event;
  });
}

/** Which quest (if any) the member has this week: deterministic per uid+week. */
export function questForWeek(quests: GamQuest[], uid: string, weekStart: string): GamQuest | null {
  if (quests.length === 0) return null;
  const digest = createHash('sha256').update(`${uid}:${weekStart}`).digest();
  return quests[digest.readUInt32BE(0) % quests.length] ?? null;
}

// ---------------------------------------------------------------------------
// Award writing. All writes happen inside the caller's transaction.
// ---------------------------------------------------------------------------

export type AwardSpec = {
  rule: GamRule;
  recipient: string;
  shadow: boolean;
  amount: number;
  capsReserved?: boolean;
  sourceId: string;
  /** The pair key when the rule is pair-scoped (hashed into cap bucket ids). */
  pairKey: string | null;
  atMs: number;
  sourcePath: string;
  eventId: string;
};

export type AwardResult = {
  state: ProjectionState;
  awarded: boolean;
  reason?: 'duplicate' | 'cap';
  levelUpTo: GamLevelId | null;
  /** The recipient's daily totals after this award, for velocity checks. */
  dailyEarnTotal: number;
  conversationsToday: number;
};

export function pairBucketFor(
  store: GamEngineStore,
  rule: GamRule,
  pairKey: string | null,
): string | null {
  const isPairCapped = rule.caps.perPairLifetime !== undefined
    || rule.caps.perPairPerDay !== undefined
    || rule.caps.minGapHours !== undefined;
  return isPairCapped && pairKey !== null ? store.pairBucketKey(pairKey) : null;
}

async function readCaps(
  tx: EngineTransaction,
  store: GamEngineStore,
  spec: AwardSpec,
  pairBucket: string | null,
  day: string,
  weekStart: string,
  nowMs: number,
): Promise<{ buckets: Map<string, { ref: DocumentReference; count: number; updatedAt: string }>; ok: boolean }> {
  const { caps } = spec.rule;
  const wanted: string[] = [];
  if (caps.perDay !== undefined) wanted.push(`day:${spec.rule.id}:${day}`);
  if (caps.perWeek !== undefined) wanted.push(`week:${spec.rule.id}:${weekStart}`);
  if (caps.per30Days !== undefined) wanted.push(`30d:${spec.rule.id}`);
  if (caps.lifetime !== undefined) wanted.push(`life:${spec.rule.id}`);
  if (caps.perPairLifetime !== undefined && pairBucket !== null) wanted.push(`pair:${spec.rule.id}:${pairBucket}`);
  if (caps.perPairPerDay !== undefined && pairBucket !== null) wanted.push(`pairday:${spec.rule.id}:${pairBucket}:${day}`);
  if (caps.minGapHours !== undefined && pairBucket !== null) wanted.push(`gap:${spec.rule.id}:${pairBucket}`);
  const buckets = new Map<string, { ref: DocumentReference; count: number; updatedAt: string }>();
  if (wanted.length === 0) return { buckets, ok: true };
  const snapshots = await tx.getAll(
    ...wanted.map((bucket) => store.counterRef(spec.recipient, spec.shadow, bucket)),
  );
  snapshots.forEach((snapshot, index) => {
    const counter = readCounter(snapshot.data());
    buckets.set(wanted[index] as string, { ref: snapshot.ref, count: counter.count, updatedAt: counter.updatedAt });
  });

  const within30Days = (bucket: string): boolean => {
    const counter = buckets.get(bucket);
    return counter !== undefined && counter.updatedAt !== ''
      && nowMs - Date.parse(counter.updatedAt) < 30 * 86_400_000;
  };
  let ok = true;
  if (caps.perDay !== undefined && (buckets.get(`day:${spec.rule.id}:${day}`)?.count ?? 0) >= caps.perDay) ok = false;
  if (caps.perWeek !== undefined && (buckets.get(`week:${spec.rule.id}:${weekStart}`)?.count ?? 0) >= caps.perWeek) ok = false;
  if (caps.lifetime !== undefined && (buckets.get(`life:${spec.rule.id}`)?.count ?? 0) >= caps.lifetime) ok = false;
  if (caps.perPairLifetime !== undefined && pairBucket !== null
    && (buckets.get(`pair:${spec.rule.id}:${pairBucket}`)?.count ?? 0) >= caps.perPairLifetime) ok = false;
  if (caps.perPairPerDay !== undefined && pairBucket !== null
    && (buckets.get(`pairday:${spec.rule.id}:${pairBucket}:${day}`)?.count ?? 0) >= caps.perPairPerDay) ok = false;
  if (caps.per30Days !== undefined
    && within30Days(`30d:${spec.rule.id}`)
    && (buckets.get(`30d:${spec.rule.id}`)?.count ?? 0) >= caps.per30Days) ok = false;
  if (caps.minGapHours !== undefined && pairBucket !== null) {
    const gap = buckets.get(`gap:${spec.rule.id}:${pairBucket}`);
    if (gap !== undefined && gap.updatedAt !== ''
      && nowMs - Date.parse(gap.updatedAt) < caps.minGapHours * 3_600_000) ok = false;
  }
  return { buckets, ok };
}

function writeCapIncrements(
  tx: EngineTransaction,
  caps: GamRule['caps'],
  buckets: Map<string, { ref: DocumentReference; count: number; updatedAt: string }>,
  ruleId: string,
  pairBucket: string | null,
  day: string,
  weekStart: string,
  nowMs: number,
): void {
  const stamp = new Date(nowMs).toISOString();
  const bump = (bucket: string, reset = false): void => {
    const entry = buckets.get(bucket);
    if (entry === undefined) return;
    if (reset) tx.set(entry.ref, { count: 1, updatedAt: stamp });
    else tx.set(entry.ref, { count: FieldValue.increment(1), updatedAt: stamp }, { merge: true });
  };
  if (caps.perDay !== undefined) bump(`day:${ruleId}:${day}`);
  if (caps.perWeek !== undefined) bump(`week:${ruleId}:${weekStart}`);
  if (caps.lifetime !== undefined) bump(`life:${ruleId}`);
  if (caps.perPairLifetime !== undefined && pairBucket !== null) bump(`pair:${ruleId}:${pairBucket}`);
  if (caps.perPairPerDay !== undefined && pairBucket !== null) bump(`pairday:${ruleId}:${pairBucket}:${day}`);
  if (caps.minGapHours !== undefined && pairBucket !== null) bump(`gap:${ruleId}:${pairBucket}`);
  if (caps.per30Days !== undefined) {
    const counter = buckets.get(`30d:${ruleId}`);
    const within = counter !== undefined && counter.updatedAt !== ''
      && nowMs - Date.parse(counter.updatedAt) < 30 * 86_400_000;
    bump(`30d:${ruleId}`, !within);
  }
}

type LedgerWrite = Omit<GamLedgerEntry, 'createdAt'> & { createdAt: FieldValue };

/**
 * Writes one award: ledger entry (idempotency key as document id, create() so a
 * retry cannot pay twice), cap counters, projection + level, lot, achievement
 * ticks, celebration, metrics and velocity counters. `state` is the recipient's
 * current projection state as the caller read it; the updated one comes back.
 */
export async function applyAwardCore(
  tx: EngineTransaction,
  core: EngineCore,
  spec: AwardSpec,
  state: ProjectionState,
): Promise<AwardResult> {
  const { store, ruleSet, now } = core;
  const nowMs = now();
  const timezone = ruleSet.streakRules.timezone;
  const day = isoDateInZone(spec.atMs, timezone);
  const weekStart = weekStartOf(spec.atMs, timezone);
  const ledgerId = ledgerEntryId(spec.rule.id, spec.sourceId, spec.recipient);
  const ledgerRef = store.ledgerRef(spec.recipient, spec.shadow, ledgerId);
  const pairBucket = pairBucketFor(store, spec.rule, spec.pairKey);

  const [ledgerSnap, caps] = await Promise.all([
    tx.get(ledgerRef),
    spec.capsReserved ? Promise.resolve({ ok: true, buckets: new Map() })
      : readCaps(tx, store, spec, pairBucket, day, weekStart, spec.atMs),
  ]);
  if (ledgerSnap.exists) return { state, awarded: false, reason: 'duplicate', levelUpTo: null, dailyEarnTotal: 0, conversationsToday: 0 };
  if (!caps.ok) return { state, awarded: false, reason: 'cap', levelUpTo: null, dailyEarnTotal: 0, conversationsToday: 0 };

  const lotExpiresAt = Timestamp.fromMillis(spec.atMs + LOT_EXPIRY_DAYS * 86_400_000);
  const entry: LedgerWrite = {
    track: 'cravos',
    kind: 'earn',
    amount: spec.amount,
    ruleId: spec.rule.id,
    ruleSetVersion: ruleSet.version,
    source: { event: spec.rule.event, path: spec.sourcePath, eventId: spec.eventId },
    lot: { expiresAt: lotExpiresAt },
    actor: 'system',
    createdAt: FieldValue.serverTimestamp(),
  };
  tx.create(ledgerRef, entry);
  writeCapIncrements(tx, spec.rule.caps, caps.buckets, spec.rule.id, pairBucket, day, weekStart, spec.atMs);

  const next: ProjectionState = { ...state, streak: { ...state.streak }, quest: { ...state.quest } };
  next.balance = state.balance + spec.amount;
  next.lifetimeNet = state.lifetimeNet + spec.amount;
  next.levels = ruleSet.levels;
  next.levelHighWaterMark = highWaterMark(state.levelHighWaterMark, next.lifetimeNet);
  const previousLevel = state.levelId;
  next.levelId = levelFromRules(next.levelHighWaterMark, state.levelId, ruleSet.levels);
  const levelUpTo = next.levelId !== previousLevel ? next.levelId : null;
  tx.set(store.projectionRef(spec.recipient, spec.shadow), projectionDoc(next, FieldValue.serverTimestamp()), { merge: true });

  if (!spec.shadow) {
    tx.create(store.lotRef(spec.recipient, spec.shadow, ledgerId), {
      amount: spec.amount,
      earnedAt: Timestamp.fromMillis(spec.atMs),
      expiresAt: lotExpiresAt,
      sourceLedgerId: ledgerId,
    });

    const achievements = achievementsForAward(ruleSet, spec.rule, day);
    if (achievements.length > 0) {
      const tickRefs = achievements.map((achievement) =>
        store.counterRef(spec.recipient, spec.shadow, `ach:${achievement.id}`));
      const docRefs = achievements.map((achievement) =>
        store.achievementRef(spec.recipient, spec.shadow, achievement.id));
      const [ticks, docs] = await Promise.all([tx.getAll(...tickRefs), tx.getAll(...docRefs)]);
      achievements.forEach((achievement, index) => {
        const tick = readCounter(ticks[index].data());
        const newCount = achievement.kind === 'streak' ? next.streak.currentWeeks : tick.count + 1;
        tx.set(tickRefs[index], { count: FieldValue.increment(1), updatedAt: new Date(nowMs).toISOString() }, { merge: true });
        const currentTier = docs[index].exists && typeof docs[index].get('tier') === 'number'
          ? docs[index].get('tier') as number
          : -1;
        const tierIndex = achievement.tiers.reduce((highest, tier, slot) => tier <= newCount && slot > currentTier ? slot : highest, -1);
        if (tierIndex < 0) return;
        tx.set(docRefs[index], {
          tier: tierIndex,
          unlockedAt: FieldValue.serverTimestamp(),
          status: 'unlocked',
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        tx.create(store.celebrationRef(spec.recipient, spec.shadow, `achievement:${achievement.id}:${tierIndex}`), {
          kind: core.flags.fullscreenCelebrations && tierIndex === 2 ? 'fullscreen' : 'toast',
          copyKey: `gam.achievement.${achievement.id}`,
          achievementId: achievement.id,
          achievementTier: tierIndex,
          createdAt: FieldValue.serverTimestamp(),
          seenAt: null,
        });
      });
    }

    if (spec.rule.celebration !== undefined) {
      tx.create(store.celebrationRef(spec.recipient, spec.shadow, `earn:${ledgerId}`), {
        kind: spec.rule.celebration.kind,
        copyKey: spec.rule.celebration.copyKey,
        amount: spec.amount,
        createdAt: FieldValue.serverTimestamp(),
        seenAt: null,
      });
    }
    if (levelUpTo !== null) {
      tx.create(store.celebrationRef(spec.recipient, spec.shadow, `level:${levelUpTo}`), {
        kind: core.flags.fullscreenCelebrations ? 'fullscreen' : 'toast',
        copyKey: 'gam.level.up',
        levelId: levelUpTo,
        createdAt: FieldValue.serverTimestamp(),
        seenAt: null,
      });
    }
  }

  tx.set(store.metricsRef(day), {
    earned: FieldValue.increment(spec.amount),
    gam_points_awarded: FieldValue.increment(1),
    [`rule:${spec.rule.id}`]: FieldValue.increment(1),
  }, { merge: true });

  let dailyEarnTotal = 0;
  let conversationsToday = 0;
  if (!VELOCITY_EXCLUDED_EVENTS.has(spec.rule.event)) {
    const velocityRef = store.counterRef(spec.recipient, spec.shadow, `daycravos:${day}`);
    const velocitySnap = await tx.get(velocityRef);
    dailyEarnTotal = readCounter(velocitySnap.data()).count + spec.amount;
    tx.set(velocityRef, { count: FieldValue.increment(spec.amount), updatedAt: new Date(nowMs).toISOString() }, { merge: true });
    if (spec.rule.event === 'conversation.started') {
      const convRef = store.counterRef(spec.recipient, spec.shadow, `dayconv:${day}`);
      const convSnap = await tx.get(convRef);
      conversationsToday = readCounter(convSnap.data()).count + 1;
      tx.set(convRef, { count: FieldValue.increment(1), updatedAt: new Date(nowMs).toISOString() }, { merge: true });
    }
  }

  return { state: next, awarded: true, levelUpTo, dailyEarnTotal, conversationsToday };
}

/**
 * Wraps applyAwardCore with the quest machinery: ticks the member's quest part
 * for the rule's event and, when every part is done, awards quest.completed in
 * the same transaction. Also marks the streak week qualified for events the
 * streak rules count (quest.completed, profile.prompt_refreshed).
 */
export async function applyAward(
  tx: EngineTransaction,
  core: EngineCore,
  spec: AwardSpec,
  state: ProjectionState,
): Promise<AwardResult> {
  const result = await applyAwardCore(tx, core, spec, state);
  if (!result.awarded) return result;

  const { store, ruleSet, now } = core;
  const nowMs = now();
  const timezone = ruleSet.streakRules.timezone;
  const weekStart = weekStartOf(spec.atMs, timezone);
  let working = result.state;

  if (working.quest.weekStart !== weekStart) working.questCompletedAt = null;
  const quest = state.quest.questId !== null && state.quest.weekStart === weekStart
    ? ruleSet.quests.find((candidate) => candidate.id === state.quest.questId) ?? null
    : questForWeek(ruleSet.quests, spec.recipient, weekStart);

  if (quest !== null && state.quest.weekStart <= weekStart) {
    const partIndex = quest.parts.findIndex((part) => part.event === spec.rule.event);
    if (partIndex >= 0) {
      const partRef = store.counterRef(spec.recipient, spec.shadow, `quest:${weekStart}:${quest.id}:${partIndex}`);
      const partSnap = await tx.get(partRef);
      const partCount = readCounter(partSnap.data()).count;
      if (partCount < quest.parts[partIndex].target) {
        tx.set(partRef, { count: FieldValue.increment(1), updatedAt: new Date(nowMs).toISOString() }, { merge: true });
      }
      const partCounts = await tx.getAll(...quest.parts.map((_, index) =>
        store.counterRef(spec.recipient, spec.shadow, `quest:${weekStart}:${quest.id}:${index}`)));
      const done = quest.parts.every((part, index) => {
        const count = index === partIndex && partCount < part.target ? partCount + 1 : readCounter(partCounts[index].data()).count;
        return count >= part.target;
      });
      const progress = quest.parts.reduce((sum, part, index) => {
        const count = index === partIndex && partCount < part.target ? partCount + 1 : readCounter(partCounts[index].data()).count;
        return sum + Math.min(count, part.target);
      }, 0);
      working = { ...working, quest: { ...working.quest, questId: quest.id, weekStart, progress, target: quest.parts.reduce((sum, part) => sum + part.target, 0) } };
      if (done && working.questCompletedAt === null) {
        const questRule = ruleSet.earnRules.find((rule) => rule.event === 'quest.completed');
        if (questRule !== undefined) {
          const questResult = await applyAwardCore(tx, core, {
            rule: questRule,
            recipient: spec.recipient,
            shadow: spec.shadow,
            amount: questRule.award.amount,
            sourceId: weekStart,
            pairKey: null,
            atMs: spec.atMs,
            sourcePath: `quest:${quest.id}`,
            eventId: `${spec.eventId}:quest:${weekStart}`,
          }, working);
          if (questResult.awarded) {
            working = { ...questResult.state, quest: { ...questResult.state.quest, questId: quest.id, weekStart, progress: working.quest.progress, target: working.quest.target } };
            working.questCompletedAt = Timestamp.fromMillis(nowMs);
            tx.set(store.projectionRef(spec.recipient, spec.shadow), projectionDoc(working, FieldValue.serverTimestamp()), { merge: true });
          }
        }
      }
    } else if (state.quest.weekStart !== weekStart) {
      working = { ...working, quest: { questId: quest.id, weekStart, progress: 0, target: quest.parts.reduce((sum, part) => sum + part.target, 0) } };
    }
  }

  if (weekStart === weekStartOf(nowMs, timezone) && ruleSet.streakRules.qualifyingEvents.includes(spec.rule.event)) {
    working = markQualified(tx, core, spec.recipient, spec.shadow, weekStart, working);
  }
  tx.set(store.projectionRef(spec.recipient, spec.shadow), projectionDoc(working, FieldValue.serverTimestamp()), { merge: true });
  return { ...result, state: working };
}

/** Marks the member's streak week qualified (idempotent per weekStart counter). */
export function markQualified(
  tx: EngineTransaction,
  core: EngineCore,
  uid: string,
  shadow: boolean,
  weekStart: string,
  state: ProjectionState,
): ProjectionState {
  const ref = core.store.counterRef(uid, shadow, `qualweek:${weekStart}`);
  tx.set(ref, { count: 1, updatedAt: weekStart });
  const working = { ...state, streak: { ...state.streak, qualifiedThisWeek: true } };
  tx.set(core.store.projectionRef(uid, shadow), projectionDoc(working, FieldValue.serverTimestamp()), { merge: true });
  return working;
}

// ---------------------------------------------------------------------------
// processEvent: one event, one transaction.
// ---------------------------------------------------------------------------

export type ProcessEventInput = {
  event: GamEvent;
  facts: GamFacts;
};

export type ProcessEventOutcome = {
  awards: number;
  holds: number;
  /** Per recipient: the day's totals, used after the transaction for velocity. */
  velocity: Map<string, { day: string; dailyEarnTotal: number; conversationsToday: number }>;
};

export async function processEvent(input: ProcessEventInput, deps: EngineDeps): Promise<ProcessEventOutcome> {
  const flags = await deps.flags.getFlags();
  if (!engineEnabled(flags)) return { awards: 0, holds: 0, velocity: new Map() };
  const ruleSet = await deps.rules.loadActive();
  const core: EngineCore = { store: deps.store, flags, ruleSet, now: deps.now };
  const timezone = ruleSet.streakRules.timezone;
  const atMs = input.event.at.toMillis();
  const day = isoDateInZone(atMs, timezone);

  type Candidate = {
    rule: GamRule;
    recipient: string;
    shadow: boolean;
    amount: number;
    sourceId: string;
    pairKey: string | null;
  };
  const outcome = await deps.store.runTransaction(async (tx) => {
    const velocity = new Map<string, { day: string; dailyEarnTotal: number; conversationsToday: number }>();
    if (!GAM_EARN_EVENTS.some((event) => event === input.event.kind)) {
      return { awards: 0, holds: 0, velocity };
    }
    const pair = input.event.pairKey?.split('_') ?? [];
    const participants = pair.length === 2 && pair.includes(input.event.uid) ? pair : [input.event.uid];
    const accountState = new Map<string, boolean>();
    await Promise.all(participants.map(async (uid) => {
      const [account, preference] = await tx.getAll(
        deps.store.firestore.doc(`users/${uid}`), deps.store.firestore.doc(`gamPreferences/${uid}`),
      );
      accountState.set(uid, account.exists && preference.get('optedOut') !== true);
    }));
    if (input.event.pairKey !== undefined) {
      const match = await tx.get(deps.store.firestore.doc(`matches/${input.event.pairKey}`));
      const createdAt: unknown = match.get('createdAt');
      if (!(createdAt instanceof Timestamp) || createdAt.toMillis() > atMs) return { awards: 0, holds: 0, velocity };
    }

    const normalized = await Promise.all(participants.filter((uid) => accountState.get(uid)).map(async (uid) => {
      const key = documentKey(`${input.event.kind}:${input.event.eventId}`);
      const activity = deps.store.firestore.doc(`gamEvents/${uid}/gamActivity/${key}`);
      return { activity, uid, existing: (await tx.get(activity)).exists };
    }));
    const facts = Object.fromEntries(Object.entries(input.facts).filter(([, value]) => Number.isFinite(value)));
    for (const { activity, uid, existing } of normalized) {
      if (!existing) tx.create(activity, {
        event: input.event.kind,
        at: input.event.at,
        expireAt: Timestamp.fromMillis(atMs + 30 * 86_400_000),
        actor: uid === input.event.uid,
        pairKey: input.event.pairKey === undefined ? null : deps.store.pairBucketKey(input.event.pairKey),
        facts,
        arm: armFor(uid, flags.experimentPct),
      });
    }

    const rules = ruleSet.earnRules.filter((rule) => rule.event === input.event.kind);
    const candidates: Candidate[] = [];
    for (const rule of rules) {
      if (!applyConditions(rule.conditions, input.facts)) continue;
      for (const recipient of awardRecipients(rule, input.event)) {
        const shadow = shadowTarget(flags, recipient);
        if (rule.audience?.experiment !== undefined && rule.audience?.arm !== undefined
          && armFor(recipient, flags.experimentPct) !== rule.audience.arm) continue;
        const sourceId = resolveSourceId(rule, input.event, ruleSet);
        if (sourceId === null) continue;
        const multiplier = campaignMultiplier(ruleSet.campaigns, rule.event, day, armFor(recipient, flags.experimentPct));
        candidates.push({
          rule,
          recipient,
          shadow,
          amount: rule.award.amount * multiplier,
          sourceId,
          pairKey: input.event.pairKey ?? null,
        });
      }
    }
    if (candidates.length === 0) return { awards: 0, holds: 0, velocity };

    const states = new Map<string, ProjectionState>();
    await Promise.all([...new Set(candidates.map((candidate) => candidate.recipient))].map(async (recipient) => {
      if (!accountState.get(recipient)) return;
      const snapshot = await tx.get(deps.store.projectionRef(recipient, shadowTarget(flags, recipient)));
      states.set(recipient, parseProjection(snapshot.data()));
    }));

    let awards = 0;
    let holds = 0;
    for (const candidate of candidates) {
      const state = states.get(candidate.recipient);
      if (state === undefined || !normalized.some((record) => record.uid === candidate.recipient && !record.existing)) continue;
      const spec: AwardSpec = {
        rule: candidate.rule,
        recipient: candidate.recipient,
        shadow: candidate.shadow,
        amount: candidate.amount,
        sourceId: candidate.sourceId,
        pairKey: candidate.pairKey,
        atMs,
        sourcePath: input.event.source,
        eventId: input.event.eventId,
      };
      if (candidate.rule.hold !== undefined) {
        const holdRef = deps.store.holdRef(candidate.recipient, candidate.shadow, candidate.rule.id, pairBucketFor(deps.store, candidate.rule, candidate.pairKey) ?? candidate.sourceId);
        const [holdSnap, existingAward, caps] = await Promise.all([
          tx.get(holdRef),
          tx.get(deps.store.ledgerRef(candidate.recipient, candidate.shadow, ledgerEntryId(candidate.rule.id, candidate.sourceId, candidate.recipient))),
          readCaps(tx, deps.store, spec, pairBucketFor(deps.store, candidate.rule, candidate.pairKey), day, weekStartOf(atMs, timezone), atMs),
        ]);
        if (holdSnap.exists || existingAward.exists || !caps.ok) continue;
        tx.set(holdRef, {
          amount: candidate.amount,
          releaseAt: Timestamp.fromMillis(atMs + candidate.rule.hold.hours * 3_600_000),
          updatedAt: new Date(deps.now()).toISOString(),
          at: input.event.at,
          sourceId: candidate.sourceId,
          ruleId: candidate.rule.id,
          event: candidate.rule.event,
          path: input.event.source,
          eventId: input.event.eventId,
          ...(candidate.pairKey !== null ? { pairKey: candidate.pairKey } : {}),
        });
        writeCapIncrements(tx, candidate.rule.caps, caps.buckets, candidate.rule.id,
          pairBucketFor(deps.store, candidate.rule, candidate.pairKey), day, weekStartOf(atMs, timezone), atMs);
        tx.set(deps.store.metricsRef(day), { held: FieldValue.increment(1) }, { merge: true });
        holds += 1;
        continue;
      }
      const result = await applyAward(tx, core, spec, state);
      states.set(candidate.recipient, result.state);
      if (result.awarded) {
        awards += 1;
        const current = velocity.get(candidate.recipient);
        velocity.set(candidate.recipient, {
          day,
          dailyEarnTotal: Math.max(current?.dailyEarnTotal ?? 0, result.dailyEarnTotal),
          conversationsToday: Math.max(current?.conversationsToday ?? 0, result.conversationsToday),
        });
      }
    }
    if (normalized.some(({ existing }) => !existing)) {
      tx.set(deps.store.metricsRef(day), { events: FieldValue.increment(1) }, { merge: true });
    }
    return { awards, holds, velocity };
  });

  if (deps.velocityAlert !== undefined) {
    for (const [uid, totals] of outcome.velocity) {
      for (const kind of velocityBreaches(totals.dailyEarnTotal, totals.conversationsToday)) {
        await deps.velocityAlert(kind, uid, totals.day);
      }
    }
  }
  return outcome;
}

// ---------------------------------------------------------------------------
// Hold release (weekly job and reply-triggered releases).
// ---------------------------------------------------------------------------

export type ReleaseOutcome = 'released' | 'void' | 'pending' | 'missing';

/**
 * Releases one matured hold into a real award. `otherReplied` releases early
 * without safety reads (a report that landed before the reply already voided the
 * hold; one that lands after is a clawback). Matured no_report_no_block holds
 * re-check the pair's reports and blocks and void when anything landed.
 */
export async function releaseHold(
  core: EngineCore,
  uid: string,
  shadow: boolean,
  rule: GamRule,
  sourceId: string,
  force: boolean,
): Promise<ReleaseOutcome> {
  const holdRef = core.store.holdRef(uid, shadow, rule.id, sourceId);
  return core.store.runTransaction(async (tx) => {
    const holdSnap = await tx.get(holdRef);
    if (!holdSnap.exists) return 'missing' as const;
    const hold = holdSnap.data();
    if (!hold || !(hold.releaseAt instanceof Timestamp)) {
      tx.delete(holdRef);
      return 'void' as const;
    }
    const matured = core.now() >= hold.releaseAt.toMillis();
    if (!matured && !(force && rule.hold?.releaseIf === 'other_replied')) return 'pending' as const;

    const pairKey = typeof hold.pairKey === 'string' ? hold.pairKey : null;
    if (pairKey !== null) {
      const [first, second] = pairKey.split('_');
      const firestore = core.store.firestore;
      const safety = await tx.getAll(
        firestore.doc(`matches/${pairKey}`),
        firestore.doc(`reports/${first}_${second}`),
        firestore.doc(`reports/${second}_${first}`),
        firestore.doc(`blocks/${first}/by/${second}`),
        firestore.doc(`blocks/${second}/by/${first}`),
      );
      if (!safety[0].exists || safety.slice(1).some((snapshot) => snapshot.exists)) {
        tx.delete(holdRef);
        tx.set(core.store.metricsRef(isoDateInZone(core.now(), core.ruleSet.streakRules.timezone)),
          { holdsVoided: FieldValue.increment(1) }, { merge: true });
        return 'void' as const;
      }
    }

    const [account, preference, projectionSnap] = await tx.getAll(
      core.store.firestore.doc(`users/${uid}`), core.store.firestore.doc(`gamPreferences/${uid}`),
      core.store.projectionRef(uid, shadow),
    );
    if (!account.exists || preference.get('optedOut') === true) {
      tx.delete(holdRef);
      return 'void' as const;
    }
    const state = parseProjection(projectionSnap.data());
    const result = await applyAward(tx, core, {
      rule,
      recipient: uid,
      shadow,
      amount: typeof hold.amount === 'number' ? hold.amount : 0,
      sourceId: typeof hold.sourceId === 'string' ? hold.sourceId : sourceId,
      capsReserved: true,
      pairKey,
      atMs: hold.at instanceof Timestamp ? hold.at.toMillis() : core.now(),
      sourcePath: typeof hold.path === 'string' ? hold.path : '',
      eventId: typeof hold.eventId === 'string' ? hold.eventId : '',
    }, state);
    if (!result.awarded) {
      // The award was already paid by another path or fell to a cap: drop the hold.
      tx.delete(holdRef);
      return 'void' as const;
    }
    tx.delete(holdRef);
    tx.set(core.store.metricsRef(isoDateInZone(core.now(), core.ruleSet.streakRules.timezone)),
      { released: FieldValue.increment(1) }, { merge: true });
    return 'released' as const;
  });
}
