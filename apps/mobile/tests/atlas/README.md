# Comradia screenshot runner

From `apps/mobile`:

```sh
yarn test:atlas                         # every web checkpoint, all three sizes
yarn test:atlas 13-profile.edit         # one checkpoint at every size
yarn test:atlas --project=mobile        # every checkpoint at one size
yarn test:atlas 13-profile.edit --project=tablet
```

Install this app's dependencies with `yarn install --frozen-lockfile` and install Playwright Chromium before first use. The wrapper refuses an occupied port **8288**, reports its listener when available, and never reuses or kills another server. Playwright owns the atlas server and stops it after the run. Do not start concurrent atlas runs on the same port.

Each invocation creates an exclusive directory under `.artifacts/flow-atlas/<timestamp>-<unique-id>/`. It never removes old captures. The last console line names that exact root, even on failure. An existing directory cannot be reused.

## Outputs

- `manifest.json`: immutable copy of the checkpoint definition used for this run.
- `run.json`: app SHA, dirty paths, manifest SHA, selected scope, expected capture count, exit status, timestamps, Playwright results and failures.
- `runner-source.json`: non-secret runner/config/fixture source snapshot; hashes recorded in `run.json` preserve evidence for an uncommitted runner.
- `<flow>/<checkpoint>/<mobile|tablet|web>.png`: screenshot only after the scenario's expected-state assertion passes.
- Matching `.json`: checkpoint, viewport dimensions, locale/theme, expected state, source SHA, synthetic fixture label, expanded-scroll flag and `unbaselined` marker.
- `results.json` and `html/index.html`: machine-readable Playwright results and local HTML report with screenshot attachments.
- `playwright/`: failure traces and diagnostics. A failed scenario never produces a successful atlas checkpoint screenshot.

The wrapper exits nonzero on server/capture failures. Run statistics are **capture results**, not a full atlas verification or visual acceptance verdict. No pixel baseline, standalone coverage verifier, Linear filing or hosted proof publishing is implemented here.

## Determinism and evidence boundary

The three Chromium projects use 390×844, 820×1000 and 1440×1000 with scale factor 1. Each checkpoint has a fresh browser context, fixed fixture identities/dates/text and synthetic SVG portraits. Browser time starts at 2026-11-13T12:00Z; verification pauses the clock and advances each interval explicitly for stable countdowns. Reduced motion is enabled, screenshot animations/carets are disabled, and font loading is awaited. Locale-specific and dark checkpoints explicitly set those contexts. Determinism covers the scenario, fixture data, clock and dimensions; browser rasterization may vary at antialiased edges, so these captures are not a byte-identical pixel baseline.

The default shell remains Comradia's existing bottom tabs at every width. The combined Portuguese/Spanish dark-filter checkpoint was split into separate checkpoint IDs: **140 web checkpoints / 420 planned captures**, with **20 native-only checkpoints excluded**.

`fullPage` alone clips React Native Web's nested ScrollViews. After assertions, the writer expands the active scroll area and its containing height without changing width; this produces a full-content representation and records `expandedScroll`. The writer clips to the requested viewport width and the laid-out content height, excluding decorative absolute overflow; the exact rectangle is recorded as `captureBounds`. It is not a literal viewport screenshot for keyboard/overlay geometry. Native keyboard and OS surfaces require their separate device lane.

## Isolated backend

Only the atlas server has `COMRADIA_ATLAS=1`. Its Metro resolver aliases the backend and photo picker to test-only adapters. Default Metro resolution stays unchanged and has a regression test. No production route/backend contains an atlas switch. The browser blocks non-local HTTP traffic; the fixture backend never connects to Firebase or sends SMS, push notifications or reports to real people.

`backend.web.ts` exports the typed Backend interface and a fixture controller on this isolated build. It reuses the existing in-memory component backend. Holds, one-shot errors, live messages, navigation covers and session switches drive **real production components**. Some component-only states (such as a ready session temporarily missing its profile) are forced explicitly for rendering coverage. They are not claims about live reachability or server security.

These captures prove synthetic UI rendering, not emulator/rules behavior, real two-account networking, provider delivery, camera/library permissions, App Check, or destructive cloud cleanup. Native-only manifest checkpoints are intentionally not run. Use existing E2E/emulator tests for integration evidence.

## Runner checks

```sh
node --test scripts/atlas/artifacts.test.mjs
./node_modules/.bin/tsx --test tests/atlas/backend.test.ts tests/atlas/capture-layout.test.ts
yarn typecheck
```

The checks cover exclusive roots/path confinement, opt-in Metro aliasing, and held/one-shot failure behavior, and screenshot bounds for decorative overflow and long content. Scenario assertions and capture results establish browser execution separately.
