// The Cravos data contract: the constant lists and document shapes every layer agrees on.
// apps/firebase/functions/src/gamification/model.ts mirrors them for the engine, and
// apps/firebase/tests/gamification-parity.test.ts fails when the two copies drift.
// Paths and who may write them: docs/gamification/data-model.md.
//
// Timestamps are ISO 8601 UTC strings and dates are YYYY-MM-DD, as in the spec's own
// examples. Pure TypeScript: no React, no Firebase imports.

/** What a ledger entry does to the balance. `adjust` is signed either way; see GamLedgerEntry. */
export const GAM_LEDGER_KINDS = [
  'earn',
  'clawback',
  'expire',
  'redeem',
  'refund',
  'adjust',
] as const;
export type GamLedgerKind = (typeof GAM_LEDGER_KINDS)[number];

/** The derived events that can earn Cravos (spec §4). Swipes, app opens, reports,
 *  blocks, invites and store ratings are deliberately absent: they never earn. */
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

/** How a celebration is presented. The engine picks `fullscreen` only when the session
 *  allowance is free; otherwise it downgrades to a toast and the moment waits in
 *  "Novidades". */
export const GAM_CELEBRATION_KINDS = ['toast', 'fullscreen'] as const;
export type GamCelebrationKind = (typeof GAM_CELEBRATION_KINDS)[number];

/** Levels come from lifetime net Cravos as a high-water mark, so they only go up. */
export const GAM_LEVELS = [
  { id: 'botao', threshold: 0 },
  { id: 'flor', threshold: 300 },
  { id: 'ramalhete', threshold: 1000 },
  { id: 'jardim', threshold: 2500 },
  { id: 'primavera', threshold: 5000 },
] as const;
export type GamLevel = (typeof GAM_LEVELS)[number];
export type GamLevelId = GamLevel['id'];

/** Achievement families (spec §7 / Appendix A). `active` achievements can lapse;
 *  `seasonal` and `campaign` ones run inside dated campaigns. */
export const GAM_ACHIEVEMENT_KINDS = [
  'progress',
  'streak',
  'active',
  'seasonal',
  'campaign',
] as const;
export type GamAchievementKind = (typeof GAM_ACHIEVEMENT_KINDS)[number];

/** The starter catalog. `tiers` are the bronze / silver / gold thresholds, ascending. */
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

/** gamification/{uid}: the projection the wallet reads. Rebuilt by folding the ledger;
 *  written only by Functions, so a member can never edit their own balance. */
export type GamProjection = {
  /** Spendable Cravos. A negative balance blocks redemption and is shown as 0 with a note. */
  balance: number;
  /** Earned minus clawbacks, plus signed adjustments. Redeem, expire and refund never
   *  touch it: spending is not un-earning. */
  lifetimeNet: number;
  /** The highest lifetimeNet ever seen; the level derives from this and never drops. */
  levelHighWaterMark: number;
  levelId: GamLevelId;
  streak: GamStreakState;
  quest: GamQuestState;
  updatedAt: string;
};

/** One week counts after a message in any match, the weekly quest, or a prompt answer
 *  refreshed at most once per 30 days. Pauses never read as a loss. */
export type GamStreakState = {
  /** Consecutive completed weeks (the live streak). */
  currentWeeks: number;
  /** Best-ever consecutive weeks; kept visible when the streak rests. */
  recordWeeks: number;
  /** A qualifying action already landed this week. */
  qualifiedThisWeek: boolean;
  /** Unused pause slots (1 / 2 / 3 banked by level). */
  pauseBank: number;
  /** ISO date up to which "Pausar" froze the streak (at most 12 weeks), or null. */
  pausedUntil: string | null;
};

/** Progress on this week's quest, from the active rule set. */
export type GamQuestState = {
  /** Active quest id, or null in a week with no quest. */
  questId: string | null;
  /** ISO date of the quest week's Monday (America/Sao_Paulo). */
  weekStart: string;
  progress: number;
  target: number;
  /** ISO timestamp of the quest.completed event, or null while open. */
  completedAt: string | null;
};

/**
 * gamification/{uid}/ledger/{idempotencyKey}: append-only. The document id is
 * `{ruleId}:{sourceId}:{uid}` (clawbacks: `clawback:{originalKey}`), so a retried
 * trigger can never pay twice. Entries are never updated or deleted, except by
 * account deletion; corrections are new signed `adjust` entries.
 */
export type GamLedgerEntry = {
  track: 'cravos';
  kind: GamLedgerKind;
  /** Signed: earn and refund are positive, clawback / expire / redeem negative,
   *  adjust either way. */
  amount: number;
  ruleId: string;
  /** The rule-set version that priced this entry, so a rollback never rewrites history. */
  ruleSetVersion: number;
  source: { event: string; path: string; eventId: string };
  /** Present on earns once redemption is on: this entry's Cravos expire with the lot. */
  lot?: { expiresAt: string };
  actor: 'system' | 'admin';
  /** Present when actor is 'admin'. */
  actorUid?: string;
  /** Required on adjustments; shown on the wallet's "Ajuste" rows. */
  reason?: string;
  createdAt: string;
};

/** gamification/{uid}/celebrations/{id}: how the client learns what was earned. The
 *  unseen ones feed the toast queue; seenAt is the one field the owner may write. */
export type GamCelebration = {
  kind: GamCelebrationKind;
  /** Localization key, e.g. 'gam.toast.conversation_started'. */
  copyKey: string;
  amount?: number;
  achievementId?: GamAchievementId;
  /** 0-based index into the achievement's tiers. */
  achievementTier?: number;
  levelId?: GamLevelId;
  createdAt: string;
  /** Set by the owner to clear the celebration; written through the rules' only allow. */
  seenAt: string | null;
};

/** gamification/{uid}/achievements/{achievementId}: one doc per earned achievement.
 *  Only `active` achievements can lapse; the rest stay unlocked forever. */
export type GamUserAchievement = {
  /** Highest tier reached: 0 bronze, 1 silver, 2 gold. */
  tier: number;
  unlockedAt: string;
  status: 'unlocked' | 'lapsed';
  updatedAt: string;
};

/** gamification/{uid}/lots/{id}: one earn's Cravos as a FIFO, expiring lot. Spending
 *  takes the oldest lot first; expiry writes an `expire` ledger entry. */
export type GamLot = {
  amount: number;
  earnedAt: string;
  /** 12 months after earnedAt. The wallet warns 30 days before. */
  expiresAt: string;
  /** The ledger entry this lot came from. */
  sourceLedgerId: string;
};

/** catalog/{itemId}: the redemption catalog, readable by any signed-in member. */
export type GamCatalogItem = {
  title: string;
  description: string;
  priceCravos: number;
  kind: 'partner_funded' | 'app_perk' | 'drop' | 'give';
  /** Partner name for partner-funded and give items; null for app perks and drops. */
  partner: string | null;
  /** Units left, or null when unlimited. Drops decrement inside the redeem transaction. */
  stock: number | null;
  active: boolean;
};

/** redemptions/{id}: written by the redeem callable in one transaction; the owner can
 *  read their own receipt. Partners see only the single-use code, never this doc. */
export type GamRedemption = {
  uid: string;
  itemId: string;
  status: 'pending' | 'fulfilled' | 'failed';
  cravos: number;
  /** The redeem ledger entries, one per lot spent. */
  redeemEntryIds: string[];
  /** The partner code once fulfilled; null while pending, stays null on failure. */
  code: string | null;
  createdAt: string;
  fulfilledAt: string | null;
};
