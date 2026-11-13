# Architecture

Comradia is one Expo app (`apps/mobile`) on top of Firebase (`apps/firebase`). Firebase Functions dispatch match and message notifications; Firebase Auth signs people in, Firestore stores profile data, Cloud Storage stores portraits, and Firestore and Storage security rules control access. A static landing page lives in `apps/website`.

## Decisions

| # | Decision | Why | Revisit when |
| --- | --- | --- | --- |
| 1 | **Firebase for everything** (Auth + Firestore). The Bun/Elysia server and its Postgres were removed. | One vendor for sign-in, SMS codes and data. Fewer moving parts for a solo project, and every Firebase piece has a local emulator for tests. | We need SQL-style queries (ranking by distance, reporting); then consider Data Connect or a Cloud Function backed by Postgres. |
| 2 | **Blaze (pay as you go) on `comradia-dev`, kept inside the free allowances** (see Costs). Turned on 2026-11-12 for Cloud Storage. | New projects need Blaze for Storage. A budget alert catches any real spend. | Spend shows up in a budget email: find the cause before adding anything paid. |
| 3 | **Sign-in: Apple (iPhone only), Google, phone + SMS code.** | The flow chart asks for Google and phone; App Store rule 4.8 requires Sign in with Apple when Google is offered. | — |
| 4 | **Native uses `@react-native-firebase`, web uses the `firebase` JS SDK**, both behind `services/backend`. | Phone sign-in on iOS / Android only works through the native SDK; the JS SDK's phone flow needs a browser reCAPTCHA. Screens never import Firebase directly. | — |
| 5 | **Profile is written once, complete, at the end of onboarding.** The draft lives in memory until then. | The security rules can then require a full, valid profile on every write. A half-finished signup leaves no public card. | We want to resume onboarding across app restarts; then persist the draft locally (not in Firestore). |
| 6 | **Public card and private account are separate documents.** | Firestore rules secure whole documents, not fields. Birth date and preferences must never be readable by other users. | — |
| 7 | **Age is stored, birth date stays private.** The client computes age at signup; rules allow 18–99. | Without Cloud Functions there is no trusted place to recompute it. | Blaze: a scheduled Function recomputes ages from the private birth date. |
| 8 | **Matches without a server.** A like is also written to `likes/{target}/from/{me}`, which the liked person can read. When I like someone who already liked me, the same batch creates `matches/{a_b}`; the rules allow that create only when both likes exist (`existsAfter`). Two likes at the same moment are fixed by `reconcileMatches` when Matches opens. | Works on the free plan. Revised 2026-11-11: the earlier plan said mutual matching needed a Cloud Function. | A person can see who liked them (needed for the check). Hide that if it becomes a paid feature; then move the check to a Cloud Function. |
| 9 | **Firebase config files are committed** (`apps/mobile/firebase/<variant>/`). | They hold public client ids, not secrets. Abuse is limited by Auth, rules and (later) App Check. | Before launch: turn on App Check. |
| 10 | **One optional portrait per profile, in Cloud Storage.** `profiles/{uid}.photoPath` points at `photos/{uid}/{id}.jpg`; every upload gets a new file id and the old file is deleted afterwards, best effort. Android crops to 3:4 (iOS's crop is square; the frame covers either). The phone resizes to 1080 px and JPEG 0.8 before upload. | Storage rules allow any signed-in user to read portraits, but only the owner to create or delete them; files cannot be overwritten. Firestore only accepts a path inside the owner's folder. No permission prompt: the system photo picker needs none. | Multiple photos, or moderation (needs a Cloud Function). |

## Layout

```
apps/mobile
  app/                       expo-router screens
    index.tsx                redirect by session state
    (auth)/                  welcome (S1), register (S1B), verify-phone (S1C)
    (onboarding)/            vibe (S2), values (S3), starter (S4)
    (tabs)/                  discover (S5), matches (S9), profile (S11)
    match/[id].tsx           "It's a match!" modal (S8)
    chat/[id].tsx            chat with one match (S10)
    blocked.tsx              blocked people, with Unblock (S11B)
  features/
    auth/                    session store, Firebase → store sync, phone number helpers
    profile/profile-schema.ts  option ids, validation, Firestore document builder (pure TS)
    onboarding/              onboarding draft store and step components
    discovery/               Discover deck store (reads Firestore through the backend)
  services/backend/          the only code that imports Firebase
    types.ts                 Backend interface
    index.ts / index.web.ts  native (@react-native-firebase) / web (firebase JS SDK)
    errors.ts                maps Firebase / Google / Apple errors to BackendErrorCode
  firebase/<dev|prod>/       GoogleService-Info.plist, google-services.json
apps/firebase
  firestore.rules            security rules (the trust boundary)
  storage.rules              photo upload rules
  firebase.json              emulator ports: auth 9099, Firestore 8089, Storage 9199
  functions/                 match/message push triggers and emulator-backed adapter tests
  scripts/seed.mjs           Discover profiles for the emulators
  tests/                     rules tests against the Firestore and Storage emulators
```

## Routing

`features/auth/session-sync.ts` listens to Firebase Auth and loads the user's profile. The session store's `status` decides which route group exists (`Stack.Protected` in `app/_layout.tsx`):

| Status | Meaning | Reachable |
| --- | --- | --- |
| `loading` | Firebase is restoring the session | spinner only |
| `signedOut` | no user | `(auth)`: `/welcome`, `/register`, `/verify-phone` |
| `needsOnboarding` | signed in, no `profiles/{uid}` | `(onboarding)`: `/vibe`, `/values`, `/starter` |
| `ready` | signed in with a profile | `(tabs)`: `/discover`, `/matches`, `/profile`; `/match/[id]`, `/chat/[id]`, `/safety/[uid]`, `/blocked` |
| `error` | signed in, profile read failed | retry / sign-out view |

When the status changes, the user lands on `app/index.tsx`, which redirects to the right first screen. Screens never navigate across groups themselves: signing in, finishing onboarding or signing out changes the status, and routing follows.

## Data model (Firestore)

| Path | Who can read | Who can write | Fields |
| --- | --- | --- | --- |
| `profiles/{uid}` | any signed-in user | owner only; must be a complete, valid card | `displayName` (1–40), `age` (18–99), `vibe`, `lookingFor`, `unionMember`, `union` (null unless member), `values` (3–5 unique ids), `promptId`, `promptAnswer` (1–280), `photoPath` (null or `photos/{uid}/<id>.jpg`), `createdAt`, `updatedAt` (server time) |
| `users/{uid}` | owner | owner | `birthDate` (YYYY-MM-DD), `sharedPassionWeight` (0–100), `createdAt`, `updatedAt` |
| `users/{uid}/swipes/{targetUid}` | owner | owner, not on self | `direction` (`like` / `pass`), `createdAt` |
| `likes/{targetUid}/from/{likerUid}` | the liked person and the liker | the liker, not on self | `createdAt` |
| `matches/{a_b}` (uids sorted, `_`) | the two people in it | create only, by one of the two, when both likes exist | `users` ([a, b] sorted), `createdAt` |
| `matches/{a_b}/messages/{id}` | the two people | the sender, one of the two; never edited | `from`, `text` (1–1000), `createdAt` |
| `users/{uid}/blocks/{targetUid}` | owner | owner, not on self | `createdAt` |
| `blocks/{uid}/by/{blockerUid}` | the blocked person and the blocker | the blocker, not on self | `createdAt` |
| `reports/{id}` | nobody (write-only) | any signed-in user, about someone else | `reporter`, `target`, `reason`, `details` (≤500), `context` (`profile` / `chat`), `createdAt` |

| Storage `photos/{uid}/{id}.jpg` | any signed-in user | create only, by the owner: `image/jpeg`, 1 byte–5 MB, never overwritten; delete by the owner | the portrait file |

Everything else is denied. Option ids are listed once in `features/profile/profile-schema.ts` and mirrored in `firestore.rules`; a rules test fails when they drift. Labels come from localization (`onboarding.*`).

## Screens

| Id | Route | What it does | Key test ids |
| --- | --- | --- | --- |
| S1 | `/welcome` | Pitch; "Find your person" → `/register`, "I already have an account" → `/register?mode=login` | `welcome-cta-start`, `welcome-cta-login` |
| S1B | `/register` | Apple (iPhone), Google, or a Brazilian phone number (+55) → sends the SMS code and pushes `/verify-phone`. `mode=login` only changes the copy. | `register-apple`, `register-google`, `register-phone-input`, `register-send-code`, `register-error`, `register-switch-mode` |
| S1C | `/verify-phone` | 6-digit code, resend after 30 s, edit number (back). A correct code signs in; routing takes over. | `verify-code-input`, `verify-submit`, `verify-resend`, `verify-edit`, `verify-error` |
| S2 | `/vibe` | Optional portrait (pick from the library and crop), first name, birthday (18+), vibe (5 cards), looking for (3), optional union badge | `onboarding-name`, `onboarding-birthday`, `onboarding-photo`, `onboarding-photo-pick`, `onboarding-photo-remove`, `vibe-<id>`, `looking-for-<id>`, `union-toggle`, `union-<id>`, `onboarding-continue` |
| S3 | `/values` | 3–5 values, shared-passion weight (0–100, step 10) | `value-<id>`, `weight-decrease`, `weight-increase`, `onboarding-continue` |
| S4 | `/starter` | Prompt picker + text answer (voice: "coming soon"); "Start swiping" writes the profile | `prompt-<id>`, `starter-answer`, `starter-finish`, `onboarding-error` |
| S5 | `/discover` | Deck from Firestore (oldest profiles first, 50 per load), each card with its portrait or the name's initial; Like / Pass are saved as swipes | `discover-screen`, `discover-person-<id>`, `discover-card-name`, `discover-photo`, `discover-like`, `discover-pass`, `discover-retry`, `discover-refresh` |
| S8 | `/match/[id]` (modal) | Shown right after a like that matched: both portraits and names, shared values, "Send a message" / "Keep swiping" | `match-screen`, `match-photo-me`, `match-photo-other`, `match-send-message`, `match-keep-swiping` |
| S9 | `/matches` | Live list of matches, newest first; tap opens the chat | `matches-screen`, `match-row-<matchId>`, `match-row-photo-<matchId>`, `matches-empty` |
| S10 | `/chat/[id]` | Live chat with one match; text only for now. A block on either side closes it: the messages stay, the composer goes | `chat-screen`, `chat-photo`, `chat-input`, `chat-send`, `chat-message-<id>`, `chat-error`, `chat-safety`, `chat-closed` |
| S11 | `/profile` | Own card from the session; add, change or remove the portrait; sign out; delete the account behind an inline confirm panel (needs a sign-in newer than five minutes) | `profile-screen`, `profile-card-name`, `profile-photo`, `profile-photo-change`, `profile-photo-remove`, `profile-photo-error`, `profile-sign-out`, `profile-delete-account`, `profile-delete-confirm`, `profile-delete-cancel`, `profile-delete-error`, `profile-delete-reauth` |
| S11B | `/blocked` | Blocked people, opened from Profile: each one with Unblock behind an inline confirm. Unblocking removes only my two block docs; reports stay and a block they made on me stays | `blocked-screen`, `blocked-row-<uid>`, `blocked-unblock-<uid>`, `blocked-unblock-confirm-<uid>`, `blocked-empty`, `profile-blocked` |
| S12 | `/safety/[uid]` (modal) | Block or report one person, from Discover (`context=profile`) or a chat (`context=chat`); a report also blocks. A block drops them from the deck and hides the match | `safety-screen`, `safety-error`, `safety-block`, `safety-block-confirm`, `report-reason-<id>`, `report-details`, `report-submit` |

## Environments

| Name | Firebase project | Used by |
| --- | --- | --- |
| emulators | `demo-comradia` (no cloud project) | all automated tests; `EXPO_PUBLIC_FIREBASE_EMULATOR_HOST=127.0.0.1` (Android emulator: `10.0.2.2`) |
| dev | `comradia-dev` | dev builds on real devices; phone sign-in with two owner-set Firebase test numbers (code `123456`; listed in the Firebase console, not here). Real SMS is on in all regions since 2026-11-13 (owner's yes): any other number gets a real, paid SMS. |
| prod | not created yet | — |

Web reads its Firebase config from `EXPO_PUBLIC_FIREBASE_API_KEY`, `_AUTH_DOMAIN`, `_PROJECT_ID` and `_APP_ID`; without them it uses the demo project, which only works with the emulators. Native Google sign-in also needs `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (in `.env.example`). Android Google sign-in only works for builds signed with a key whose SHA-1 is registered on the Firebase Android app (today: the React Native debug key).

## Costs

`comradia-dev` is on Blaze since 2026-11-12, on the shared billing account (BRL). Rule of thumb: stay inside the free allowances, and get a yes before adding anything that bills by the hour or per message.

- **Budget alert:** "comradia-dev monthly", R$ 25, emails at 10%, 50%, 90% and 100% of actual spend and at 100% of forecast. An alert only warns; it does not stop charges.
- **Storage bucket in `us-east1`:** one of the three regions (`us-east1`, `us-west1`, `us-central1`) where Storage has a free allowance (5 GB stored, 100 GB downloaded per month). Firestore stays in `southamerica-east1`.
- **Photos are small and cached:** resized to 1080 px, JPEG 0.8 (about 100–200 KB), never overwritten, uploaded with `Cache-Control: public, max-age=31536000, immutable`. Old files are deleted after a change on a best-effort basis; account deletion stops if removing a file fails so it can be retried.
- **Real SMS is on for dev in all regions** (SMS region policy `allowByDefault`, owner's yes on 2026-11-13; no Brazil-only limit). Each real SMS bills a few cents and counts against the budget. The two owner-set Firebase test numbers (code `123456`; listed in the Firebase console, not here) never send an SMS and are free, so use them for testing. App Check runs in monitor mode; enforce it before a public build.
- **Billing account limit:** the account allows 5 linked projects. `mapfriends-92e3c` was unlinked on 2026-11-12 to make room.

## Security

- Firestore rules are the trust boundary: every write is validated (allowed keys, types, sizes, enums, owner, server timestamps). The rules tests in `apps/firebase/tests` cover each allow and deny.
- Storage rules let any signed-in user read photos; only the owner can create or delete them. Uploads must be JPEG, no larger than 5 MB and cannot overwrite an existing file. Account deletion removes files under `photos/{uid}/` first and stops if one fails, so it can be retried.
- Notification tokens stay in owner-private `users/{uid}/pushTokens`; event dispatch markers are Admin-only. Functions and native client changes require a separate dev rollout before provider delivery can be verified (see [notifications](notifications.md)).
- No private data in public documents. Phone and email stay in Firebase Auth; birth date stays in `users/{uid}`.
- Apple sign-in uses a SHA-256 nonce; the raw nonce never leaves the device except to Firebase.
- Error messages shown to users come from `BackendErrorCode`, never raw Firebase text.
- App Check is integrated on native (Play Integrity / App Attest; debug provider only for the dev variant when `EXPO_PUBLIC_APP_CHECK_DEBUG_TOKEN` is set; production configuration omits the token) in monitor mode, not enforced: sideloaded dev builds can't pass Play Integrity. Enforce once store builds exist.
- Not done yet: rate limits beyond Firebase's defaults.

## Deferred (needs a Cloud Function or a later task)

- Native notification delivery verification and dev rollout (Functions and client implementation: see [notifications](notifications.md)). Unmatch; block and report exist without one.
- Voice intros, more than one photo, photo moderation.
- Age recompute, ranking by shared passions and distance (Cloud Function).
- Cleaning up the messages the other person sent after an account deletion (the match document is deleted, their messages stay orphaned; needs a Cloud Function).
- Moderation tooling for `reports` (reviewed in the Firebase console for now).
- App Check enforcement (needs store builds).
