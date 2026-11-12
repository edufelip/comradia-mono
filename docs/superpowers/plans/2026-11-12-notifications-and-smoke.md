# Notifications and smoke validation implementation plan

> For agentic workers: execute assigned ownership scopes under the coordinating agent; no further subdelegation.

**Goal:** Correct contradictory documentation, exercise the existing two-account native journey, and implement match/message push notifications.

**Architecture:** Native Firebase Messaging registers private per-user device tokens. Firebase v2 Firestore triggers dispatch generic notifications after current membership and block checks. Web remains supported without native messaging. Deployment and provider receipts are separate from code validation.

**Tech Stack:** Expo 54, React Native Firebase 23.8.8, Firebase Functions v2/Admin, TypeScript, existing node/Jest/emulator testing.

## Task 1: Documentation

- [ ] Compare README, docs/architecture.md and docs/testing.md with source and merged PR8.
- [ ] Correct dev SMS policy and Storage reader/owner distinctions without publishing private test phone numbers.
- [ ] Run git diff --check and inspect every changed claim.

## Task 2: Existing native two-account journey

- [ ] Use T3 device_open with host local and Comradia Photos simulator 80E8D79F-1C6F-4D7D-BF7A-6877535ED7D8.
- [ ] Record actual build/backend; run test-number authentication, onboarding/photos, mutual matching, chat and blocking where feasible.
- [ ] Preserve existing owner accounts; destructive deletion only on disposable QA accounts.
- [ ] Save evidence under /tmp/comradia-smoke; report unavailable steps explicitly.

## Task 3: Push server

Ownership: apps/firebase/** and .github/workflows/firebase-rules.yml.

- [ ] Add failing rules tests for users/{uid}/pushTokens/{sha256(token)} exact fields token/platform/updatedAt, owner binding, platform enum and timestamp; default deny server delivery state.
- [ ] Implement token rules and verify allow/deny tests with emulators.
- [ ] Add failing handler tests for match/message recipient selection, privacy, blocked/deleted members, invalid sender, duplicates and invalid-token pruning.
- [ ] Implement v2 Functions handlers and real Admin adapters; use generic payload data type/matchId and Android channel matches-messages.
- [ ] Document the delivery claim crash-window tradeoff; never claim exactly-once external delivery.
- [ ] Add Functions build/test to local scripts/config and existing validation CI; run checks without deployment.

## Task 4: Native client

Ownership: apps/mobile/**.

- [ ] Add failing lifecycle and tap tests before implementation: denied permission, refresh, signout/rotation races, stale user, inaccessible match.
- [ ] Add matching Firebase Messaging dependency, Expo configuration and web-safe platform boundary.
- [ ] Register token only for authenticated ready sessions with permission; request permission on explicit Profile action.
- [ ] Revoke registration before signout, remove token subcollection before account deletion, serialize ownership transitions.
- [ ] Validate cold/warm tap data and current match/block access before routing after session readiness.
- [ ] Add localized Profile controls and focused component coverage in English, Portuguese and Spanish.
- [ ] Run typecheck, lint, unit and component checks. Keep existing smoke build/Metro untouched.

## Task 5: Integration and delivery

- [ ] Coordinator reviews actual diff and independently verifies affected test layers.
- [ ] Capture native-build, emulator, cloud-deployment and device-receipt status as distinct evidence.
- [ ] Prepare reviewable PR; retain existing owner approval boundary for merge/deploy.
