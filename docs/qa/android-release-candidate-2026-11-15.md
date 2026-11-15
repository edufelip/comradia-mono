# Android release candidate validation — 2026-11-15

## Result

The standalone Android dev release APK built successfully and installed on the assigned Samsung Galaxy A16 (Android 16). The APK is configured for `comradia-dev`, includes the standalone JS bundle, and its native App Check debug configuration matches the existing local dev token. Firebase App Check reports Firestore and Storage as `ENFORCED`; the existing token was registered to the dev Android app. No rebuild was performed during the resumed acceptance attempts.

Interactive acceptance remains **blocked before app interaction**. The latest owner confirmation said both Android sessions were released and the Galaxy A16 was unlocked. Fresh bound sessions were returned for the Galaxy and Pixel, but the first app launch on each returned `DEVICE_IN_USE`; one 1-second wait retry per device returned the same owner lock. This lane did not reuse or close those sessions. The previously recorded lock-screen observation is superseded by the owner's unlock confirmation; it is not evidence of the current phone state. No account data was cleared or changed, and no cloud test account or fixture was created. This remains build/install evidence, not journey acceptance.

## Resumed physical-device attempt

- Owner confirmed the Galaxy A16 was unlocked and connected. A new bound session was returned for the specified physical device (`samsung SM-A165M`, Android 16.0; host `76c1bc88-6d2a-4d15-9c8c-ecbfee6e04c5`, device `RXGYC03Z6HN`; session `t3-0c70ea06145bf7162fdba066`).
- `agent-device open com.edufelip.comradia.dev --relaunch` returned `Error (DEVICE_IN_USE)`: the device is held by session `t3-a53e867fd78d1c8b3f4546d9`. Following the CLI advice once, `open ... --relaunch --wait 15000` expired with the same error. The other session was not reused or closed. No snapshot, tap, permission change, or screenshot was attempted after this error.
- The T3 preview status check returned `available=false`, with no tab. No separate browser peer session was available, so a two-account UI flow could not be established.
- Static locale inspection found app localization modules and native locale files for `pt-BR`, `es-ES`, `fr-FR`, `de-DE`, and `it-IT`, including match/chat/notification strings in the inspected sources. These are source-presence observations only; no rendered Android labels or notification copy were verified.
- Device error diagnostic: `/Users/eduwaldo/.agent-device/remote-diagnostics/t3-0c70ea06145bf7162fdba066/requests/c937fac2ed7b1b0f.ndjson`. Prior lock-screen image remains `/tmp/comradia-rc-a16-lockscreen.png` and does not represent the newly confirmed unlocked state.

## Source and build receipt

- Repository HEAD: `dc0615fe9e478129b14d09a785a04cffcf20e30d` (`develop`).
- The initially clean worktree became dirty during this run. At build time it contained uncommitted changes in `apps/mobile/services/backend/app-check.test.ts`, `apps/mobile/services/backend/app-check.ts`, and `apps/mobile/services/backend/index.web.ts`, plus untracked `docs/qa/private-beta-readiness-2026-11-15.md` and `docs/qa/web-app-check-2026-11-15.md`. These changes were not made by this validation lane. The generated Android tree is ignored by Git.
- `APP_VARIANT=dev`; Firebase project: `comradia-dev`; Android package: `com.edufelip.comradia.dev`.
- Fresh `expo prebuild -p android --clean --no-install`: exit 0. The pre-existing local Android debug signing keystore was preserved across the generated-tree refresh.
- Gradle `assembleRelease`: exit 0; `--max-workers=2`, parallel execution disabled, JVM heap capped at 1536 MiB and metaspace at 512 MiB.
- Standalone APK: `/Users/eduwaldo/Projects/comradia-mono/apps/mobile/android/app/build/outputs/apk/release/app-release.apk`.
- APK SHA-256: `50b1ed18f4f0d167dd24e921dc5b39abe6a8c43bb31c70a1d83f1b0c8b54ab62`; size 139,359,817 bytes.
- APK signature verification: passed; signed with the existing Android debug key. The APK is a dev RC artifact, not a production/store build.
- APK metadata identifies variant `release` and application ID `com.edufelip.comradia.dev`; `assets/index.android.bundle` is present, so startup does not require Metro.
- The generated RNFirebase App Check release BuildConfig value matched the existing local dev debug token without printing it. Firebase App Check token creation returned HTTP 200; the named registration was visible in the token list. The token value is not included in this report.
- Live App Check service configuration readback for `comradia-dev`: `firestore.googleapis.com=ENFORCED`, `firebasestorage.googleapis.com=ENFORCED`.
- Final build log: `/tmp/comradia-rc-gradle.log`. The first harness attempt used the wrong Gradle working directory and exited nonzero before compiling; the corrected build above is the final successful attempt.

## Galaxy A16 receipt

