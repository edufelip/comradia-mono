# Release-candidate status — 2026-11-15

Base commit: `dc0615fe9e478129b14d09a785a04cffcf20e30d`. The web App Check fix is saved in commit `084671d` on `fix/web-app-check-ssr`; these QA reports accompany it. The coordinator reran all 219 mobile unit tests and typecheck before committing. This is not a release sign-off.

## Verified evidence

- Dev rules match source, six Functions are active, cleanup TTL is active, and Firestore/Storage App Check is enforced. See `/tmp/comradia-dev-deployment-2026-11-15.md`.
- Local dev web: localhost-restricted reCAPTCHA key registered; agent observed a successful nondebug token exchange, authenticated Firestore operations and Storage upload. Coordinator independently read back key restrictions/enforcement and reran focused tests/typecheck. See [web evidence](web-app-check-2026-11-15.md). Hosted domains/public deployment are separate.
- Android: standalone dev APK built and installed on Galaxy A16 and Pixel emulator; coordinator verified APK hash. Earlier emulator pass observed English/PT/ES UI and photo picker opening. See [Android RC](android-release-candidate-2026-11-15.md) and [emulator acceptance](android-emulator-acceptance-2026-11-15.md).
- iOS: simulator build installed/launched on dedicated Comradia QA simulator, with Metro supplying JS. Agent rendered PT/ES/FR/DE/IT and checked Spanish editor/keyboard, preserving existing account data. Coordinator inspected French and German originals and verified executable hash against the build receipt. See [iOS acceptance](ios-simulator-acceptance-2026-11-15.md). App Check debug-token registration succeeded; no independent native network-operation trace was captured.

## Open acceptance gates

1. Android control-plane ownership: original agent-device session claims persisted after user-confirmed Device-panel release; new child sessions failed with DEVICE_IN_USE on both Android targets. No further retry tasks should start until ownership is cleared. Diagnostic: `/tmp/comradia-device-session-blocker-2026-11-15.md`. No claims/processes/other sessions were changed by the coordinator.
2. Native fresh sign-in, profile/photo writes, true two-account match/chat, notification lifecycle/taps, safety and disposable-account cleanup remain unverified. Two no-SMS Auth fixtures exist in provider configuration; absence of their values in repository documentation is not itself a missing-user-input dependency. Safe account association and access are still needed before mutation.
3. Physical iOS signing and APNs delivery remain unverified. An ad-hoc simulator build does not qualify these.
4. Android FR/DE/IT interactive rendering remains unverified. Declaration in APK/source is not runtime acceptance; no missing-language defect is confirmed.
5. Crashlytics actual event receipt and moderation alert receipt remain unverified. Configured native SDK/owner registration are not delivery receipts. See [beta readiness](private-beta-readiness-2026-11-15.md).
6. Public legal/controller identity and working support/privacy contacts still need user-supplied final details and publication. Proposed email aliases have not been provisioned. The supplied Hotmail contact is scoped to the AWS backup incident, not app privacy/support.
7. AWS backup incident is reported resolved by the owner; no independent rotation verification was performed. No further AWS work is scheduled. Incident report: `/tmp/comradia-backup-credential-incident-2026-11-15.md`.

No invitations, production deployment, store submission or release is claimed. Next execution should address the ownership-layer blocker and remaining provider/device receipts, rather than repeat builds or represent partial UI checks as full acceptance.
