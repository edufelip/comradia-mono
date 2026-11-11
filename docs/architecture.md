# Architecture

Comradia is one Expo app (`apps/mobile`) on top of Firebase (`apps/firebase`). There is no server of our own: Firebase Auth signs people in, Firestore stores data, and Firestore security rules are the only gate between users. A static landing page lives in `apps/website`.

## Decisions

| # | Decision | Why | Revisit when |
| --- | --- | --- | --- |
| 1 | **Firebase for everything** (Auth + Firestore). The Bun/Elysia server and its Postgres were removed. | One vendor for sign-in, SMS codes and data. Fewer moving parts for a solo project, and every Firebase piece has a local emulator for tests. | We need SQL-style queries (ranking by distance, reporting); then consider Data Connect or a Cloud Function backed by Postgres. |
| 2 | **Spark (free) plan.** | No card attached while the product is unproven. | Before launch: real SMS, Cloud Functions and Storage all need Blaze (see Deferred). |
| 3 | **Sign-in: Apple (iPhone only), Google, phone + SMS code.** | The flow chart asks for Google and phone; App Store rule 4.8 requires Sign in with Apple when Google is offered. | — |
| 4 | **Native uses `@react-native-firebase`, web uses the `firebase` JS SDK**, both behind `services/backend`. | Phone sign-in on iOS / Android only works through the native SDK; the JS SDK's phone flow needs a browser reCAPTCHA. Screens never import Firebase directly. | — |
| 5 | **Profile is written once, complete, at the end of onboarding.** The draft lives in memory until then. | The security rules can then require a full, valid profile on every write. A half-finished signup leaves no public card. | We want to resume onboarding across app restarts; then persist the draft locally (not in Firestore). |
| 6 | **Public card and private account are separate documents.** | Firestore rules secure whole documents, not fields. Birth date and preferences must never be readable by other users. | — |
| 7 | **Age is stored, birth date stays private.** The client computes age at signup; rules allow 18–99. | Without Cloud Functions there is no trusted place to recompute it. | Blaze: a scheduled Function recomputes ages from the private birth date. |
| 8 | **Matches without a server.** A like is also written to `likes/{target}/from/{me}`, which the liked person can read. When I like someone who already liked me, the same batch creates `matches/{a_b}`; the rules allow that create only when both likes exist (`existsAfter`). Two likes at the same moment are fixed by `reconcileMatches` when Matches opens. | Works on the free plan. Revised 2026-11-11: the earlier plan said mutual matching needed a Cloud Function. | A person can see who liked them (needed for the check). Hide that if it becomes a paid feature; then move the check to a Cloud Function. |
| 9 | **Firebase config files are committed** (`apps/mobile/firebase/<variant>/`). | They hold public client ids, not secrets. Abuse is limited by Auth, rules and (later) App Check. | Before launch: turn on App Check. |

## Layout

```
apps/mobile
  app/                       expo-router screens
    index.tsx                redirect by session state
    (auth)/                  welcome (S1), register (S1B), verify-phone (S1C)
    (onboarding)/            vibe (S2), values (S3), starter (S4)
    (tabs)/                  discover (S5), matches (S9), profile (S11)
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
  firebase.json              emulator ports: auth 9099, Firestore 8089
  scripts/seed.mjs           Discover profiles for the emulators
  tests/                     rules tests against the Firestore emulator
```

## Routing

`features/auth/session-sync.ts` listens to Firebase Auth and loads the user's profile. The session store's `status` decides which route group exists (`Stack.Protected` in `app/_layout.tsx`):

| Status | Meaning | Reachable |
| --- | --- | --- |
| `loading` | Firebase is restoring the session | spinner only |
| `signedOut` | no user | `(auth)`: `/welcome`, `/register`, `/verify-phone` |
| `needsOnboarding` | signed in, no `profiles/{uid}` | `(onboarding)`: `/vibe`, `/values`, `/starter` |
| `ready` | signed in with a profile | `(tabs)`: `/discover`, `/matches`, `/profile` |
| `error` | signed in, profile read failed | retry / sign-out view |

When the status changes, the user lands on `app/index.tsx`, which redirects to the right first screen. Screens never navigate across groups themselves: signing in, finishing onboarding or signing out changes the status, and routing follows.

## Data model (Firestore)

| Path | Who can read | Who can write | Fields |
| --- | --- | --- | --- |
| `profiles/{uid}` | any signed-in user | owner only; must be a complete, valid card | `displayName` (1–40), `age` (18–99), `vibe`, `lookingFor`, `unionMember`, `union` (null unless member), `values` (3–5 unique ids), `promptId`, `promptAnswer` (1–280), `createdAt`, `updatedAt` (server time) |
| `users/{uid}` | owner | owner | `birthDate` (YYYY-MM-DD), `sharedPassionWeight` (0–100), `createdAt`, `updatedAt` |
| `users/{uid}/swipes/{targetUid}` | owner | owner, not on self | `direction` (`like` / `pass`), `createdAt` |
| `likes/{targetUid}/from/{likerUid}` | the liked person and the liker | the liker, not on self | `createdAt` |
| `matches/{a_b}` (uids sorted, `_`) | the two people in it | create only, by one of the two, when both likes exist | `users` ([a, b] sorted), `createdAt` |
| `matches/{a_b}/messages/{id}` | the two people | the sender, one of the two; never edited | `from`, `text` (1–1000), `createdAt` |

