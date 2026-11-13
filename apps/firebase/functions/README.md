# Firebase Functions

This Node 22 codebase sends generic match and message notifications through FCM. Its
Firestore-triggered handlers run in `southamerica-east1`, matching the dev Firestore region.
The backend reads up to the 20 most recently updated device registrations per account and
chunks FCM requests at the Admin SDK limit of 500 tokens.

## Local build and tests

Install this codebase's own Yarn lockfile and build it with:

```sh
cd apps/firebase/functions
yarn install --frozen-lockfile
yarn build
```

The integration tests use the real Firebase Admin Firestore adapter against the local
Firestore emulator. The FCM boundary is captured by a test sender, so no external push is
sent. From `apps/firebase`, run `yarn test`; it starts the Firestore emulator, runs the rules
tests, and then runs these Functions tests. To run only the Functions tests, keep the
Firestore emulator running on `127.0.0.1:8089` and use:

```sh
cd apps/firebase/functions
FIRESTORE_EMULATOR_HOST=127.0.0.1:8089 yarn test
```

The integration test refuses to run unless `FIRESTORE_EMULATOR_HOST` points to loopback.

## Delivery behavior

Before sending, each handler creates a marker keyed by a SHA-256 digest of the event type,
CloudEvent id, and recipient uid. This prevents duplicate invocations from sending twice.
The marker is claimed before token lookup and the external FCM request, so a later failure can
lose the notification when a trigger retry sees the existing marker. This is an intentional
at-most-once tradeoff to avoid duplicate pushes. Blocks, account/profile existence, match
membership, and active token registrations are rechecked immediately before each FCM call;
a block or token revocation that lands after that database check can still race an external
send already in flight.

## Deploying

`firebase deploy --project dev --only functions` builds on Google's servers with Node 22. The
`resolutions` entry pins `@firebase/database-compat` to 2.1.7 because 2.1.8 requires Node 24
and fails that install. Drop the pin when the runtime moves to Node 24. If a first deploy fails
half-way, Firebase can leave HTTPS-typed shells that block the retry: delete them with
`firebase functions:delete <name> --region southamerica-east1` and deploy again. The
`gcf-artifacts` image repository deletes images older than a day and keeps the newest two.

## Deleted-match message cleanup

`cleanupOnMatchDeleted` removes orphaned messages after a match parent is deleted (including
account removal). Each transaction reads the parent and deletes at most 100 messages only
if the parent is still absent. A concurrent recreation changes that read and causes a retry;
a recreated parent wins, so cleanup never deletes its parent or active conversation. This
conservative behavior also leaves earlier messages alone if the same match ID is recreated.

Each attempt handles at most 20 pages, then throws so the retry continues from remaining
messages. Committed pages need no cursor or delivery ledger: duplicate and partial-failure
retries are safe. Canonical deleted-event membership is required. Client message rules stay
sender-only; the Admin cleanup does not broaden client permissions.

This export needs a separately reviewed dev deployment. It does not backfill deletions that
happened before the trigger was installed. Historical live orphan removal requires a bounded,
reviewed maintenance action; no live backfill was performed by this implementation.
