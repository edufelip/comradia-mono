// The simulator (spec §9): replays the last 14 days of recorded Cravos events — the
// shadow ledger first, the live ledger when the shadow phase has no data — against a
// draft rule set, and projects each member's monthly Cravos. The evaluator is pure and
// heavily unit-tested; the engine folder does not exist yet on this branch, so events are
// re-awarded from the draft's rules directly (a limitation, kept honest in the docs):
//
// - Matching is by ruleId: the recorded entries already passed their rule's conditions
//   when they happened, and facts are not stored, so conditions are assumed to hold.
//   A rule deleted from the draft simply stops awarding; a NEW rule has no recorded
//   events to replay, so it never inflates the projection.
// - Holds, clawbacks, audiences and quests are not replayed: holds only delay release,
//   and clawbacks need trigger events the ledger does not record.
// - Campaign multipliers DO apply, from each event's calendar date.
import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import type { GamEarnEvent, GamRuleSet } from '../model';
import { validateRuleSet } from '../ruleset';
import { appendAudit, AUDIT_ACTIONS } from './audit';
import { isRecord, optionalString, reqRecord } from './request';
import type { GamAdminActor } from './guard';

export const SIMULATION_WINDOW_DAYS = 14;

export type SimEvent = {
  uid: string;
  ruleId: string;
  event: string;
  at: Date;
  pairKey: string | null;
};

export type SimRuleTotal = { ruleId: string; awards: number; cravos: number };

export type SimPersona = { members: number; projectedMonthly: number };

export type SimResult = {
  windowDays: number;
  events: number;
  awards: number;
  cravos: number;
  members: number;
  /** Above-median projected monthly Cravos (the "engaged" persona of spec §4). */
  engaged: SimPersona;
  /** Everyone at or below the median (the "casual" persona). */
  casual: SimPersona;
  perRule: SimRuleTotal[];
};

function dayKey(at: Date): string {
  return at.toISOString().slice(0, 10);
}

/** Monday-start UTC week key. shortcut: the projection ignores the streak timezone;
 * a weekly cap shifted by a few hours does not change a monthly estimate. */
