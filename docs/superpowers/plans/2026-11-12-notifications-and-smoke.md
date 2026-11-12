# Notifications and smoke validation implementation plan

> For agentic workers: execute assigned ownership scopes under the coordinating agent; no further subdelegation.

**Goal:** Correct contradictory documentation, exercise the existing two-account native journey, and implement match/message push notifications.

**Architecture:** Native Firebase Messaging registers private per-user device tokens. Firebase v2 Firestore triggers dispatch generic notifications after current membership and block checks. Web remains supported without native messaging. Deployment and provider receipts are separate from code validation.

**Tech Stack:** Expo 54, React Native Firebase 23.8.8, Firebase Functions v2/Admin, TypeScript, existing node/Jest/emulator testing.

## Task 1: Documentation

- [x] Compare README, docs/architecture.md and docs/testing.md with source and merged PR8.
- [x] Correct dev SMS policy and Storage reader/owner distinctions without publishing private test phone numbers.
- [x] Run git diff --check and inspect every changed claim.

## Task 2: Existing native two-account journey

- [x] Use T3 device_open with host local and Comradia Photos simulator 80E8D79F-1C6F-4D7D-BF7A-6877535ED7D8.
- [x] Record actual build/backend; run local two-account authentication, onboarding/photos, both UI Like legs, mutual matching, two-way chat, blocking and disposable-account removal. Keep cloud Auth/provider receipts distinct.
- [x] Preserve existing owner accounts; destructive deletion only on disposable QA accounts.
- [x] Save evidence under /tmp/comradia-smoke; report unavailable steps explicitly.

## Task 3: Push server

Ownership: apps/firebase/** and .github/workflows/firebase-rules.yml.

- [x] Add failing rules tests for users/{uid}/pushTokens/{sha256(token)} exact fields token/platform/updatedAt, owner binding, platform enum and timestamp; default deny server delivery state.
- [x] Implement token rules and verify allow/deny tests with emulators.
- [x] Add failing handler tests for match/message recipient selection, privacy, blocked/deleted members, invalid sender, duplicates and invalid-token pruning.
- [x] Implement v2 Functions handlers and real Admin adapters; use generic payload data type/matchId/recipientUid and Android channel matches-messages.
- [x] Document the delivery claim crash-window tradeoff; never claim exactly-once external delivery.
- [x] Add Functions build/test to local scripts/config and existing validation CI; run checks without deployment.

## Task 4: Native client

Ownership: apps/mobile/**.

- [x] Add failing lifecycle and tap tests before implementation: denied permission, refresh, signout/rotation races, stale user, inaccessible match.
- [x] Add matching Firebase Messaging dependency, Expo configuration and web-safe platform boundary.
- [x] Register token only for authenticated ready sessions with permission; request permission on explicit Profile action.
- [x] Revoke registration before signout, remove token subcollection before account deletion, serialize ownership transitions.
- [x] Validate cold/warm tap data and current match/block access before routing after session readiness.
- [x] Add localized Profile controls and focused component coverage in English, Portuguese and Spanish.
- [x] Run typecheck, lint, unit and component checks. Keep existing smoke build/Metro untouched.

## Task 5: Integration and delivery

- [x] Coordinator reviews actual diff and independently verifies affected test layers.
- [x] Capture native-build, emulator, cloud-deployment and device-receipt status as distinct evidence.
- [x] Prepare reviewable PR; retain existing owner approval boundary for merge/deploy.

## Current acceptance limits

- Local two-account journeys and recorded match timing are complete on the standard signed simulator artifact. The invisible OTP input was corrected without changing its appearance. Reduced Motion was exercised and its original off state restored. A recoverable profile-read error and one delayed emulator commit remain observations without a proven SDK cause.
- Account/profile/photo removal passed. The previously documented peer-message orphan remains; complete historical message cleanup still needs the deferred trusted-server work.
- PR9 contains the code, native build and QA evidence. All four checks passed at runtime-source head `0f540ca`; its browser run included one retry pass at a default page-load wait. The scoped reload-readiness correction retains all app-state assertions. Final-head CI is pending at the time of this report; PR9's Checks provides the later result, separate from the pinned native runtime receipts.
- The bounded cloud DEV phone request still stops before Verify with `auth/operation-not-allowed` after reCAPTCHA; its precise provider/configuration cause is unconfirmed. No SMS/configuration change or bypass was made.
- Notification Functions/rules have not been deployed, and no FCM/APNs device receipt is claimed. Merge and cloud rollout remain an owner decision.
