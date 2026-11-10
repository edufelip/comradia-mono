# Comradia

**Where solidarity meets romance.**

One repository for the **Comradia** dating app, its public landing page, and its backend API — built on the MyChampions monorepo stack.

| Path | What it is | Toolchain |
| --- | --- | --- |
| `apps/mobile` | Expo / React Native app (iOS, Android, web) | yarn 1 |
| `apps/server` | Primary API (Bun + Elysia, Drizzle ORM, Postgres) | Bun, pinned in `apps/server/.bun-version` |
| `apps/website` | Public landing page (static HTML, no build) | none |

Each app keeps its own lockfile. The root holds shared scripts, docs, and local orchestration.

## Run everything locally

```bash
bun run local:bun:install   # once, only if `bun --version` differs from apps/server/.bun-version
bun run setup               # installs each app with its own package manager
bun run local:db:up         # local Postgres (:15442) + Redis (:16389) via Docker
bun dev                     # server :3410, Metro, website :3510
```

`bun run local:doctor` checks Bun, Docker, Postgres/Redis, and the server `/health` endpoint.
