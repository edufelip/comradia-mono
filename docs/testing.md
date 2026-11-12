# Testing

Five test layers, fastest first. Run the cheapest layer that proves your change, and add a test in the layer that owns the behaviour.

| Layer | What it proves | Tool | Where tests live | Command (from the app folder) | Time (local) |
| --- | --- | --- | --- | --- | --- |
| Unit | Pure logic: stores, theme tokens and contrast, translations, locale resolution, backend helpers (`services/backend`) | `node:test` via `tsx` | next to the source: `constants/`, `features/`, `localization/`, `services/` `**/*.test.ts` | `yarn test` | ~1 s |
| Component | Screens and components render and react to taps; routing redirects | Jest + `jest-expo` + React Native Testing Library + `expo-router/testing-library` | `apps/mobile/tests/component/*.test.tsx` | `yarn test:component` (`:coverage` to enforce thresholds) | ~2 s warm, ~10 s cold |
| E2E web | Real user journeys in real browsers (Chromium + WebKit, 390×844 and 320×568, dark mode, pt-BR / es-ES, accessibility tree) | Playwright, against `expo start --web` and the Firebase emulators | `apps/mobile/tests/e2e/*.spec.ts` | `yarn test:e2e` (`:ui` to debug) | ~16 s |
| E2E native | The same journeys on iOS / Android | Maestro | `apps/mobile/.maestro/*.yaml` | `maestro --device <simulator or emulator id> test .maestro` from `apps/mobile`, against a dev build (see "E2E native on iOS" below) | ~4 min |
| Firestore rules | Every allow and deny in `firestore.rules`, plus parity between the rules' option lists and `features/profile/profile-schema.ts` | `node:test` via `tsx` + `@firebase/rules-unit-testing` against the Firestore emulator | `apps/firebase/tests/*.test.ts` | `yarn test` (starts its own emulator; with one already on `:8089`, run `FIRESTORE_EMULATOR_HOST=127.0.0.1:8089 node --import tsx --test tests/*.test.ts`) | ~1 s |

`yarn test:all` in `apps/mobile` runs typecheck, lint, unit, component (with coverage) and E2E web in that order.

## E2E native on iOS

Maestro drives a dev build on a booted simulator. Continuous Native Generation means `ios/` is
generated and git-ignored, so build it once and reuse it:

```bash
cd apps/mobile
npx expo prebuild --platform ios           # once, and after any native config change
npx expo run:ios --device <udid> --no-bundler
```

Metro must run with the emulator host so the bundle talks to `127.0.0.1:9099` / `:8089`. Reset
the emulators, then run the flows against the same simulator:

```bash
EXPO_PUBLIC_FIREBASE_EMULATOR_HOST=127.0.0.1 npx expo start --dev-client --port 8085
GCLOUD_PROJECT=comradia-dev node ../firebase/scripts/seed.mjs --clear
curl -X DELETE -H 'Authorization: Bearer owner' \
  http://127.0.0.1:9099/emulator/v1/projects/demo-comradia/accounts
maestro --device <udid> test .maestro
```

`config.yaml` runs the flows in a fixed order (welcome, sign-in, onboarding, discover): they
share one app session, and the last flow ends signed out, ready for the next run.

On the shared Mac, wrap the build and Maestro in `~/.claude/bin/mobile-lock run -- <command>`
and keep Metro on 8085: 8081 and 8199 belong to other runs.

Native gotchas:

