# Agent instructions (whole repository)

Rules for any AI coding agent working in `comradia-mono`.

| Path | App | Toolchain & Tests |
| --- | --- | --- |
| `apps/mobile` | Expo / React Native app (yarn) | `yarn test:all` (typecheck, lint, unit, component + coverage, E2E web) |
| `apps/firebase` | Firestore rules, emulator config, seed, rules tests | `yarn test` (starts a Firestore emulator) |
| `apps/website` | Static landing page | HTML/CSS/JS |

Every app keeps its own toolchain and lockfile; the root is not a workspace. Run app commands from the app folder. There is no server: Firebase Auth, Firestore and its security rules are the backend, so changes to what a user may read or write belong in `apps/firebase/firestore.rules` and need a test there.

Testing: read `docs/testing.md` before adding or changing behaviour. Every change ships with a test in the layer that owns it; don't lower the coverage thresholds.
