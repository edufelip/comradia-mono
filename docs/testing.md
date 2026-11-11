# Testing

Five test layers, fastest first. Run the cheapest layer that proves your change, and add a test in the layer that owns the behaviour.

| Layer | What it proves | Tool | Where tests live | Command (from the app folder) | Time (local) |
| --- | --- | --- | --- | --- | --- |
| Unit | Pure logic: stores, theme tokens and contrast, translations, locale resolution | `node:test` via `tsx` | next to the source: `constants/`, `features/`, `localization/` `**/*.test.ts` | `yarn test` | ~1 s |
| Component | Screens and components render and react to taps; routing redirects | Jest + `jest-expo` + React Native Testing Library + `expo-router/testing-library` | `apps/mobile/tests/component/*.test.tsx` | `yarn test:component` (`:coverage` to enforce thresholds) | ~2 s warm, ~10 s cold |
| E2E web | Real user journeys in real browsers (Chromium + WebKit, 390×844 and 320×568, dark mode, pt-BR / es-ES, accessibility tree) | Playwright, against `expo start --web` | `apps/mobile/tests/e2e/*.spec.ts` | `yarn test:e2e` (`:ui` to debug) | ~16 s |
| E2E native | The same journeys on iOS / Android | Maestro | `apps/mobile/.maestro/*.yaml` | `yarn test:e2e:native` (needs a dev build installed on a booted simulator or emulator) | not run in CI yet |
| Server API | Every route through `app.handle()`, config parsing, CORS, JWT wiring, DB schema metadata | `bun test` | `apps/server/tests/*.test.ts` | `bun test` in `apps/server` (or `bun run server:test` from the root) | <1 s |

`yarn test:all` in `apps/mobile` runs typecheck, lint, unit, component (with coverage) and E2E web in that order.

## CI

| Workflow | Runs when | Jobs |
| --- | --- | --- |
| `.github/workflows/mobile-tests.yml` | PR or push to `develop` / `main` touching `apps/mobile/**` | `checks` (typecheck, lint, format, unit, component + coverage) and `e2e-web` (Playwright, in parallel; report uploaded on failure) |
| `.github/workflows/server-tests.yml` | PR or push touching `apps/server/**` | typecheck + `bun test` with the pinned Bun version |

Both cancel an older run on the same branch. Playwright browsers are cached by version. Maestro is not in CI: it needs a native build and a simulator.

## Rules

- **Coverage gate.** `jest.component.config.cjs` fails the run below 95% statements / functions / lines and 75% branches (global). Today: 99.5% lines, 79.5% branches. Raise the numbers when coverage grows; never lower them to land a change.
- **Query like a user.** Find elements by role, accessible name, text or `testID`, never by snapshot or style. Web maps `testID` to `data-testid`.
- **No sleeps.** Wait for a visible state (`expect(...).toBeVisible()`, `findBy*`), never a fixed timeout.
- **State resets.** `tests/component/setup.ts` resets the session and discovery stores before each test. Reset any new store there too.
- **A bug you can't fix now** gets a failing test marked as expected-to-fail with a one-line reason: `test.failing` (Jest) or `test.fail` (Playwright). Once the bug is fixed, these turn the run red ("unexpected pass"), which tells you to remove the marker. The node and Bun runners only have skip (`{ skip: '...' }`, `it.skip`), which stays quiet, so search for `skip` when you fix a bug.
- **New screen checklist:** a component test for its render and taps, an E2E journey that reaches it, its strings in all three locales (the unit test checks key parity), and a Maestro flow when it has a native-only behaviour.

## Gotchas

- `expo-router/testing-library`'s `renderRouter` still assumes React Native Testing Library 13's synchronous render. Keep the returned value and `await` it; wrapping it in an `async` helper drops `getPathname`. See `renderWelcome` in `tests/component/welcome.test.tsx`.
- Reanimated 4's shipped Jest mock lacks `useReducedMotion`, so `tests/component/mocks/reanimated.ts` stands in for both module ids.
- On web, `accessible={false}` does not hide a view from screen readers; add `aria-hidden` to decorative art. `tests/e2e/a11y.spec.ts` checks it.
- The E2E server runs on port 8199 and is reused locally if already running. With `CI=1` it starts fresh and retries failures twice.
- Hooks under `hooks/` import `react-native`, which the `tsx` unit runner cannot load. Test pure logic by moving it into a React Native-free module under `features/` or `constants/`, or test the hook in the component layer.

## Known gaps

- **Server CORS in production:** with `NODE_ENV=production` and no `WEB_ALLOWED_ORIGINS`, any origin is allowed with credentials. `apps/server/tests/cors.test.ts` holds the skipped test.
- **Not testable yet:** no route verifies a JWT and rate limiting isn't registered, so there is no auth rejection or rate limit to test. `apps/server/tests/auth.test.ts` fails as soon as a route is added, as a reminder to cover it.
- **Native E2E** flows are written and their syntax is checked, but they have not run on a device.
- **Placeholder stats** on the welcome screen (weather, "214 first dates", "12.4k people") are fixed strings until the server provides them.
