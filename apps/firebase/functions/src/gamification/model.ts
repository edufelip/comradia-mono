// Server-side mirror of the Cravos data contract in
// apps/mobile/features/gamification/model.ts. The engine deploys without the mobile
// app, so the shared constants and document shapes are duplicated here;
// apps/firebase/tests/gamification-parity.test.ts fails when the two copies drift.
// Pure TypeScript apart from the type-only Timestamp import.
import type { Timestamp } from 'firebase-admin/firestore';

/** Instants are Firestore Timestamps (repo convention; firestore.rules checks `seenAt is
 *  timestamp`). Calendar dates (YYYY-MM-DD) stay strings. */
export type GamTimestamp = Timestamp;

export const GAM_LEDGER_KINDS = [
  'earn',
  'clawback',
  'expire',
  'redeem',
  'refund',
  'adjust',
] as const;
export type GamLedgerKind = (typeof GAM_LEDGER_KINDS)[number];

export const GAM_EARN_EVENTS = [
  'conversation.started',
  'conversation.sustained',
  'message.first_in_match',
  'message.timely_reply',
  'match.created',
  'profile.photo_added',
  'profile.prompt_refreshed',
  'streak.week_completed',
  'streak.milestone',
  'quest.completed',
] as const;
export type GamEarnEvent = (typeof GAM_EARN_EVENTS)[number];

export const GAM_CELEBRATION_KINDS = ['toast', 'fullscreen'] as const;
export type GamCelebrationKind = (typeof GAM_CELEBRATION_KINDS)[number];

export const GAM_LEVELS = [
  { id: 'botao', threshold: 0 },
  { id: 'flor', threshold: 300 },
  { id: 'ramalhete', threshold: 1000 },
  { id: 'jardim', threshold: 2500 },
  { id: 'primavera', threshold: 5000 },
] as const;
export type GamLevel = (typeof GAM_LEVELS)[number];
export type GamLevelId = GamLevel['id'];

export const GAM_ACHIEVEMENT_KINDS = [
  'progress',
  'streak',
  'active',
  'seasonal',
  'campaign',
] as const;
export type GamAchievementKind = (typeof GAM_ACHIEVEMENT_KINDS)[number];

export const GAM_ACHIEVEMENTS = [
  { id: 'faisca', kind: 'progress', tiers: [1, 5, 20] },
  { id: 'papo', kind: 'progress', tiers: [1, 5, 15] },
  { id: 'passo', kind: 'progress', tiers: [3, 10, 30] },
  { id: 'vacuo', kind: 'progress', tiers: [10, 50, 200] },
  { id: 'constancia', kind: 'streak', tiers: [4, 12, 26] },
  { id: 'cartao', kind: 'progress', tiers: [1, 3, 6] },
  { id: 'roda', kind: 'active', tiers: [1, 3, 6] },
  { id: 'escuta', kind: 'active', tiers: [5, 10, 20] },
  { id: 'primavera', kind: 'seasonal', tiers: [3, 6, 12] },
  { id: 'maio', kind: 'campaign', tiers: [2, 4, 8] },
  { id: 'namorados', kind: 'seasonal', tiers: [1, 2, 3] },
] as const;
export type GamAchievement = (typeof GAM_ACHIEVEMENTS)[number];
export type GamAchievementId = GamAchievement['id'];

// ---------------------------------------------------------------------------
// Client-visible document shapes (paths and writers: docs/gamification/data-model.md).
// Instants are Firestore Timestamps (GamTimestamp); calendar dates are YYYY-MM-DD strings.
// ---------------------------------------------------------------------------

/** gamification/{uid}: the projection the engine rebuilds from the ledger. */
export type GamProjection = {
  balance: number;
  lifetimeNet: number;
  levelHighWaterMark: number;
  levelId: GamLevelId;
  streak: GamStreakState;
  quest: GamQuestState;
  updatedAt: GamTimestamp;
};

export type GamStreakState = {
  currentWeeks: number;
  recordWeeks: number;
  qualifiedThisWeek: boolean;
  pauseBank: number;
  pausedUntil: GamTimestamp | null;
};

export type GamQuestState = {
  questId: string | null;
  weekStart: string;
  progress: number;
  target: number;
  completedAt: GamTimestamp | null;
};