- **Firebase pods stay static libraries.** `forceStaticLinking` in `app.config.ts` keeps
  `RNFBApp`/`Auth`/`Crashlytics`/`Firestore` out of the static frameworks, otherwise the
  compile fails with "include of non-modular header inside framework module" (expo/expo#39607).
- **Native Firestore data lives under `comradia-dev` in the emulator, not `demo-comradia`.**
  The native SDK takes the project id from `GoogleService-Info.plist`, so the app reads and
  writes `projects/comradia-dev` on `:8089` (the web build and the Playwright suite use
  `demo-comradia`). Seed and inspect that project: `GCLOUD_PROJECT=comradia-dev` for
  `seed.mjs`, and `/v1/projects/comradia-dev/...` for REST reads. Auth codes are still read
  from `demo-comradia` (`scripts/sms-code.js`).
- **`clearState` does not reset the session.** It wipes the Metro URL the dev client saved, and
  it does not clear the iOS Keychain where Firebase Auth keeps the user. Every flow starts with
  `subflows/launch.yaml` instead: it restarts the app and signs out from Discover. Onboarding has
  no sign-out, so `welcome.yaml` finishes onboarding first when a stopped run left one open.
- **The first screen read after a launch can abort the flow.** While the dev client swaps its
  loading view for the app, iOS fails the snapshot (`kAXErrorInvalidUIElement`), and Maestro
  stops the flow even inside `retry` or with `optional`. `subflows/launch.yaml` waits 3 s
  (`scripts/settle.js`) before its first check.
- **Some fields have no Done key.** The birthday number pad and the multiline answer can't be
  closed with `hideKeyboard`; the onboarding screens close the keyboard on drag, so the flows
  swipe a little instead.
- **The code field is invisible to automation.** `CodeField` puts the real `TextInput` at
  `opacity: 0`, which iOS drops from the accessibility tree: `id: verify-code-input` cannot be
  tapped or asserted. The flows type into the auto-focused field and assert the visible copy.
- **The simulator needs an Apple Account for Apple sign-in.** Without one, tapping Apple shows
  the system "Sign in to your Apple Account" prompt and the request fails, so the app shows its
  generic error — the cancel path can only be checked on a device.

## CI

**Off for now (since 2026-11-11): tests run locally only.** Both workflows below are disabled on GitHub, so run the layers above before you push: `cd apps/mobile && yarn test:all && yarn format:check`, plus `cd apps/firebase && yarn test` when the rules or the profile schema change.

The workflow files stay in the repo so CI can come back with `gh workflow enable "Mobile tests"` and `gh workflow enable "Firestore rules"`:

| Workflow | Runs when | Jobs |
| --- | --- | --- |
| `.github/workflows/mobile-tests.yml` | every PR; pushes to `develop` / `main` touching `apps/mobile/**` or `apps/firebase/**` | `checks` (typecheck, lint, format, unit, component + coverage) and `e2e-web` (Playwright, in parallel; report uploaded on failure) |
| `.github/workflows/firebase-rules.yml` | every PR; pushes to `develop` / `main` touching `apps/firebase/**` or `apps/mobile/features/profile/profile-schema.ts` | `yarn test` in `apps/firebase`: rules tests under a Firestore emulator |

## Rules

- **Coverage gate.** `jest.component.config.cjs` fails the run below 95% statements / functions / lines and 75% branches (global). Today: 99.5% lines, 79.5% branches. Raise the numbers when coverage grows; never lower them to land a change.
- **Query like a user.** Find elements by role, accessible name, text or `testID`, never by snapshot or style. Web maps `testID` to `data-testid`.
- **No sleeps.** Wait for a visible state (`expect(...).toBeVisible()`, `findBy*`), never a fixed timeout.
- **State resets.** `tests/component/setup.ts` resets the session and discovery stores before each test. Reset any new store there too. The rules tests call `clearFirestore()` between tests.
- **A bug you can't fix now** gets a failing test marked as expected-to-fail with a one-line reason: `test.failing` (Jest) or `test.fail` (Playwright). Once the bug is fixed, these turn the run red ("unexpected pass"), which tells you to remove the marker. The node runner only has skip (`{ skip: '...' }`, `it.skip`), which stays quiet, so search for `skip` when you fix a bug.
- **New screen checklist:** a component test for its render and taps, an E2E journey that reaches it, its strings in all three locales (the unit test checks key parity), and a Maestro flow when it has a native-only behaviour.
- **New rule checklist:** a test in `apps/firebase/tests` for the allow and for each deny it adds. Write documents with `serverTimestamp()`: the rules compare `updatedAt` to `request.time`, and only a server timestamp resolves to it.

## Gotchas

- The Firebase emulators need Java 17 or newer. firebase-tools is pinned to 13 because 14+ requires Java 21.
- `apps/firebase/.yarnrc` sets `ignore-engines`: `@firebase/rules-unit-testing` 6 declares Node 24, and yarn 1 would otherwise refuse to install it on the Node 22 that the rules workflow uses.
- Each rules test file deploys `firestore.rules` to its own `demo-comradia-rules-*` project before it runs, so parallel files never clear each other's documents or the `demo-comradia` profiles the E2E suite seeds. A project with no deployed ruleset is open, so `tests/helpers.ts` fails the file when the deployment did not land.
- Component tests replace the Firebase backend with the in-memory fake in `tests/component/mocks/backend.ts`: `fakeBackend` signs a user in, seeds profiles, fails the next call with a `BackendErrorCode`, and records what the screen wrote.
- The E2E suite reads the SMS code from the auth emulator's REST API (`latestSmsCode` in `tests/e2e/support/firebase.ts`); it is not delivered anywhere.
- Discover is `/discover` (`discover-like`, `discover-pass`, `discover-refresh`); a test that lands on `/` follows the session redirect first.
- `expo-router/testing-library`'s `renderRouter` still assumes React Native Testing Library 13's synchronous render. Keep the returned value and `await` it; wrapping it in an `async` helper drops `getPathname`. See `renderWelcome` in `tests/component/welcome.test.tsx`.
- Reanimated 4's shipped Jest mock lacks `useReducedMotion`, so `tests/component/mocks/reanimated.ts` stands in for both module ids.
- On web, `accessible={false}` does not hide a view from screen readers; add `aria-hidden` to decorative art. `tests/e2e/a11y.spec.ts` checks it.
- The E2E server runs on port 8199 and is reused locally if already running. With `CI=1` it starts fresh and retries failures twice.
- `CI=1` also turns off Metro's file watching. Never leave a server started with `CI=1` running on 8199 while you edit code: it keeps serving the old bundle. Start a long-lived local one with `EXPO_PUBLIC_FIREBASE_EMULATOR_HOST=127.0.0.1 BROWSER=none npx expo start --web --port 8199`.
- Hooks under `hooks/` import `react-native`, which the `tsx` unit runner cannot load. Test pure logic by moving it into a React Native-free module under `features/`, `constants/` or `services/`, or test the hook in the component layer.

## Known gaps

From `docs/architecture.md` "Deferred", all of these wait on the Blaze plan or a later task:

- **Real SMS** to any number: Spark only allows Firebase test numbers, so phone sign-in is emulator- or test-number-only.
- **Match and message notifications.** Matches and chat work without a server, but push notifications need Cloud Functions.
- **Voice intros and photos:** Cloud Storage on new projects needs Blaze.
- **Age recompute, ranking by shared passions and distance:** a Cloud Function.
- **App Check, account deletion, report / block.**

Known flaky test:

- `sign-in.spec.ts` › Google popup (Chromium projects). After "Sign in" in the auth emulator popup, the result sometimes never reaches the app and the popup stays open, more often when many workers run at once. The test retries twice. Cause not found yet (2026-11-11).
- **Native E2E** runs on the iOS simulator only (4 flows pass, 2026-11-11); Android is not run
  yet. The flows do not cover Like → match → chat (S8–S10): the seed has no likes back.
- **Placeholder stats** on the welcome screen (weather, "214 first dates", "12.4k people") are fixed strings until there is a data source.