function weekKey(at: Date): string {
  const day = at.getUTCDay();
  const monday = new Date(at);
  monday.setUTCDate(monday.getUTCDate() - ((day + 6) % 7));
  return dayKey(monday);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Multiplies `amount` when the date falls inside a campaign that targets the event. */
function campaignMultiplier(ruleSet: GamRuleSet, event: string, on: string): number {
  let multiplier = 1;
  for (const campaign of ruleSet.campaigns) {
    if (on < campaign.startsOn || on > campaign.endsOn) continue;
    if (campaign.appliesTo !== undefined && !campaign.appliesTo.includes(event as GamEarnEvent)) continue;
    if (campaign.multiplier !== undefined) multiplier *= campaign.multiplier;
  }
  return multiplier;
}

export function simulateRuleSet(ruleSet: GamRuleSet, events: SimEvent[], windowDays: number): SimResult {
  const rulesById = new Map(ruleSet.earnRules.map((rule) => [rule.id, rule]));
  const perUid = new Map<string, number>();
  const perRule = new Map<string, SimRuleTotal>();
  const counters = new Map<string, number>();
  const lastAwardAt = new Map<string, Date>();
  let awards = 0;
  let cravos = 0;
  const ordered = [...events].sort((a, b) => a.at.getTime() - b.at.getTime());
  for (const event of ordered) {
    const rule = rulesById.get(event.ruleId);
    if (!rule) continue;
    const caps = rule.caps;
    const day = dayKey(event.at);
    const uidRule = `${event.uid}:${rule.id}`;
    const pair = event.pairKey ?? event.uid;
    if (caps.perDay !== undefined
      && (counters.get(`d:${uidRule}:${day}`) ?? 0) >= caps.perDay) continue;
    if (caps.perWeek !== undefined
      && (counters.get(`w:${uidRule}:${weekKey(event.at)}`) ?? 0) >= caps.perWeek) continue;
    // shortcut: the window is 14 days, so a per-30-days cap is counted over the whole
    // replay window; correct while the simulator keeps a two-week window.
    if (caps.per30Days !== undefined
      && (counters.get(`m:${uidRule}`) ?? 0) >= caps.per30Days) continue;
    if (caps.lifetime !== undefined
      && (counters.get(`l:${uidRule}`) ?? 0) >= caps.lifetime) continue;
    if (caps.perPairLifetime !== undefined
      && (counters.get(`pl:${pair}:${rule.id}`) ?? 0) >= caps.perPairLifetime) continue;
    if (caps.perPairPerDay !== undefined
      && (counters.get(`pd:${pair}:${rule.id}:${day}`) ?? 0) >= caps.perPairPerDay) continue;
    if (caps.minGapHours !== undefined) {
      const last = lastAwardAt.get(`g:${pair}:${rule.id}`);
      if (last !== undefined && event.at.getTime() - last.getTime() < caps.minGapHours * 3_600_000) continue;
    }
    const amount = rule.award.amount * campaignMultiplier(ruleSet, rule.event, day);
    awards += 1;
    cravos += amount;
    perUid.set(event.uid, (perUid.get(event.uid) ?? 0) + amount);
    const ruleTotal = perRule.get(rule.id) ?? { ruleId: rule.id, awards: 0, cravos: 0 };
    perRule.set(rule.id, { ruleId: rule.id, awards: ruleTotal.awards + 1, cravos: ruleTotal.cravos + amount });
    for (const [key, delta] of [
      [`d:${uidRule}:${day}`, 1],
      [`w:${uidRule}:${weekKey(event.at)}`, 1],
      [`m:${uidRule}`, 1],
      [`l:${uidRule}`, 1],
      [`pl:${pair}:${rule.id}`, 1],
      [`pd:${pair}:${rule.id}:${day}`, 1],
    ] as Array<[string, number]>) {
      counters.set(key, (counters.get(key) ?? 0) + delta);
    }
    lastAwardAt.set(`g:${pair}:${rule.id}`, event.at);
  }
  const projected = [...perUid.values()].map((total) => Math.round(total * 30 / windowDays));
  const cut = median(projected);
  const engaged = projected.filter((value) => value > cut);
  const casual = projected.filter((value) => value <= cut);
  return {
    windowDays,
    events: ordered.length,
    awards,
    cravos,
    members: perUid.size,
    engaged: { members: engaged.length, projectedMonthly: engaged.length === 0 ? 0 : Math.round(engaged.reduce((a, b) => a + b, 0) / engaged.length) },
    casual: { members: casual.length, projectedMonthly: casual.length === 0 ? 0 : Math.round(casual.reduce((a, b) => a + b, 0) / casual.length) },
    perRule: [...perRule.values()].sort((a, b) => b.cravos - a.cravos),
  };
}

// ---------------------------------------------------------------------------
// Event source: the shadow ledger first, the live member ledger when shadow is empty.
// ---------------------------------------------------------------------------

/** shortcut: replays at most MAX_MEMBERS members and their newest MAX_ENTRIES_PER_MEMBER
 * ledger entries, so the callable's cost stays bounded; raise them when the tool needs
 * fuller history. */
const MAX_MEMBERS = 200;
const MAX_ENTRIES_PER_MEMBER = 100;

function readEvent(
  root: string,
  uid: string,
  entryId: string,
  data: { [field: string]: unknown },
  cutoff: Date,
): SimEvent | null {
  const source = data.source;
  if (data.kind !== 'earn') return null;
  if (typeof data.ruleId !== 'string' || data.ruleId.length === 0) {
    throw new HttpsError('internal', `${root}/${uid}/ledger/${entryId} is not a valid ledger entry.`);
  }
  if (!isRecord(source) || typeof source.event !== 'string' || typeof source.path !== 'string') {
    throw new HttpsError('internal', `${root}/${uid}/ledger/${entryId} has no valid source.`);
  }
  if (!(data.createdAt instanceof Timestamp)) {
    throw new HttpsError('internal', `${root}/${uid}/ledger/${entryId} has no createdAt.`);
  }
  const at = data.createdAt.toDate();
  if (at.getTime() < cutoff.getTime()) return null;
  const pairMatch = /^matches\/([^/]+)$/.exec(source.path);
  return {
    uid,
    ruleId: data.ruleId,
    event: source.event,
    at,
    pairKey: pairMatch !== null ? pairMatch[1] : null,
  };
}

async function readEvents(firestore: Firestore, root: string, cutoff: Date): Promise<SimEvent[]> {
  const memberSnaps = await firestore.collection(root).limit(MAX_MEMBERS).get();
  const events: SimEvent[] = [];
  for (const member of memberSnaps.docs) {
    const entrySnaps = await firestore
      .collection(`${root}/${member.id}/ledger`)
      .orderBy('createdAt', 'desc')
      .limit(MAX_ENTRIES_PER_MEMBER)
      .get();
    for (const entry of entrySnaps.docs) {
      const event = readEvent(root, member.id, entry.id, entry.data(), cutoff);
      if (event !== null) events.push(event);
    }
  }
  return events;
}

export type SimulateResult = SimResult & { source: 'shadow' | 'ledger' };

export async function simulateFromStore(
  firestore: Firestore,
  actor: GamAdminActor,
  data: unknown,
): Promise<SimulateResult> {
  const request = reqRecord(data);
  let ruleSet: GamRuleSet;
  try {
    ruleSet = validateRuleSet(request.ruleSet);
  } catch (error) {
    throw new HttpsError(
      'invalid-argument',
      error instanceof Error ? error.message : 'The rule set is not valid.',
    );
  }
  const cutoff = new Date(Date.now() - SIMULATION_WINDOW_DAYS * 24 * 3_600_000);
  let events = await readEvents(firestore, 'gamShadow', cutoff);
  let source: 'shadow' | 'ledger' = 'shadow';
  if (events.length === 0) {
    events = await readEvents(firestore, 'gamification', cutoff);
    source = 'ledger';
  }
  const result = simulateRuleSet(ruleSet, events, SIMULATION_WINDOW_DAYS);
  const ruleSetId = optionalString(request, 'ruleSetId');
  if (ruleSetId !== undefined) {
    const ref = firestore.doc(`gamRuleSets/${ruleSetId}`);
    await firestore.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new HttpsError('not-found', `Rule set ${ruleSetId} does not exist.`);
      const stored = validateRuleSet(snap.data() ?? {});
      if (stored.status !== 'draft' && stored.status !== 'simulated') {
        throw new HttpsError(
          'failed-precondition',
          `Only a draft can be marked simulated (v${stored.version} is ${stored.status}).`,
        );
      }
      if (stored.version !== ruleSet.version) {
        throw new HttpsError(
          'failed-precondition',
          `Version drift: the stored draft is v${stored.version}; reload and simulate that.`,
        );
      }
      tx.set(ref, { ...stored, status: 'simulated' });
    });
    await appendAudit(firestore, {
      actor: actor.uid,
      action: AUDIT_ACTIONS.simulate,
      reason: 'Simulated against the recorded events.',
      target: ruleSetId,
    });
  }
  return { ...result, source };
}