Everything else is denied. Option ids are listed once in `features/profile/profile-schema.ts` and mirrored in `firestore.rules`; a rules test fails when they drift. Labels come from localization (`onboarding.*`).

## Screens

| Id | Route | What it does | Key test ids |
| --- | --- | --- | --- |
| S1 | `/welcome` | Pitch; "Find your person" → `/register`, "I already have an account" → `/register?mode=login` | `welcome-cta-start`, `welcome-cta-login` |
| S1B | `/register` | Apple (iPhone), Google, or a Brazilian phone number (+55) → sends the SMS code and pushes `/verify-phone`. `mode=login` only changes the copy. | `register-apple`, `register-google`, `register-phone-input`, `register-send-code`, `register-error`, `register-switch-mode` |
| S1C | `/verify-phone` | 6-digit code, resend after 30 s, edit number (back). A correct code signs in; routing takes over. | `verify-code-input`, `verify-submit`, `verify-resend`, `verify-edit`, `verify-error` |
| S2 | `/vibe` | First name, birthday (18+), vibe (5 cards), looking for (3), optional union badge | `onboarding-name`, `onboarding-birthday`, `vibe-<id>`, `looking-for-<id>`, `union-toggle`, `union-<id>`, `onboarding-continue` |
| S3 | `/values` | 3–5 values, shared-passion weight (0–100, step 10) | `value-<id>`, `weight-decrease`, `weight-increase`, `onboarding-continue` |
| S4 | `/starter` | Prompt picker + text answer (voice: "coming soon"); "Start swiping" writes the profile | `prompt-<id>`, `starter-answer`, `starter-finish`, `onboarding-error` |
| S5 | `/discover` | Deck from Firestore (oldest profiles first, 50 per load); Like / Pass are saved as swipes | `discover-screen`, `discover-person-<id>`, `discover-card-name`, `discover-like`, `discover-pass`, `discover-retry`, `discover-refresh` |
| S8 | `/match/[id]` (modal) | Shown right after a like that matched: both names, shared values, "Send a message" / "Keep swiping" | `match-screen`, `match-send-message`, `match-keep-swiping` |
| S9 | `/matches` | Live list of matches, newest first; tap opens the chat | `matches-screen`, `match-row-<matchId>`, `matches-empty` |
| S10 | `/chat/[id]` | Live chat with one match; text only for now | `chat-screen`, `chat-input`, `chat-send`, `chat-message-<id>`, `chat-error` |
| S11 | `/profile` | Own card from the session; sign out | `profile-screen`, `profile-card-name`, `profile-sign-out` |

## Environments

| Name | Firebase project | Used by |
| --- | --- | --- |
| emulators | `demo-comradia` (no cloud project) | all automated tests; `EXPO_PUBLIC_FIREBASE_EMULATOR_HOST=127.0.0.1` (Android emulator: `10.0.2.2`) |
| dev | `comradia-dev` | dev builds on real devices; phone sign-in with Firebase test numbers only: +55 11 99999-0001, -0002, -0003, code `123456` |
| prod | not created yet | — |

Web reads its Firebase config from `EXPO_PUBLIC_FIREBASE_API_KEY`, `_AUTH_DOMAIN`, `_PROJECT_ID` and `_APP_ID`; without them it uses the demo project, which only works with the emulators. Native Google sign-in also needs `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (in `.env.example`). Android Google sign-in only works for builds signed with a key whose SHA-1 is registered on the Firebase Android app (today: the React Native debug key).

## Security

- Firestore rules are the trust boundary: every write is validated (allowed keys, types, sizes, enums, owner, server timestamps). The rules tests in `apps/firebase/tests` cover each allow and deny.
- No private data in public documents. Phone and email stay in Firebase Auth; birth date stays in `users/{uid}`.
- Apple sign-in uses a SHA-256 nonce; the raw nonce never leaves the device except to Firebase.
- Error messages shown to users come from `BackendErrorCode`, never raw Firebase text.
- Not done yet: App Check, account deletion, reporting and blocking, rate limits beyond Firebase's defaults.

## Deferred (needs the Blaze plan or a later task)

- Real SMS to any number (Spark only allows test numbers).
- Match and message notifications (needs Cloud Functions + push). Unmatch, block and report.
- Voice intros and photos (Cloud Storage on new projects needs Blaze).
- Age recompute, ranking by shared passions and distance (Cloud Function).
- App Check, account deletion, report / block.
