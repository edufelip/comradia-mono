# Android emulator acceptance — 2026-11-15

## Result

The standalone dev APK installed and launched on the assigned local Pixel 10 emulator. The app opened to an already signed-in profile and rendered it in English, Portuguese (Brazil), and Spanish (Brazil) using Android's per-app language settings. The profile editor opened, and the Android photo picker opened without a media permission prompt; it was cancelled without selecting or uploading a file.

This is **partial native acceptance**, not a release-candidate sign-off. The signed-in profile was treated as unknown existing account data and left unchanged. Fresh phone sign-in, onboarding, profile/photo writes, direct Firestore/Storage network receipt, keyboard entry, FR/DE/IT native text, two-account match/chat, notification receipt/taps, and disposable-account cleanup were not verified in that emulator acceptance run. Its follow-up is recorded below; no existing profile was changed.

## Run identity and boundaries

- Repository: `/Users/eduwaldo/Projects/comradia-mono`, branch `develop`, HEAD `dc0615fe9e478129b14d09a785a04cffcf20e30d`.
- Worktree at start: the three uncommitted web App Check files and existing QA documents recorded in `android-release-candidate-2026-11-15.md`; no tracked source or environment files were changed in this emulator run.
- Device: host `local`, id `emulator-5554`, inventory name `Pixel_10`, platform Android, booted. Device inventory reported OS version as `Android` without a specific API/release value.
- Device session: opened and operated only through the bound `agent-device` session returned for `local` / `emulator-5554`.
- APK: `/Users/eduwaldo/Projects/comradia-mono/apps/mobile/android/app/build/outputs/apk/release/app-release.apk`.
- APK SHA-256, rechecked before install: `50b1ed18f4f0d167dd24e921dc5b39abe6a8c43bb31c70a1d83f1b0c8b54ab62`.
- Package / Firebase project: `com.edufelip.comradia.dev` / `comradia-dev`; standalone release-variant APK with embedded JS bundle, as recorded in the Android RC build receipt.
- Installed in place with the supported `agent-device install` command. No uninstall, clear-app-state, account reset, seeded admin write, or cloud cleanup was performed.
- App Check: the preceding Android RC receipt records the native debug token registration and Firestore/Storage enforcement as `ENFORCED`. This run kept token values opaque. The emulator profile render is evidence that the existing signed-in UI loaded; the native Firebase SDK traffic did not appear in the `agent-device` HTTP log parser, so this run does **not** provide a fresh network-level App Check/Auth/Firestore/Storage receipt.
- Physical Galaxy A16 owner session and iOS device `80E8D79F-1C6F-4D7D-BF7A-6877535ED7D8` were not used.
- No participant invitations, public release, commit, push, deploy, native config/source edit, or shared environment edit occurred.

## Cases

