# Native dev smoke: 2026-11-12

Final result: the signed iOS local-emulator two-account journey passed. Cloud DEV phone verification remains blocked by `auth/operation-not-allowed`; no remote notification receipt is claimed. The sections below preserve the sequence of earlier attempts and their later resolution.

The first pass used the existing iOS 26.5 simulator binary for `com.edufelip.comradia.dev`, with Metro on port 8085 pointing to `comradia-dev`. A subsequent metadata-only inspection established installed version 1.0.0, build 1. It was not rebuilt during this pass.

The declared Storage dependency was absent from local node_modules. Installing the frozen lockfile restored bundling and the app loaded. Typecheck then passed after Metro regenerated its route types.

Read-only Firebase settings confirmed the two owner-configured test entries, the enabled phone provider and empty SMS region allowlist. No test phone numbers or credentials are included in this report. The inherited profile was signed out without edits or deletion.

| Check | Result |
| --- | --- |
| App loads against dev Firebase | Passed after local dependency setup |
| Test number entered and valid submit enabled | Passed |
| Phone verification screen | Unavailable: submit remained loading for 20 seconds, without a verification screen or visible error |
| Native Auth log signal | Unavailable: the bound device log was inactive; a narrow unified-log query found no matching events |
| First and second account sign-in/onboarding | Unavailable |
| Two-account photos, match, chat and blocking | Unavailable |
| Account deletion | Untested; no accounts deleted |

A read-only lookup found no Auth users for either test entry both before and after the attempt. This does not establish an Auth rejection or its cause. A fresh native build and focused phone-auth diagnosis are the next discriminating checks. Notification unit/emulator checks do not substitute for this native journey or prove remote alert delivery.

## Focused follow-up diagnosis

The installed simulator binary contains the dev Firebase plist and expected encoded Firebase App ID URL scheme, ruling out that missing-scheme hypothesis. Source tracing places the pending boundary at RNFirebase’s native `FIRPhoneAuthProvider.verifyPhoneNumber` completion: the registration screen awaits it before routing, with busy state cleared in `finally`. The callback did not yield an observable result during this pass. Simulator reCAPTCHA presentation/return, API-key restrictions and native Auth/network behavior remain hypotheses; none is established as the cause. At that stage, API-key restrictions were not verified because the local gcloud runtime could not load. The later read-only Firebase CLI preflight succeeded with its existing account; cloud verification still requires the separate signed-build result below.

## Fresh native binary follow-up

Both native debug builds completed locally. The fresh installed iOS binary was version 1.0.0/build 1, executable SHA-256 `226ed5012bde50dc599ccbbbe2ff578f9a595baee1466898b41befb61d46dcf9`, with JS source at `8300d7b`. A single owner-test-number request returned the visible `auth.error.unknown` message after about 13 seconds: "Something went wrong. Please try again." No verification screen appeared and no code was entered. Scoped, redacted native logs did not provide a Firebase error code/domain, so the provider cause is unconfirmed. No screenshot containing authentication values was saved. A separately labeled local-emulator lane follows after the motion audit corrections; it cannot prove dev Auth or provider delivery.

## Local Auth recovery on the signed simulator build

The local lane subsequently captured the symbolic `auth/keychain-error` during confirmation on the unsigned artifact. Rebuilding with simulator signing enabled succeeded. The standard Xcode product's executable SHA-256 is `fb8b47a66f8b4375d67e41bc2583d4dc9ea61cf527a4daa52e2fe6daf5be8191`; its simulator application identifier and development push entitlements are embedded in Mach-O sections. The local manual re-sign candidate failed to launch and was discarded in favor of this normal product.

Source `0f540ca` also removes the OTP TextInput's redundant zero opacity. Before the change, iOS exposed only a generic input view without an editable field or label; afterward, it exposes a labeled text field that accepts the code while the six-box presentation remains. Its semantic visibility regression failed before the change and passed after it.

A fresh synthetic local-only number completed confirmation and reached onboarding. A full process relaunch retained the same account (compared by UID hash), with no new code request. No current diagnostic error was emitted. These are local Auth and keychain-persistence receipts; cloud dev Auth and remote notification delivery require separate evidence.

## Completed local two-account journey

