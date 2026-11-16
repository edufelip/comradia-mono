# Firebase Functions

This Node 22 codebase sends generic match, message and report notifications through FCM and
cleans up deleted accounts, matches and uploaded portraits. Firestore and Auth handlers run in
`southamerica-east1`, matching Firestore. The Storage finalize handler runs in `us-east1`, the
default bucket region. The notification backend reads up to the 20 most recently updated device
registrations per account and chunks FCM requests at the Admin SDK limit of 500 tokens.

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

Before sending, each notification handler creates a marker keyed by a SHA-256 digest of the
event type, CloudEvent id, and recipient uid. Dispatch and report-alert markers expire after
seven days using the `notificationDispatches.expireAt` Firestore TTL override. Notification
triggers ignore events older than six days so an expired marker cannot allow a stale retry to
send again. The marker is claimed before token lookup and the external FCM request, so a later
failure can lose the notification when a trigger retry sees the existing marker. This is an
intentional at-most-once tradeoff to avoid duplicate pushes. The registration set is read once
after the claim and refreshed once immediately before sending, preserving token-revocation
checks without a query for every locale. Tokens are grouped by locale;
only locales with registrations are sent, and blocks, account/profile existence and match
membership are checked once immediately before the recipient's first FCM call. Invalid FCM
registrations are removed. A safety change after that database check can still race a send
already in flight.

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

## Deleted-account cleanup

The Firebase Auth `onDelete` trigger saves the user's swipe and block ids before recursively
deleting `users/{uid}`. It removes `profiles/{uid}`, received likes, the user's outgoing likes
and mirrored blocks, every match containing the uid, and every object under `photos/{uid}/`.
The match delete trigger cleans up its messages. Firestore collection reads and deletes are
paged at 300 documents; Storage object listing is paged as well. Deletes tolerate missing
documents and objects, so the trigger is safe after client-side cleanup and retries after
partial failures. No historical Auth deletions are backfilled.

## Portrait upload limits

The Storage `onObjectFinalized` handler validates `image/jpeg` and, when a ranged read is
available, checks the JPEG signature from the first three bytes. It then lists the user's photo
folder and removes oldest objects until at most three remain, preserving the path currently
referenced by `profiles/{uid}.photoPath`. Missing objects are tolerated on delete. The trigger
has no minimum instances; no scheduled cleanup or external image service is used.
