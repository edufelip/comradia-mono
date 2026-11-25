# Cravos admin console

The web-only console uses the callable exports in `apps/firebase/functions/src/gamification/admin`.
Every callable requires Firebase Auth, the `gamAdmin` custom claim and App Check. The server
validates every request and appends an audit record for each write. Grant access with
`node apps/firebase/scripts/grant-gam-admin.mjs <uid>` using an authorized Firebase Admin
credential. Never grant the claim to a member account.

## Operations and lifecycle

Rule sets are JSON documents matching the server contract in `gamification/model.ts` and
`ruleset.ts`. Create a draft from a published set, edit only a draft, and run validation before
saving. Simulations use recent normalized events and report the current and draft outcomes
side by side. A publish request is approved by a different admin; rollback follows the same
two-actor flow. All lifecycle changes are recorded in `gamAudit`.

The console exposes ledger lookup, signed balance adjustments, adjustment approval, feature
flag readback, audit history, and liability summaries. Adjustments require a reason and an
independent approver above the server-defined threshold. The append-only ledger is the source
of truth. Runtime feature flags remain Firebase Remote Config values; the console must not
change their defaults. In particular `gam_redemption` remains off pending legal sign-off.

Firestore rules intentionally deny direct admin reads and writes. Use callable APIs for all
access. The functions enforce authorization even if the console is bypassed.
