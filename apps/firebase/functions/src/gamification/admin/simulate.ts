import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { applyConditions, campaignMultiplier } from '../engine/evaluator';
import type { GamFacts } from '../engine/normalizers';
import { FirestoreRuleSetLoader } from '../engine/ruleset-loader';
import { isoDateInZone, weekStartOf } from '../engine/weeks';
import { GAM_EARN_EVENTS, type GamEarnEvent, type GamRuleSet } from '../model';
import { validateRuleSet } from '../ruleset';
import type { GamAdminActor } from './guard';
import { isRecord, reqRecord } from './request';

export const SIMULATION_WINDOW_DAYS = 14;
const MAX_EVENTS = 10_000;

export type SimEvent = {
  id: string;
  uid: string;
  event: GamEarnEvent;
  atMs: number;
  pairKey: string | null;
  actor: boolean;
  arm: 'control' | 'treatment';
  facts: GamFacts;
};

function replaySource(idempotencyKey: string, event: SimEvent, week: string) {
  if (idempotencyKey.includes('{matchId}')) return event.pairKey ?? event.id;
  if (idempotencyKey.includes('{weekStart}')) return week;
  if (idempotencyKey.includes('{uid}') && event.event !== 'profile.prompt_refreshed') return event.uid;
  return event.id;
}

/** Replays recent verified source events. Caps start at the start of the sample window
 * and the projection excludes delayed release outcomes, reversals and prior lifetime history. */
export function simulateRuleSet(ruleSet: GamRuleSet, events: SimEvent[], windowDays: number) {
  const counters = new Map<string, number>();
  const lastAwardAt = new Map<string, number>();
  const recipients = new Map<string, number>();
  const perRule = new Map<string, { ruleId: string; awards: number; cravos: number }>();
  const dedupe = new Set<string>();
  const timeZone = ruleSet.streakRules.timezone;
  let awards = 0;
  let cravos = 0;

  for (const event of [...events].sort((a, b) => a.atMs - b.atMs || a.id.localeCompare(b.id))) {
    if (!recipients.has(event.uid)) recipients.set(event.uid, 0);
    const day = isoDateInZone(event.atMs, timeZone);
    const week = weekStartOf(event.atMs, timeZone);
    for (const rule of ruleSet.earnRules) {
      if (rule.event !== event.event || !applyConditions(rule.conditions, event.facts) ||
        (rule.award.to !== 'both_participants' && !event.actor) ||
        (rule.audience?.arm !== undefined && rule.audience.arm !== event.arm)) continue;

      const key = `${event.uid}:${rule.id}`;
      const awardKey = `${key}:${replaySource(rule.idempotencyKey, event, week)}`;
      if (dedupe.has(awardKey)) continue;
      const pair = event.pairKey;
      const limits: Array<[string, number | undefined]> = [
        [`${key}:d:${day}`, rule.caps.perDay],
        [`${key}:w:${week}`, rule.caps.perWeek],
        [`${key}:month-window`, rule.caps.per30Days],
        [`${key}:life`, rule.caps.lifetime],
      ];
      if (pair !== null) limits.push(
        [`${key}:pair:${pair}`, rule.caps.perPairLifetime],
        [`${key}:pair:${pair}:d:${day}`, rule.caps.perPairPerDay],
      );
      if (limits.some(([cap, maximum]) => maximum !== undefined && (counters.get(cap) ?? 0) >= maximum)) continue;
      const gapKey = `${key}:gap:${pair}`;
      const last = lastAwardAt.get(gapKey);
      if (pair !== null && rule.caps.minGapHours !== undefined && last !== undefined &&
        event.atMs - last < rule.caps.minGapHours * 3_600_000) continue;

      const amount = rule.award.amount * campaignMultiplier(ruleSet.campaigns, rule.event, day, event.arm);
      awards += 1;
      cravos += amount;
      recipients.set(event.uid, (recipients.get(event.uid) ?? 0) + amount);
      const summary = perRule.get(rule.id) ?? { ruleId: rule.id, awards: 0, cravos: 0 };
      perRule.set(rule.id, { ...summary, awards: summary.awards + 1, cravos: summary.cravos + amount });
      dedupe.add(awardKey);
      for (const [cap] of limits) counters.set(cap, (counters.get(cap) ?? 0) + 1);
      lastAwardAt.set(gapKey, event.atMs);
    }
  }

  const monthly = [...recipients.values()].map((total) => Math.round(total * 30 / windowDays)).sort((a, b) => a - b);
  const middle = Math.floor(monthly.length / 2);
  const groups = (members: number[]) => ({
    members: members.length,
    projectedMonthly: members.length ? Math.round(members.reduce((sum, amount) => sum + amount, 0) / members.length) : null,
  });
  return {
    windowDays, events: events.length, awards, cravos, members: recipients.size,
    casual: groups(monthly.slice(0, Math.ceil(monthly.length / 2))),
    engaged: groups(monthly.slice(monthly.length > 1 ? Math.ceil(monthly.length / 2) : middle + 1)),
    perRule: [...perRule.values()].sort((a, b) => b.cravos - a.cravos),
  };
}

export async function simulateFromStore(firestore: Firestore, actor: GamAdminActor, data: unknown) {
  void actor;
  let ruleSet: GamRuleSet;
  try {
    ruleSet = validateRuleSet(reqRecord(data).ruleSet);
  } catch (error) {
    throw new HttpsError('invalid-argument', error instanceof Error ? error.message : 'The rule set is not valid.');
  }

  const cutoff = Timestamp.fromMillis(Date.now() - SIMULATION_WINDOW_DAYS * 86_400_000);
  const [captured, active] = await Promise.all([
    firestore.collectionGroup('gamActivity').where('at', '>=', cutoff).orderBy('at').limit(MAX_EVENTS + 1).get(),
    new FirestoreRuleSetLoader(firestore).loadActive(),
  ]);
  const normalized = captured.docs.slice(0, MAX_EVENTS).flatMap((doc): SimEvent[] => {
    const uid = doc.ref.parent.parent?.id;
    const raw = doc.data();
    const event = GAM_EARN_EVENTS.find((candidate) => candidate === raw.event);
    if (!uid || event === undefined || !(raw.at instanceof Timestamp) || !isRecord(raw.facts)) return [];
    const facts = Object.fromEntries(Object.entries(raw.facts).flatMap(([key, value]) =>
      typeof value === 'number' ? [[key, value]] : []));
    return [{
      id: doc.id, uid, event, facts, atMs: raw.at.toMillis(), actor: raw.actor === true,
      pairKey: typeof raw.pairKey === 'string' ? raw.pairKey : null, arm: raw.arm === 'treatment' ? 'treatment' : 'control',
    }];
  });
  return {
    source: 'verified_activity',
    truncated: captured.size > MAX_EVENTS,
    active: simulateRuleSet(active, normalized, SIMULATION_WINDOW_DAYS),
    draft: simulateRuleSet(ruleSet, normalized, SIMULATION_WINDOW_DAYS),
  };
}