- Host: `76c1bc88-6d2a-4d15-9c8c-ecbfee6e04c5`; device: `RXGYC03Z6HN`; Samsung SM-A165M, Android 16.
- Install command returned `Installed: com.edufelip.comradia.dev` using the bound `agent-device` session.
- `agent-device open com.edufelip.comradia.dev --relaunch` was dispatched. The subsequent snapshot showed the Android keyguard (“Use fingerprint or draw the pattern”), not Comradia.
- Lock-screen evidence: `/tmp/comradia-rc-a16-lockscreen.png`.
- The existing installation was updated in place. No app-data reset, uninstall, Auth deletion, Firestore clear, or Storage cleanup was performed. Account retention after update is not verified because the app UI could not be reached.

## Case results

| Case | Result | Evidence / limit |
| --- | --- | --- |
| Fresh standalone dev release build | PASS | Gradle exit 0; signed APK and embedded JS bundle verified. |
| Dev App Check token configuration and registration | PASS | Native BuildConfig matched local token; Firebase create returned 200 and registration name read back. Secret omitted. |
| Firestore and Storage App Check enforcement | PASS | Both service configurations read back `ENFORCED`. |
| Install on assigned Galaxy A16 | PASS | Bound `agent-device install` receipt returned success. |
| App launch and existing-account retention | BLOCKED / UNVERIFIED | Fresh launch could not be issued because another device session owns the phone; no account data was cleared. |
| Sign-in and onboarding, including profile photo | UNVERIFIED | No app interaction after the fresh launch failed on device-session ownership; no sign-in, SMS, upload, or account creation was attempted. |
| Independent second account, mutual likes, match, and chat | UNVERIFIED | No two-account UI session was run; no admin-injected replies or synthetic relationship writes were used. |
| Foreground, background, terminated notification receipt and notification taps | UNVERIFIED | No fresh FCM event was sent and no notification tap was exercised in this run. |
| Blocked and signed-out notification behavior | UNVERIFIED | Device UI was inaccessible. |
| Disposable-account deletion and backend cleanup | UNVERIFIED | No disposable account was created; no account or backend data was deleted. |
| Android-rendered PT/ES/FR/DE/IT app labels and prompts | UNVERIFIED | Static source files and match/chat/notification strings are present. Rendered copy, language switching, keyboard, photo permission, and notification prompts were not observed. |

## Blocker and next evidence

The earlier preview attempt was also blocked by the active Galaxy owner session; the later two-device follow-up additionally found the Pixel held by another session. Resume when both devices are available to their assigned QA lane. Do not take over or close existing sessions. No production release, invitation, deployment, or external distribution occurred.

## Two-device follow-up — 2026-11-15

The owner confirmed both Android sessions were released and the Galaxy A16 was unlocked and connected. This follow-up requested fresh bound sessions for both assigned devices, but the first app relaunch on each was still blocked by a different active owner session. The one-time wait hint was followed for 1 second on each device; both remained busy. No takeover, session inspection, or other-session close was attempted.

- Physical device: host `76c1bc88-6d2a-4d15-9c8c-ecbfee6e04c5`, id `RXGYC03Z6HN`, Samsung SM-A165M, Android 16.0. Fresh bound session `t3-dadf98bec6e00781806189e0`; relaunch failed with `DEVICE_IN_USE`, held by `t3-a53e867fd78d1c8b3f4546d9`. The 1-second wait retry returned the same owner and error.
- Local emulator: host `local`, id `emulator-5554`, Pixel 10, Android. Fresh bound session `t3-eb8e64963c63b115a7e19764`; relaunch failed with `DEVICE_IN_USE`, held by `t3-a86697a8b6e1d6878de15301`. The 1-second wait retry returned the same owner and error.
- Close on both newly returned bound commands reported `SESSION_NOT_FOUND`; neither command had opened an app, and no other session was closed. No snapshots, screenshots, taps, locale/settings changes, text entry, notification actions, or app launches succeeded in this follow-up.
- The APK was not rebuilt or reinstalled. Read-only SHA-256 verification remains `50b1ed18f4f0d167dd24e921dc5b39abe6a8c43bb31c70a1d83f1b0c8b54ab62` at `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`.
- A fresh authenticated Identity Toolkit Admin v2 read returned HTTP 200 and found two configured no-SMS phone test fixtures. Only the count and metadata path were emitted; numbers and OAuth token remained internal. Device ownership prevented safely reading the current account's Auth identity, so no fixture was associated with either existing profile.
- No app source/config/environment changes, cloud writes, account changes, invites, notification sends, commits, pushes, or deployments were made.

All native user-flow cases remain blocked/unverified in this follow-up: fresh login/onboarding/profile/photo, independent-account mutual likes/match/chat, foreground/background/terminated push receipt and taps, permission-denied behavior, signed-out/blocked notification behavior, keyboard entry, native PT/ES/FR/DE/IT render, and photo-picker localization. No screenshot is attached because the bound sessions could not launch the app or read a device screen. Exact receipts and the final case matrix are in `/tmp/comradia-rc-android-two-device-final.md`.
