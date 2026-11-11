# Comradia

**Where solidarity meets romance.**

Comradia is a dating app for people on the left: sign in, build a card from your vibe, values and a prompt answer, and swipe through other members. One Expo app on top of Firebase — no server of our own. Firebase Auth signs people in, Firestore stores the data, and Firestore security rules are the only gate between users.

## Layout

| Path | What it is | Toolchain |
| --- | --- | --- |
| `apps/mobile` | The app (iOS, Android, web) | Expo, yarn 1 |
| `apps/firebase` | Firestore rules, emulator config, seed script, rules tests | firebase-tools 13, yarn 1 |
| `apps/website` | Public landing page (static HTML, no build) | none |
| `docs` | Architecture and testing notes | — |

Each app keeps its own `package.json` and lockfile; the root is not a workspace. Run commands from the app folder.

## Prerequisites

- Node 22 or newer, plus yarn 1 (`npm i -g yarn`).
- Java 17 or newer, for the Firebase emulators. firebase-tools is pinned to 13 because 14+ needs Java 21.
- Xcode or Android Studio only if you want a native build; web needs neither.

## Run it locally

The app talks to the Firebase emulators. Use two terminals:

```bash
# terminal 1: auth on :9099 and Firestore on :8089
cd apps/firebase && yarn install && yarn emulators

# terminal 2: the app on http://localhost:8081
cd apps/mobile && yarn install
EXPO_PUBLIC_FIREBASE_EMULATOR_HOST=127.0.0.1 yarn web
```

`yarn seed` in `apps/firebase` adds three Discover profiles to the emulators.

On an Android emulator the host is `10.0.2.2` instead of `127.0.0.1`. Without `EXPO_PUBLIC_FIREBASE_EMULATOR_HOST` the app uses the `demo-comradia` project, which only works against the emulators.

## Docs

- [docs/architecture.md](docs/architecture.md) — decisions, data model, rules, screens, environments.
- [docs/testing.md](docs/testing.md) — the test layers and how to run them.
