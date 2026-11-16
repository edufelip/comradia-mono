# iOS simulator acceptance — 2026-11-15

## Result

**PARTIAL.** The supplied iOS dev artifact installed and launched on the dedicated Comradia QA simulator. After registering the existing dev App Check token to the exact iOS Firebase app, a fresh launch returned to Discover and the existing Profile screen rendered. The app was configured for cloud dev, with the emulator host unset.

All five required non-English locales were selected interactively on iOS and rendered on native screens. Spanish Profile, profile editor, and keyboard were also exercised. The existing account was not edited or signed out. A photo was not selected or uploaded; the app's Photos picker opened without an iOS permission prompt.

This is native simulator UI evidence plus a live Firebase App Check registration receipt. It is not a provider/device receipt for physical iOS, APNs, photo upload, or a new test-account sign-in.

## Target and artifact identity

- Repository: `/Users/eduwaldo/Projects/comradia-mono`
- Branch / source HEAD: `develop` / `dc0615fe9e478129b14d09a785a04cffcf20e30d`
- Worktree: already dirty at task start (web App Check edits and QA reports); left unchanged. A separate Android acceptance report appeared during the run and was also left untouched.
- Device: host `local`, `Comradia QA`, iOS 26.5, simulator ID `DED38A2E-56B6-4F21-982C-1F8D1B41D25A`. This was the assigned separate simulator; the Photos simulator `80E8D79F-1C6F-4D7D-BF7A-6877535ED7D8` was not used.
- Installed bundle: `com.edufelip.comradia.dev`
- Artifact: `/tmp/comradia-rc-ios-2026-11-15/Build/Products/Debug-iphonesimulator/ComradiaDev.app`
- Executable SHA-256: `a044976ede9d6194f78126584f0dd14cb55f1b79d812c0bbcb52a9195f9553f0`
- Firebase project / iOS app ID: `comradia-dev` / `1:949794653695:ios:4defe3a9106a9f129c13ca`
- Metro: task-owned port `8291`, started without `EXPO_PUBLIC_FIREBASE_EMULATOR_HOST`, then stopped. Port was confirmed free afterward.
- Install receipt: bound device command reported `Installed: com.edufelip.comradia.dev`.
- Launch receipt: bound device command opened the app with Metro on 8291. A post-App-Check-registration relaunch also succeeded.

The executable hash matches the existing build receipt in [the iOS release-candidate report](ios-release-candidate-2026-11-15.md). The app is an ad-hoc simulator build without an embedded JS bundle, so this acceptance supplied its JS from Metro. No rebuild was performed.

## App Check and cloud boundary

