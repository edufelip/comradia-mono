# Cravos redemption backend

`redeem({ itemId, idempotencyKey })` is an App Check enforced callable. It requires an authenticated member, checks `gam_redemption` (Remote Config; missing or unreadable means off), account age of at least 30 days, Flor level or higher, absence of an open report against the member, sufficient unexpired lot balance, and available stock. One Firestore transaction consumes eligible lots FIFO, appends a `redeem` ledger entry per consumed lot, updates the balance and stock, assigns a code, and creates the fulfilled receipt. If the code pool is empty, the transaction leaves the wallet and stock intact.

Reusing the same key returns the same receipt. Mobile retains the key per account and item across an ambiguous network failure. Retrying an older pending receipt still completes code assignment or restores stock and balance with matching `refund` entries. The assigned single-use code is available in the member's result and private receipt. Partners receive only the code through the fulfilment process.

Account cleanup removes the UID, voucher and ledger references from retained receipts. Set the retention period for the remaining accounting fields before launch.

`failed-precondition` includes a `details.reason` value: `disabled`, `not_eligible_age`, `not_eligible_level`, `open_report`, `insufficient_balance`, or `out_of_stock`. Invalid requests use `invalid-argument`; unauthenticated requests use `unauthenticated`.

Pure lot helpers `lotsToExpire(lots, now)` and `expiryNoticeDue(lots, now)` are exported for the weekly expiry worker; this change does not create a schedule. `gamLiabilityReport` requires App Check and the `gamAdmin == true` custom claim. It reports outstanding unexpired Cravos and optional expected-cost liability using the supplied catalog mix and breakage assumption. Partner-funded and give items have zero app cost. This is an internal planning estimate; Cravos have no cash value and are never converted to member money.

## Launch blockers

Keep `gam_redemption` off until legal sign-off and partner agreements are complete. The section 10 legal checklist remains a launch blocker, including Brazilian prize-promotion review, consumer terms, tax/accounting treatment, privacy-policy updates, and counsel approval. Review liability assumptions before enabling the flag.