Both disposable accounts completed phone confirmation, onboarding and photo selection through the native UI. Admin reads were used only to verify results. Both profile/account documents and JPEG objects existed, and each account saw the other profile's photo. A brief reverse-like fixture was removed before the match test; both final Like legs came from the UI.

| Check | Local result |
| --- | --- |
| Two independent phone sessions | Passed; one cold relaunch retained the same account without another request |
| Onboarding and photo upload | Passed for both accounts, with profile/account documents and Storage JPEG receipts |
| Reduced Motion | Observed on for second onboarding; weight-control state changes recorded without visible motion; original off value restored before normal-motion run |
| Mutual match | Both UI Like legs and the two-member match confirmed server-side; native celebration displayed |
| Match motion | Opening portraits/no heart remain through the sheet slide; first hero movement shares the first settled-position frame; no final-pose flash/reset |
| Return behavior | Send-message replaces Match with Chat; Back returns to Discover. Matches row stayed static on return. No unsupported direct hero-back path is claimed |
| Two-way chat | Two UI-authored messages confirmed, one from each account |
| Blocking | Both block records confirmed; Matches empty for blocker; match/messages retained as documented |
| Recent-login guard | B's initial delete was stopped before data changes; fresh UI sign-in allowed deletion |
| Account removal | Both Auth lookup bodies have zero matching users; both profile/account documents and photo prefixes are gone; match/likes/blocks absent |
| Message cleanup limitation | One A-authored message remains orphaned beneath the deleted parent, matching the existing deferral in architecture.md; no manual cleanup masked this result |

One first profile read for the second account failed and recovered with one UI Retry; its SDK cause is unknown. A Pass was also absent through 40 server checks over 20.5 seconds, then committed without another tap or restart. Its server timestamp is roughly 90 seconds after the recorded action timestamp; the action log can reflect CLI return time, so this is not an exact client-ACK latency. Later actions committed and the UI advanced. No transport fix was claimed from this observation. A read-only inspector expression returned no usable SDK probe result.

The primary normal-match recording is `/tmp/comradia-motion-qa/native-match-2026-11-12/a-like-milo-match-hero.mp4` (SHA-256 `4bf75a369e03e565ca82cb18443129a5bc77b5be3c723b26654f5edaee9444b4`). Frame review covers 29.386667–30.415 seconds; first visible hero motion is 30.046667, also the first final-position sheet frame, so ordering is supported within frame resolution and not below it. Reduced-motion evidence is `/tmp/comradia-motion-qa/motion-run-2026-11-12-b/reduced-values.mp4`. Durable copies and a trimmed H.264 match clip are in the task workspace's `artifacts/comradia-motion-2026-11-12/`. The separate 0.067-second hold recording is not evidence of a continuous one-second hold.


## Signed-build cloud DEV follow-up

After completing and cleaning up the local accounts, one configured virtual test entry was used for a single cloud DEV request on the same signed binary and runtime source `0f540ca`. Metro was restarted with an empty emulator-host override and the app process relaunched. The request action was recorded at 2026-11-12T20:51:25.805Z; reCAPTCHA appeared, then returned to Register by 20:51:34.348Z. The safe development diagnostic was `operation=request`, `sdkCode=auth/operation-not-allowed`, `errorType=Error`. Verify never opened and no code was entered. The local Auth verification-code count stayed unchanged. No cloud profile was written or deleted, and no SMS policy, test entry or cloud configuration was changed. The UI was returned to Welcome without authentication values visible.

Read-only configuration checks found the phone provider enabled and two configured virtual test entries. The registered iOS app matches the dev project and bundle. An opaque in-process `keys:lookupKey` comparison of the actual built plist key resolved to the same project number and registered iOS key ID; no key string was printed or stored. Its API key resource includes Identity Toolkit and Secure Token targets. The iOS key restriction object has no represented bundle fields; the latest SMS allowlist response omitted `allowedRegions`. Neither omission establishes effective enforcement or the cause of this error. No bypass, provider fix or successful cloud confirmation is claimed.

Android was compiled but not exercised on a device. Repeated taps and the native notification settings/foreground interactions were covered by component checks rather than this manual journey. Functions/rules are undeployed; FCM/APNs delivery remains unverified.