| Case | Result | Observed evidence and limit |
| --- | --- | --- |
| Install exact APK | PASS | `agent-device install` returned `Installed: com.edufelip.comradia.dev`; hash matched the requested artifact. Existing app data was preserved in place. |
| Startup | PASS | Relaunch opened Comradia to Discover with no Metro dependency or startup error observed. |
| Existing-session profile read/render | PARTIAL | Profile screen rendered Rosa's existing values in English, PT-BR, and ES. This session was not signed out or reset. A cached render cannot be distinguished from a fresh backend read from the available native traffic log. |
| Auth / fresh login | NOT RUN | No phone number or verification code was entered. The repo docs identify two configured no-SMS Firebase test numbers but do not include their numbers; no other number was used. |
| Onboarding | NOT RUN | No new account was created. Avoided edits to the existing account and did not use real SMS. |
| Profile editor / keyboard | PARTIAL | Editor opened in Spanish and showed translated labels and existing values. Focusing the name field left the keyboard hidden (`keyboard status`: `Keyboard visible: no`), including after opening the session with `--no-test-ime`. No text was typed and no save was attempted. |
| Photo picker / permission | PARTIAL | `Add a photo` opened Android's system photo picker (`Coleções`). No permission prompt was shown. The picker was cancelled; no image was selected, and no upload/network success was claimed. |
| Existing profile photo render | NOT PASSED | The current profile showed the initials fallback (`R`) rather than a loaded portrait. No replacement, removal, or upload was attempted on this account. |
| Native locale PT-BR | PASS | Android per-app language control set Portuguese (Brasil); relaunch showed `Conheça alguém que realmente se importa.` and translated navigation/profile copy. |
| Native locale ES | PASS | Android per-app language control set Español (Brasil); relaunch showed `Conoce a alguien que realmente se preocupa.` and translated profile labels/values. |
| Native locale FR / DE / IT | NOT RUN | The installed app's Android per-app language screen exposed English, Spanish, and Portuguese choices. The visible “Todos os idiomas” footer did not open another list. No native text/keyboard/photo check is claimed for French, German, or Italian. Their presence in source dictionaries is not runtime acceptance. |
| Auth/profile/photo App Check network proof | NOT VERIFIED | The preceding RC receipt documents registered native debug token and both services enforced. This run observed the signed-in UI render and picker opening, but no fresh request/response receipt for auth, Firestore profile, or Storage photo upload. |
| Independent two-account like/match/chat | NOT RUN | No safe second independently authenticated context and documented disposable account credentials were available in the materials read for this run. No admin-injected match or message writes were used. |
| Notifications / FCM | NOT RUN | No FCM event was created. Provider acceptance, emulator receipt, and tap routing remain unverified here. |
| Safety / account deletion / backend cleanup | NOT RUN | No report, block, sign-out, or deletion action was executed on the existing account. No disposable account was created, so no cleanup claim applies. |
| Physical A16 | BLOCKED / UNCHANGED | Prior RC run observed the lock screen. This run did not touch or reuse the A16 session and did not request another unlock. |

## Evidence files

- English profile after restoring the app language: `/tmp/comradia-android-emulator-profile-en.png`.
- Android system photo picker before cancelling: `/tmp/comradia-android-emulator-photo-picker.png`.
- APK build/install receipt and original App Check configuration evidence: `docs/qa/android-release-candidate-2026-11-15.md`.
- Relevant interaction proof in this run was through the bound device session snapshots and screenshot outputs; native Firebase SDK calls were not surfaced as HTTP entries by `agent-device network dump`.

## Final device state

The emulator app language was restored to English, the existing session remained signed in, and the profile editor and photo picker were closed without saving or selecting media. The synthetic web QA profile/portrait from the separate web validation was not opened or changed. The A16 and iOS device remain outside this run.

## Follow-up — 2026-11-15

This follow-up continued the emulator-only gaps without changing app/config source, cloud resources, account data, or the installed APK.

- A fresh `device_open` was requested for host `local`, device `emulator-5554`. The returned bound `agent-device` CLI refused the relaunch with `DEVICE_IN_USE` because a different session already owned the emulator. Following the CLI hint once, I retried with `--wait 1000`; it remained busy and returned `DEVICE_IN_USE` again. I did not inspect, reuse, or close that session. Therefore no new app launch, settings/language change, tap, keyboard input, picker interaction, or screenshot was performed.
- Rechecked the installed artifact path from the prior run: SHA-256 remains `50b1ed18f4f0d167dd24e921dc5b39abe6a8c43bb31c70a1d83f1b0c8b54ab62`.
- Read-only locale inspection found `app.config.ts` declares Android `en`, `pt`, `es`, `fr`, `de`, and `it`; the Android manifest points `android:localeConfig` to `@xml/locales_config`; that source XML also lists all six, and the APK resource table contains `xml/locales_config`. This confirms locale declarations are present in source and the compiled resource table, but does not establish what the Android Settings UI renders or what the app renders in FR/DE/IT. No missing-locale defect is confirmed.
- An authenticated, read-only Identity Toolkit Admin v2 config request for `comradia-dev` returned HTTP 200. The allowlisted metadata path `signIn.phoneNumber.testPhoneNumbers` is present with two entries. Phone values and all tokens/config payloads were kept internal. The current app user's Auth identity could not be read without controlling the owned emulator session, so neither configured fixture can be associated with the existing profile safely. No sign-out, login, profile mutation, or account cleanup was attempted.