/** gamification/{uid}/ledger/{idempotencyKey}: append-only. */
export type GamLedgerEntry = {
  track: 'cravos';
  kind: GamLedgerKind;
  amount: number;
  ruleId: string;
  ruleSetVersion: number;
  source: { event: string; path: string; eventId: string };
  lot?: { expiresAt: GamTimestamp };
  actor: 'system' | 'admin';
  actorUid?: string;
  reason?: string;
  createdAt: GamTimestamp;
};

/** gamification/{uid}/celebrations/{id}: the owner may update only `seenAt`. */
export type GamCelebration = {
  kind: GamCelebrationKind;
  copyKey: string;
  amount?: number;
  achievementId?: GamAchievementId;
  achievementTier?: number;
  levelId?: GamLevelId;
  createdAt: GamTimestamp;
  seenAt: GamTimestamp | null;
};

/** gamification/{uid}/achievements/{achievementId}. */
export type GamUserAchievement = {
  tier: number;
  unlockedAt: GamTimestamp;
  status: 'unlocked' | 'lapsed';
  updatedAt: GamTimestamp;
};

/** gamification/{uid}/lots/{id}. */
export type GamLot = {
  amount: number;
  earnedAt: GamTimestamp;
  expiresAt: GamTimestamp;
  sourceLedgerId: string;
};

/** catalog/{itemId}. */
export type GamCatalogItem = {
  title: string;
  description: string;
  priceCravos: number;
  kind: 'partner_funded' | 'app_perk' | 'drop' | 'give';
  partner: string | null;
  stock: number | null;
  active: boolean;
};

/** redemptions/{id}. */
export type GamRedemption = {
  uid: string;
  itemId: string;
  status: 'pending' | 'fulfilled' | 'failed';
  cravos: number;
  redeemEntryIds: string[];
  code: string | null;
  createdAt: GamTimestamp;
  fulfilledAt: GamTimestamp | null;
};

// ---------------------------------------------------------------------------
// Server-only shapes. No security rule allows any client read or write here.
// ---------------------------------------------------------------------------

/**
 * A derived event, computed only on the server from documents the rules already
 * validate. `kind` is an earn event for awards or a trigger event for clawbacks;
 * `source` is the Firestore path of the document that produced it and `eventId` the
 * CloudEvent id, so retries stay idempotent.
 */
export type GamEvent = {
  kind: GamEarnEvent | GamTriggerEvent;
  uid: string;
  /** The match id (`{a}_{b}`) for pair-scoped rules. */
  pairKey?: string;
  source: string;
  eventId: string;
  at: GamTimestamp;
};

/** Documents whose creation can take Cravos back (spec §4 clawback column). */
export const GAM_TRIGGER_EVENTS = [
  'match.deleted',
  'report.upheld',
  'report.created',
  'block.created',
  'profile.photo_removed',
  'quest.part_clawed_back',
] as const;
export type GamTriggerEvent = (typeof GAM_TRIGGER_EVENTS)[number];

/** One earn rule, as edited in the admin and stored in `gamRuleSets` (spec §8 example). */
export type GamRule = {
  id: string;
  track: 'cravos';
  event: GamEarnEvent;
  award: { amount: number; to: 'both_participants' | 'sender' | 'owner' };
  /** Numeric facts the engine must verify before awarding. */
  conditions?: Array<{ fact: string; op: '>=' | '<=' | '==' | '>' | '<'; value: number }>;
  /** At least one cap per rule: that is what makes the program hard to farm. */
  caps: {
    perDay?: number;
    perWeek?: number;
    per30Days?: number;
    lifetime?: number;
    perPairLifetime?: number;
    perPairPerDay?: number;
    minGapHours?: number;
  };
  /** Awards sit in counters (not the ledger) until the hold releases. */
  hold?: { hours: number; releaseIf: 'no_report_no_block' | 'other_replied' };
  clawback?: Array<{
    on: GamTriggerEvent;
    withinDays?: number;
    scope?: 'match' | 'pair';
    /** Who loses the award: the reported person, or the one who was blocked. */
    party?: 'reported' | 'blocked';
  }>;
  /** Template for the ledger document id: `{ruleId}:{sourceId}:{uid}`. */
  idempotencyKey: string;
  celebration?: { kind: GamCelebrationKind; copyKey: string };
  audience?: { experiment?: string; arm?: string };
};

