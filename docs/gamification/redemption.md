# Cravos redemption backend

`redeem({ itemId, idempotencyKey })` is an App Check enforced callable. It requires an authenticated member, checks `gam_redemption` (Remote Config; missing or unreadable means off), account age of at least 30 days, Flor level or higher, absence of an open report against the member, sufficient unexpired lot balance, and available stock. A single Firestore transaction reserves stock, consumes eligible lots FIFO, appends one `redeem` ledger entry per consumed lot, updates the balance projection, and creates a pending redemption. Reusing the same key returns the same redemption.

Fulfilment atomically claims one code from `catalogCodes/{itemId}/codes/{code}`. Only the member-facing result contains the assigned single-use code. Partners receive only that code through the fulfilment process; no member, profile, balance, or other redemption data is shared. A fulfilment error marks the receipt failed and appends matching `refund` ledger entries while restoring stock and balance.

`failed-precondition` includes a `details.reason` value: `disabled`, `not_eligible_age`, `not_eligible_level`, `open_report`, `insufficient_balance`, or `out_of_stock`. Invalid requests use `invalid-argument`; unauthenticated requests use `unauthenticated`.

Pure lot helpers `lotsToExpire(lots, now)` and `expiryNoticeDue(lots, now)` are exported for the weekly expiry worker; this change does not create a schedule. `gamLiabilityReport` requires App Check and the `gamAdmin == true` custom claim. It reports outstanding unexpired Cravos and optional expected-cost liability using the supplied catalog mix and breakage assumption. Partner-funded and give items have zero app cost. This is an internal planning estimate; Cravos have no cash value and are never converted to member money.

## Launch blockers

Keep `gam_redemption` off until legal sign-off and partner agreements are complete. The section 10 legal checklist remains a launch blocker, including Brazilian prize-promotion review, consumer terms, tax/accounting treatment, privacy-policy updates, and counsel approval. Review liability assumptions before enabling the flag.
