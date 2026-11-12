# Native dev smoke: 2026-11-12

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

The installed simulator binary contains the dev Firebase plist and expected encoded Firebase App ID URL scheme, ruling out that missing-scheme hypothesis. Source tracing places the pending boundary at RNFirebase’s native `FIRPhoneAuthProvider.verifyPhoneNumber` completion: the registration screen awaits it before routing, with busy state cleared in `finally`. The callback did not yield an observable result during this pass. Simulator reCAPTCHA presentation/return, API-key restrictions and native Auth/network behavior remain hypotheses; none is established as the cause. API-key restrictions were not verified because the local gcloud runtime could not load and no active account was configured. A fresh binary plus a process-scoped log capture is the next check.