/** A weekly quest: every part done in the week completes it (25 Cravos via quest.completed). */
export type GamQuest = {
  id: string;
  copyKey: string;
  parts: Array<{ event: GamEarnEvent; target: number }>;
};

/** An achievement as configured in the rule set; ids and tiers match GAM_ACHIEVEMENTS. */
export type GamAchievementRule = {
  id: GamAchievementId;
  kind: GamAchievementKind;
  /** The event counted, or `campaign:{campaignId}` for dated campaigns. */
  src: string;
  tiers: number[];
  /** `active` achievements: rolling window in days (escuta) or weeks (roda). */
  windowDays?: number;
  windowWeeks?: number;
  windowNeedWeeks?: number;
  replyRatePct?: number;
  /** Required for seasonal and campaign achievements. */
  season?: { startsOn: string; endsOn: string };
};

/** Streak rules (spec §6): weekly, with pauses and no punishment. */
export type GamStreakRules = {
  timezone: string;
  weekStartsOn: 'monday';
  qualifyingEvents: string[];
  promptRefreshQualifiesEveryDays: number;
  pauseEarnEveryWeeks: number;
  /** Banked pause slots per level id (1 / 2 / 3 by level). */
  pauseBankByLevel: Record<GamLevelId, number>;
  maxPauseWeeks: number;
  milestonesWeeks: number[];
  reminder: { enabled: boolean; dayOfWeek: 'sunday'; hour: number; timezone: string };
};

/** A dated campaign; achievements and multipliers point at it by id. */
export type GamCampaign = {
  id: string;
  startsOn: string;
  endsOn: string;
  multiplier?: number;
  appliesTo?: GamEarnEvent[];
  audience?: { experiment?: string; arm?: string };
};

/** A level as edited in the admin; id and threshold must match GAM_LEVELS. */
export type GamLevelRule = {
  id: GamLevelId;
  /** Level names in pt-BR; the admin edits one per locale. */
  name: string;
  threshold: number;
};

/** gamRuleSets/{id}: versioned, editable without a release. */
export type GamRuleSet = {
  version: number;
  status: 'draft' | 'simulated' | 'published' | 'archived';
  parentVersion: number | null;
  author: string;
  notes: string;
  earnRules: GamRule[];
  quests: GamQuest[];
  achievements: GamAchievementRule[];
  streakRules: GamStreakRules;
  campaigns: GamCampaign[];
  levels: GamLevelRule[];
};

/** gamification/{uid}/counters/{bucket}: caps and windows, server only. */
export type GamCounterDoc = { count: number; updatedAt: string };

/** Same collection, bucket `hold:{ruleId}:{sourceId}`: an award waiting out its hold. */
export type GamHoldDoc = { amount: number; releaseAt: GamTimestamp; updatedAt: string };

/** gamAudit/{id}: who changed what, when, and why. Admin callables append. */
export type GamAuditEntry = {
  actor: string;
  action: string;
  reason: string;
  target?: string;
  /** Required on adjustments over 500 Cravos. */
  secondApprover?: string;
  createdAt: GamTimestamp;
};

/** gamConfig/active: the single active rule-set pointer; rollback re-points it. */
export type GamConfig = { ruleSetId: string; publishedAt: GamTimestamp; publishedBy: string };

/** gamAdjustments/{id}: a signed adjustment, awaiting a second approver when over 500. */
export type GamAdjustmentDoc = {
  uid: string;
  amount: number;
  reason: string;
  raisedBy: string;
  secondApproverUid?: string;
  status: 'pending' | 'applied' | 'rejected';
  createdAt: GamTimestamp;
};

/** gamMetrics/{day}: anonymized daily totals only; nothing member-identifying. */
export type GamMetricsDoc = Record<string, number>;

/** gamShadow/{uid} and gamShadow/{uid}/ledger/{id}: the shadow-phase mirror of the
 *  member-facing documents, written instead of `gamification/**` before the program
 *  is visible. Same shapes, server only. */
export type GamShadowProjection = GamProjection;
export type GamShadowEntry = GamLedgerEntry;

/** The ledger document id is the idempotency key, so a create() retry fails. */
export function ledgerEntryId(ruleId: string, sourceId: string, uid: string): string {
  return `${ruleId}:${sourceId}:${uid}`;
}

/** Clawback entries reverse one original entry, keyed off its id. */
export function clawbackEntryId(originalEntryId: string): string {
  return `clawback:${originalEntryId}`;
}
