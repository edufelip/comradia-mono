# Cravos data model

Collections, fields and who writes them. The canonical TypeScript contract lives in two
files that a parity test keeps equal:

- `apps/mobile/features/gamification/model.ts` — client-visible shapes (pure TS).
- `apps/firebase/functions/src/gamification/model.ts` — the same constants and shapes plus
  the server-only ones.

`apps/firebase/tests/gamification-parity.test.ts` fails when the constant lists drift.
Instants are Firestore timestamps. Calendar dates use `YYYY-MM-DD`.
The initial rule set is `apps/firebase/functions/src/gamification/seed/ruleset-v1.json`,
validated by `apps/firebase/functions/src/gamification/ruleset.ts`.

## Collections

| Path | Read | Write | Fields |
| --- | --- | --- | --- |
| `gamification/{uid}` | owner (get) | Functions only | `GamProjection`: `balance`, `lifetimeNet`, `levelHighWaterMark`, `levelId`, `streak` (`GamStreakState`), `quest` (`GamQuestState`), `updatedAt` |
| `gamification/{uid}/ledger/{idempotencyKey}` | owner | Functions only, append-only | `GamLedgerEntry`: `track: 'cravos'`, `kind` (earn / clawback / expire / redeem / refund / adjust), signed `amount`, `ruleId`, `ruleSetVersion`, `source {event, path, eventId}`, optional `lot {expiresAt}`, `actor` ('system' / 'admin') + optional `actorUid` and `reason`, `createdAt` |
| `gamification/{uid}/celebrations/{id}` | owner | Functions; the owner may update **only** `seenAt` (to the server timestamp) | `GamCelebration`: `kind` (toast / fullscreen), `copyKey`, optional `amount`, `achievementId`, `achievementTier`, `levelId`, `createdAt`, `seenAt` |
| `gamification/{uid}/lots/{id}` | owner | Functions only | `GamLot`: `amount`, `earnedAt`, `expiresAt` (12 months), `sourceLedgerId` |
| `gamification/{uid}/achievements/{achievementId}` | owner | Functions only | `GamUserAchievement`: `tier` (0 bronze / 1 silver / 2 gold), `unlockedAt`, `status` (unlocked / lapsed), `updatedAt` |
| `gamification/{uid}/counters/{bucket}` | nobody (server only) | Functions only | `GamCounterDoc` `{count, updatedAt}` for caps; `GamHoldDoc` `{amount, releaseAt, updatedAt}` in `hold:{ruleId}:{sourceId}` buckets while an award waits out its hold |
| `gamRuleSets/{id}` | server only | admin callables | `GamRuleSet`: `version`, `status` (draft / simulated / published / archived), `parentVersion`, `author`, `notes`, `earnRules[]`, `quests[]`, `achievements[]`, `streakRules`, `campaigns[]`, `levels[]` |
| `gamConfig/active` | server only | admin callables | `GamConfig`: `ruleSetId`, `publishedAt`, `publishedBy`. Rollback = pointing back at an earlier published version |
| `gamAudit/{id}` | server only | admin callables | `GamAuditEntry`: `actor`, `action`, `reason`, optional `target` and `secondApprover`, `createdAt` |
| `gamAdjustments/{id}` | server only | admin callables | `GamAdjustmentDoc`: `uid`, signed `amount`, `reason`, `raisedBy`, optional `secondApproverUid` (required over 500), `status`, `createdAt` |
| `gamShadow/{uid}` (+ `/ledger/{id}`) | server only | Functions (shadow phase) | `GamShadowProjection` / `GamShadowEntry`: the same shapes as the member-facing docs, written before the program is visible |
| `gamPreferences/{uid}` | owner (get) | App Check callable | `optedOut`, `pausedUntil` |
| `gamEvents/{uid}/gamActivity/{key}` | server only | verified source handlers | Event, timestamp, numeric facts, actor/arm, and a salted pair key. TTL after 30 days. No message text or profile values. |
| `gamification/{uid}/gamReplies/{key}` (also under `gamShadow`) | server only | verified message handler | Incoming turn timestamp, whether a reply arrived within 24 h and salted pair key. TTL after 45 days. |
| `gamMetrics/{day}` | server only | Functions | `GamMetricsDoc`: anonymized daily totals only |
| `catalog/{itemId}` | any signed-in member | Functions / admin only | `GamCatalogItem`: `title`, `description`, `priceCravos`, `kind` (partner_funded / app_perk / drop / give), `partner`, `stock` (null = unlimited), `active` |
| `redemptions/{id}` | the member it belongs to (get or UID-filtered query, limit 25) | redeem callable only | `GamRedemption`: `uid`, `itemId`, `status` (pending / fulfilled / failed), `cravos`, `redeemEntryIds`, `code`, `createdAt`, `fulfilledAt` |

Everything else stays denied, as before. `gamRuleSets`, `gamConfig`, `gamAudit`,
`gamAdjustments`, `gamShadow` and `gamMetrics` deliberately have no rule block at all:
the default deny already keeps them server-only, and `apps/firebase/tests/gamification.test.ts`
asserts both the allows and the denies.

## Ledger invariants

- The document id **is** the idempotency key: `{ruleId}:{sourceId}:{uid}`, e.g.
  `conversation_started:ab12_cd34:ab12`; a clawback is `clawback:{originalKey}`. A retried
  trigger fails its own `create()`, so it can never pay twice.
- Entries are append-only. Corrections are new signed `adjust` entries with `actor: 'admin'`,
  an `actorUid` and a `reason`; nothing is ever updated or deleted, except by account
  deletion (which removes `gamification/{uid}` and the member's shadow, preferences and normalized events recursively).
- Every entry records `ruleSetVersion`, so a rollback never rewrites history.
- `lifetimeNet` = earn + clawback + adjust (signed). Redeem, expire and refund only move
  `balance` and lots: spending is not un-earning.
- The level comes from the high-water mark of `lifetimeNet`
  (`features/gamification/level-for-lifetime.ts`), so it never drops. A negative balance
  blocks redemption and is shown as 0 with a note.
- Owner history uses a bounded query by `uid` and `createdAt`. The unseen receipt listener uses `celebrations` on (`seenAt` ASC, `createdAt` DESC) for the
  unseen-celebrations listener (where `seenAt == null`, order by `createdAt`, limit 10).
