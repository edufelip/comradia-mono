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
side by side. Save edits before requesting publication. A different admin approves the request, and
another save invalidates it. Rollback follows the same two-actor flow. All lifecycle changes are
recorded in `gamAudit`. Awards and holds retain their original rule version for later clawbacks.
Each event requires the idempotency key template shown in the seed, so the engine and simulator
deduplicate the same sources.

The console exposes ledger lookup, signed balance adjustments, adjustment approval, feature
flag readback, audit history, and liability summaries. Adjustments require a reason and an
independent approver above the server-defined threshold. The append-only ledger is the source
of truth. Runtime feature flags remain Firebase Remote Config values; the console must not
change their defaults. In particular `gam_redemption` remains off pending legal sign-off.

Firestore rules intentionally deny direct admin reads and writes. Use callable APIs for all
access. The functions enforce authorization even if the console is bypassed.

## Run the review console

Use Node 24 in `apps/admin`. Install the lockfile, run `yarn test` and `yarn build`,
then use `yarn dev` with the public Firebase web settings in `.env.local` (see
`.env.example`). The Firebase project must allow the console's origin and have Google
sign-in and reCAPTCHA Enterprise App Check configured. The console calls Functions in
`southamerica-east1`.

Without a published database rule set, the engine uses the bundled seed. The first
draft can be created from that seed. The simulator compares both sets against up to
10,000 normalized records from the last 14 days and reports when the sample was capped.
Caps start at the beginning of the sample, so this is a forecast. It does not model
delayed release, later clawbacks, prior lifetime counters, or post-sample activity.