The dev App Check debug token was already configured locally. A list request to Firebase App Check for the exact iOS app initially returned HTTP 200 with zero registered debug tokens. Using the existing token, I created the registration through the Firebase App Check API. The create response was HTTP 200 for display name `Comradia iOS dev simulator QA 2026-11-15`; token material was neither printed nor included here. Firebase documents the app-scoped debug-token create/list API and treats token values as input-only secrets ([create](https://firebase.google.com/docs/reference/appcheck/rest/v1/projects.apps.debugTokens/create), [resource](https://firebase.google.com/docs/reference/appcheck/rest/v1beta/projects.apps.debugTokens)).

Firestore and Storage App Check are enforced on dev per the task setup. Following registration, a fresh app relaunch completed and the Discover card loaded after its loading state. This supports the native dev path with the registered debug token. No server request trace was captured, so the individual Firestore read's App Check verdict is **not independently evidenced**. No Firestore or Storage write was attempted.

## Case matrix

| Case | Result | Evidence and limit |
| --- | --- | --- |
| Install supplied native artifact | **Pass** | Bound agent-device install receipt for the exact bundle ID. |
| Launch and startup | **Pass** | Opened through bound agent-device with task-owned Metro; fresh post-registration relaunch succeeded. |
| Firebase project routing | **Pass (configuration)** | Built Google service plist identifies `comradia-dev` and the iOS app ID above; emulator host unset. Configuration proves target, not every individual server request. |
| iOS App Check registration | **Pass** | Initial list showed zero registrations for this iOS app; existing configured token was registered via the API, HTTP 200. Secret omitted. |
| Discover/profile display | **Partial** | Fresh relaunch loaded Discover card `Lucas, 31`; Profile rendered `Rosa, 32`. The app was already signed in and no server trace tied these displayed records to a specific request. |
| Sign-in with documented Firebase test account | **Unverified** | An existing Keychain session was present. The docs say two owner-set no-SMS test numbers exist but do not identify them; I preserved the session instead of signing out or guessing. No SMS was sent. |
| Edit profile | **Pass (no-write interaction)** | Opened the profile editor and Spanish name keyboard; canceled without changing or saving the existing profile. |
| Photo picker and permission prompt | **Partial** | `Add a photo` opened the native Photos picker, which showed library content without a permission alert. Picker was canceled without selecting media. The compiled localized usage strings are covered by the prior artifact inspection, but the localized permission alert and permission-gated path were not observed. |
| Photo upload to Storage | **Unverified** | No upload attempted because the only authenticated profile was pre-existing and no safe synthetic test account was available. |
| Portuguese (Brazil) native screen | **Pass** | iPhone language set to Portuguese; Discover text and navigation translated. Screenshot below. |
| Spanish native screen | **Pass** | Discover and Profile rendered in Spanish. The profile editor and iOS keyboard were opened; no profile save. Screenshot below. |
| French native screen | **Pass** | Discover rendered in French. Screenshot below. |
| German native screen | **Pass** | Discover rendered in German; long union label `Gewerkschaftsmitglied · SEESP · Pflegekräfte` remained visible in the card. Screenshot below. |
| Italian native screen | **Pass** | Discover rendered in Italian. Screenshot below. |
| Longer localized labels and keyboard | **Partial** | Long labels were visible on the German, Portuguese, French, and Italian cards. The editable name keyboard was checked in Spanish only; keyboard entry in the other locales was not tested. |
| Physical iOS signing, APNs and push receipt | **Unverified** | This was an iOS simulator with an ad-hoc signature. Simulator build entitlements do not prove physical provisioning, APNs delivery, or notification receipt. |
| Locale/device state restoration | **Pass** | Restored the original preferred language order: English, then Portuguese. Temporary Spanish, French, German and Italian entries were removed. |

Metro displayed React Native Firebase namespaced-API deprecation warnings. The React Native warning overlay was dismissed using the device tool; it did not prevent app navigation. No app source/config/environment file was changed by this lane.

## Screenshot artifacts

All captures are 1206×2622 PNGs from the dedicated simulator:

- English Discover: [/tmp/comradia-ios-en-discover.png](/tmp/comradia-ios-en-discover.png)
- English Profile: [/tmp/comradia-ios-en-profile.png](/tmp/comradia-ios-en-profile.png)
- Portuguese Discover: [/tmp/comradia-ios-pt-discover.png](/tmp/comradia-ios-pt-discover.png)
- Spanish Profile: [/tmp/comradia-ios-es-profile.png](/tmp/comradia-ios-es-profile.png)
- French Discover: [/tmp/comradia-ios-fr-discover.png](/tmp/comradia-ios-fr-discover.png)
- German Discover: [/tmp/comradia-ios-de-discover.png](/tmp/comradia-ios-de-discover.png)
- Italian Discover: [/tmp/comradia-ios-it-discover.png](/tmp/comradia-ios-it-discover.png)

## Safety and scope

No real SMS, profile edits, photo uploads, account deletion, sign-out, invitations, production activity, deployment, push, or PR occurred. The existing owner/session data was preserved. No source code or existing QA report was modified. The only external mutation was the explicitly permitted registration of the existing dev App Check token to the exact iOS Firebase app; its value is intentionally excluded from this report.
