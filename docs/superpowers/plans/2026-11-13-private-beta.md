# Private beta parallel delivery

Base: reviewed PR10 head bb19a1c. Integration workspace belongs to coordinator; children share it with exclusive ownership. No child commits, pushes, cloud deployment or extra subagents. Coordinator integrates and reviews once all scopes converge.

## Ownership

- Device/PR10 validation: existing real-phone worktree, exclusive Galaxy A16 UI; preserve native QA receipts and secret boundaries.
- Branding: assets and app icon/notification icon configuration only. Preserve App Check production token exclusion.
- Alert localization: notification handler/tests, token registration/permission files, push-token rule helpers/tests, locale helper and notification-specific copy. Optional registration locale is en-US/pt-BR/es-ES; legacy tokens fall back to English; generic payload privacy remains.
- Trusted cleanup: new Functions cleanup modules/tests and Functions index exports only. Do not edit notification handler or relax message rules. Idempotent deletion, bounded work, recreated-match safety. Code/emulator proof only; deployment and historical live backfill require separate review.
- Profile/discovery: profile editor, discovery filter UI/store, backend profile-update contracts/native/web/fakes and profile-specific copy/tests. Use existing profile fields, preserve birth date/createdAt, and apply age/vibe filters to the existing candidate page with honest empty states. No invented location/distance or inferred gender.

## Integration contracts

Shared files must use focused patches after rereading current contents; do not replace another owner's edits. App config belongs to branding; Functions index belongs to cleanup; backend/types/index native/web and profile UI belong to profile/discovery. Localization dictionaries may receive disjoint named key blocks from profile and alerts; preserve all keys. Firestore rules changes are limited to localization's optional token locale. Any additional shared schema change is reported to coordinator before editing.

Node dependencies are installed by coordinator; no competing installs. Meaningful tests precede behavioral fixes, preserve coverage floors, and record actual exit codes. Preserve focus, reduced motion, localization and accessibility. Exact source/build, emulator tests, native receipt and provider/deployment claims remain separate. No real SMS, credential output, owner data deletion, or new cloud configuration.

## Coordinator follow-up

The cleanup and discovery delegates returned without implementation; coordinator now owns those scopes. Profile delegate is narrowed to profile/editor/backend only. Dependency installation completed. Branding assets/config are implemented; coordinator flattened iOS icon alpha and added a reproducible generator. Cleanup has seven passing real-emulator adapter tests; discovery has25passing component tests and pure unit coverage. Localization/profile/device build remain independent pending lanes. No integration completion claim follows from these scoped checks.


Coordinator completed the cleanup, filters, alert localization, and profile editor/backend after incomplete delegate returns. Branding and the PR10 Android rebuild were completed by Luna; the profile validation draft was integrated and completed by coordinator. Current local results: 195 unit tests, 355 component tests with coverage floors intact, 160 rules tests and 21 Functions tests. Browser profile/filter persistence passed Chromium/WebKit at 390px and Chromium at 320px; full browser regression passed 143 with seven skipped and zero retries; localized acceptance passed nine cases. Independent Luna review found no confirmed actionable defects; genuine two-session chat smoke passed all three browser projects. No cloud deployment or historical data cleanup occurred. The owner released the existing device session after the initial DEVICE_IN_USE failure; PR10 APK install and launch succeeded with the existing QA session preserved. Beta native build/acceptance and new provider delivery remain separate.
