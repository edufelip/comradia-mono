# Agent instructions (whole repository)

Rules for any AI coding agent working in `comradia-mono`.

| Path | App | Toolchain & Tests |
| --- | --- | --- |
| `apps/mobile` | Expo / React Native app (yarn) | `yarn test:all` (typecheck, lint, unit, component + coverage, E2E web) |
| `apps/server` | Primary API, Bun + Elysia + Drizzle | `bun test` |
| `apps/website` | Static landing page | HTML/CSS/JS |

Every app keeps its own toolchain and lockfile; the root is not a workspace. Run app commands from the app folder. Root commands (`bun run setup`, `bun dev`, `bun run local:db:up`, `bun run local:doctor`) orchestrate the apps; the Bun pin lives in `apps/server/.bun-version`.

Testing: read `docs/testing.md` before adding or changing behaviour. Every change ships with a test in the layer that owns it; don't lower the coverage thresholds.
