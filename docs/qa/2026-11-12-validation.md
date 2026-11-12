# Local validation: 2026-11-12

- Mobile typecheck passes; ESLint exits successfully with zero errors and remaining warnings (not a warning-free claim).
- Node unit tests: 176 passed.
- Component tests: 344 passed in 31 suites. Coverage: statements 95.08%, branches 86.91%, functions 96.1%, lines 98.21%; original 95/75/95/95 floors retained.
- Backend: 158 Firestore/Storage rules tests and 11 Functions adapter tests pass against local emulators. The FCM transport is captured, not delivered.
- iOS: Expo prebuild and CocoaPods sync succeeded; Debug simulator xcodebuild with four jobs and signing disabled succeeded. Entitlement is development; remote-notification background mode is present.
- Android: Expo prebuild and assembleDebug with two workers succeeded; merged manifest includes POST_NOTIFICATIONS and matches-messages channel metadata. APK was not installed by the build lane.
- Earlier full browser run: 135 passed, seven skipped, four failed. It predates the completed motion repairs; current browser/CI rerun remains pending. The safety helper race and unbounded shared-deck traversal were corrected; Google popup and one chat readiness timeout had no confirmed cause. Original screenshots were cleared by a diagnostic invocation; the original log and extracted observations remain. Future runs use unique artifact directories.
- Fresh native dev Auth returns auth.error.unknown on the approved test-number request; no verification screen, provider code/domain, or confirmed cause. Real SMS remains disabled.
- A separate local-emulator two-account/motion pass is in progress. It cannot prove cloud dev Auth or remote push receipt.
- Functions/rules deployment and FCM/APNs provider receipt are not claimed. New token rules and Functions must be rolled out before the new client is shipped.

Runtime source for the final native motion pass is frozen at 8884429. Later test-only commits do not change the app code being exercised.