| Follow-up case | Result | Evidence / limit |
| --- | --- | --- |
| Verify Android locale declarations in the requested APK/source | PARTIAL PASS | Six locales appear in source XML/config; manifest points to the locale config and APK resource table has `xml/locales_config`. Runtime settings list/render is unverified. |
| Render FR / DE / IT and keyboard text | BLOCKED | `DEVICE_IN_USE` prevented all UI actions. No native locale render or keyboard input is claimed. |
| PT / ES regression and existing English restore | BLOCKED | No UI action was run; prior PT/ES evidence remains from the earlier run only. |
| Localized native photo picker | BLOCKED | No picker opened in this follow-up. Earlier picker evidence remains English/Spanish only as recorded above; no media was selected. |
| Auth no-SMS fixture metadata | PASS (metadata only) | HTTP 200; two configured fixture entries under `signIn.phoneNumber.testPhoneNumbers`; values withheld. |
| Associate existing profile with a configured fixture | BLOCKED | Current Auth identity unavailable without the already-owned device session. Existing profile remains unknown and untouched. |
| Fresh native Auth / Firestore / Storage operations | BLOCKED | No fresh device interaction or native network receipt was possible. Cached profile and prior web validation are not counted as native proof. |
| Preserve emulator ownership | PASS | Refused takeover options; made one 1-second wait for the device to become free, and did not inspect, reuse, or close the owning session. |

No screenshots were captured in this follow-up because no new case passed on the device. The emulator's actual final UI state is unknown to this session; its owner was not disturbed.

## Two-device follow-up — 2026-11-15

The owner confirmed both Android sessions were released and the Galaxy A16 was unlocked and connected. Fresh bound `device_open` sessions were requested for the Pixel 10 emulator and Galaxy A16. Each first app relaunch returned `DEVICE_IN_USE`; following the supplied wait hint once with a 1-second budget left both devices busy. No ownership takeover or inspection was attempted.

| Device | Identity | Result |
| --- | --- | --- |
| Samsung Galaxy A16 | host `76c1bc88-6d2a-4d15-9c8c-ecbfee6e04c5`, id `RXGYC03Z6HN`, Android 16.0; bound session `t3-dadf98bec6e00781806189e0` | `DEVICE_IN_USE`, owned by `t3-a53e867fd78d1c8b3f4546d9`; one 1-second wait retry returned the same lock. |
| Pixel 10 | host `local`, id `emulator-5554`, Android; bound session `t3-eb8e64963c63b115a7e19764` | `DEVICE_IN_USE`, owned by `t3-a86697a8b6e1d6878de15301`; one 1-second wait retry returned the same lock. |

No launch, snapshot, screenshot, tap, setting/language change, keyboard entry, picker interaction, or notification interaction succeeded. `close` on each new bound command returned `SESSION_NOT_FOUND`, confirming there was no app session of this run to close; neither existing owner session was closed. Thus no new screenshot is available, and the final screen state on both devices is unknown to this run.

The requested APK was not rebuilt or reinstalled. Its SHA-256 was rechecked as `50b1ed18f4f0d167dd24e921dc5b39abe6a8c43bb31c70a1d83f1b0c8b54ab62`. A fresh read-only Identity Toolkit Admin v2 project config request returned HTTP 200 and showed two configured no-SMS test fixtures. Fixture numbers and OAuth credentials were not emitted. Since current Auth identity could not be read from either device, no account was mapped to a fixture and no account was signed out or modified.

All native user-flow cases remain blocked/unverified: fresh login/onboarding/profile/photo, independent-account mutual likes/match/chat, foreground/background/terminated push receipt and taps, denied permission, signed-out/blocked behavior, native PT/ES/FR/DE/IT rendering, and keyboard/photo-picker interaction. No app source/config/environment edits, cloud writes, account changes, outbound notification sends, invitations, commits, pushes, or deployments occurred. The exact attempt receipts and case outcomes are recorded in `/tmp/comradia-rc-android-two-device-final.md`.
