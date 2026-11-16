# iOS release-candidate QA — 2026-11-15

## Result

Fresh iOS **simulator build passed** from `develop` at source `dc0615fe9e478129b14d09a785a04cffcf20e30d`. Artifact inspection passed for the dev bundle ID, version/build metadata, six advertised locales, localized photo-library permission strings, simulator code signature verification, and generated development entitlements.

**Native acceptance is blocked before installation.** The assigned simulator was reported as owned by another agent-device session. Per the device-session restriction, this run did not take over or close it. Therefore app startup, sign-in, profile/photo flow, interactive locale/layout/keyboard checks, photo permission prompt, screenshots, and device push behavior were not exercised.

## Source, build, and artifact

- Repo: `/Users/eduwaldo/Projects/comradia-mono`, branch `develop`, HEAD `dc0615fe9e478129b14d09a785a04cffcf20e30d`; clean at task start.
- Native project generated with `APP_VARIANT=dev npx expo prebuild --platform ios --no-install --clean` (success). Expo loaded `.env`; token values were not printed.
- `pod install` in `apps/mobile/ios` succeeded (120 Podfile dependencies, 165 installed pods).
- First direct project build stopped before compile because the clean generated tree had no Pods lockfile. Rebuilt via the generated workspace:

  ```sh
  xcodebuild -quiet \
    -workspace ios/ComradiaDev.xcworkspace \
    -scheme ComradiaDev \
    -configuration Debug \
    -destination 'id=80E8D79F-1C6F-4D7D-BF7A-6877535ED7D8' \
    -derivedDataPath /tmp/comradia-rc-ios-2026-11-15 \
    -jobs 2 \
    CODE_SIGNING_ALLOWED=YES CODE_SIGNING_REQUIRED=YES CODE_SIGN_IDENTITY=- \
    build
  ```

- Final Xcode build exit: `0`. The log is `/tmp/comradia-rc-ios-2026-11-15-xcodebuild.log`; it contains third-party compiler warnings. No app-source build error was reported.
- Simulator app: `/tmp/comradia-rc-ios-2026-11-15/Build/Products/Debug-iphonesimulator/ComradiaDev.app` (217 MB).
- Bundle ID: `com.edufelip.comradia.dev`; version `1.0.0`, build `1`; Firebase plist resolves to project `comradia-dev` and the same bundle ID.
- Executable SHA-256: `a044976ede9d6194f78126584f0dd14cb55f1b79d812c0bbcb52a9195f9553f0`.
- App bundle tar-stream SHA-256: `c67c707e12cc2bace89de52350a510d0f203012cbc4cd9931c699ac5d3db024e`.
- `codesign --verify --deep --strict` passed. Signature is `adhoc`, with no Team ID; this is a simulator artifact, not a physical-device signed release candidate. The build has no embedded `main.jsbundle`; the debug runtime would require Metro, which was not started because installation was blocked.

## Artifact/configuration checks

- `CFBundleLocalizations` includes `en-US`, `pt-BR`, `es-ES`, `fr-FR`, `de-DE`, and `it-IT`.
- The built app contains `InfoPlist.strings` for all six locales. Each has a non-empty `NSPhotoLibraryUsageDescription`, matching the corresponding source locale text. The untranslated base Info.plist value is the English fallback.
- Generated `ComradiaDev.entitlements` contains `aps-environment=development`, App Attest environment `development`, and the default Apple Sign In entitlement. The built Info.plist includes `remote-notification` background mode.
- Expo config resolves a non-empty dev App Check debug token from the existing environment, but the value was not displayed or copied. Native source configures the Apple debug provider for dev. `EXPO_PUBLIC_FIREBASE_EMULATOR_HOST` was unset for this candidate, so the configured runtime target is cloud dev. No device request was made: App Check token acceptance against enforced Firestore/Storage remains **unverified**.
- Generated entitlements and ad-hoc simulator signing do not establish physical provisioning, production push signing, APNs key association/readiness, FCM provider acceptance, or alert receipt.

## Per-case outcomes

| Case | Result | Evidence / limit |
| --- | --- | --- |
| Fresh dev native build | Pass | Xcode workspace build exit 0, `-jobs 2`; artifact and hashes above. |
| Installed app receipt | Blocked | Install command returned `DEVICE_IN_USE`; no install receipt. |
| App launch/startup | Not run | Requires installation and control of the assigned simulator. |
| Firebase sign-in, profile, and photo upload | Not run | No authenticated UI session or Firestore/Storage request was produced. No real SMS was sent. |
| Six-language native screen review and long-label layout | Not run | The built app advertises all six locales; interactive device-language switching and screen rendering were unavailable. |
| Keyboard interactions | Not run | Requires native screen interaction. |
| Localized photo permission prompt | Artifact pass; prompt not run | All six compiled permission strings exist; no native picker prompt was opened. |
| APNs / push signing and delivery | Partial static config only | Development entitlements/background mode are generated; no physical signed binary, provider receipt, or device alert evidence. |
| Screenshots | None | No screenshot was captured because the app was not installed/launched. |

## Device blocker and shared checkout

Device: host `local`, simulator `80E8D79F-1C6F-4D7D-BF7A-6877535ED7D8` (Comradia Photos iPhone 17, iOS 26.5). The bound install command returned:

> Error (DEVICE_IN_USE): ios device 80E8D79F-1C6F-4D7D-BF7A-6877535ED7D8 is owned by session `t3-3d8a9a5ddad46e9167083b8d` in workspace `/Users/eduwaldo/Projects/comradia-mono`.

The tool's one-time status hint reported that status inspection is unavailable through this command and instructed quoting the `DEVICE_IN_USE` error. The other session was not reused or closed.

This iOS lane made no tracked app-code edits, commits, pushes, deployments, credential changes, account deletion, or invitations. At the end of the run, the shared checkout showed concurrent changes in `apps/mobile/services/backend/app-check.test.ts`, `apps/mobile/services/backend/app-check.ts`, `apps/mobile/services/backend/index.web.ts`, and three other QA reports. They were left untouched. The iOS app-check provider helper itself remains unchanged; the simulator build has no embedded JS bundle, and no Metro runtime was started.

No production release or invitation was performed. The candidate is **simulator-build-only** until installation and native acceptance can be completed in an available assigned-device session. Physical iOS/APNs readiness remains unproven.
