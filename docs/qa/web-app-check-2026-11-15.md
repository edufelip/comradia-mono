# Web App Check validation — 2026-11-15

## Outcome

Web App Check is configured and exercised against the dev project with Firestore and Cloud Storage enforcement still enabled. No production resources or public deployment were changed.

## Dev resources

- Firebase project: `comradia-dev` (`949794653695`).
- Firebase web app: `Comradia Dev Web`, `1:949794653695:web:0f9d74e59b8b47959c13ca`.
- Enabled API: `recaptchaenterprise.googleapis.com`.
- reCAPTCHA Enterprise key: `projects/949794653695/keys/6LfSjiEuAAAAADiNuxLvX-CrFcQn00x4MDQAeZcx`; web SCORE integration, `allowAllDomains=false`, allowed domain exactly `localhost`.
- Firebase App Check provider resource: `projects/949794653695/apps/1:949794653695:web:0f9d74e59b8b47959c13ca/recaptchaEnterpriseConfig`; site key configured, token TTL `3600s`.
- Enforcement readback: `firestore.googleapis.com` = `ENFORCED`; `firebasestorage.googleapis.com` = `ENFORCED`.
- API enablement and key creation were completed without changing an Enterprise subscription or commitment. Assessment volume can be billable beyond the free allowance.

Resource commands used:

```bash
CLOUDSDK_PYTHON=/opt/homebrew/bin/python3 gcloud services enable recaptchaenterprise.googleapis.com --project=comradia-dev --quiet
CLOUDSDK_PYTHON=/opt/homebrew/bin/python3 gcloud recaptcha keys list --project=comradia-dev --billing-project=comradia-dev --format=json
CLOUDSDK_PYTHON=/opt/homebrew/bin/python3 gcloud recaptcha keys create --project=comradia-dev --display-name='Comradia Dev Web local validation' --web --domains=localhost --integration-type=score
```

The Firebase App Check `recaptchaEnterpriseConfig` was read and patched at `https://firebaseappcheck.googleapis.com/v1/projects/949794653695/apps/1:949794653695:web:0f9d74e59b8b47959c13ca/recaptchaEnterpriseConfig`, with `updateMask=siteKey`. The authenticated REST requests used `x-goog-user-project: comradia-dev`; the OAuth token was passed only in the request header and never printed. Readback confirmed `siteKey` configured and both service enforcement modes remained `ENFORCED`.

## Isolated local web environment

Expo inherited the existing ignored `apps/mobile/.env` normally, with the missing bucket and site key added only as process-scoped environment variables for the web server. The Storage bucket came from the registered Firebase app SDK config (`comradia-dev.firebasestorage.app`). No shared `.env`, `app.config.ts`, native debug token, or generated native tree was edited.

Equivalent command (replace the placeholder with the local public site key; it is intentionally omitted here):

```bash
cd apps/mobile
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=comradia-dev.firebasestorage.app \
EXPO_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY='<local-dev-site-key>' \
  npx expo start --web --port 8199
```

Expo loaded the ignored `.env` keys by name; no environment values were dumped. No emulator or App Check debug bypass was active.

## Browser and provider proof

The real T3 preview browser loaded `http://localhost:8199/welcome`, then signed in through one of the two already configured Firebase no-SMS test numbers (no SMS was sent). The app completed onboarding with synthetic QA data and uploaded the existing synthetic E2E portrait fixture.

- reCAPTCHA Enterprise browser resources loaded, and the Firebase App Check `exchangeRecaptchaEnterpriseToken` request for the exact web app returned HTTP `200`. The token value was kept opaque; no debug token was used.
- Authenticated Firestore onboarding writes and listeners returned successful HTTP `200` responses while Firestore enforcement was `ENFORCED`.
- The authenticated Storage upload to `comradia-dev.firebasestorage.app` returned HTTP `200` while Storage enforcement was `ENFORCED`.
- A separate Firestore REST list request from the same browser without Firebase Auth or an App Check header was rejected with HTTP `403 PERMISSION_DENIED`. This confirms the no-credential path is denied; because both credentials were absent, that response alone does not isolate App Check as the rejecting control.
- A synthetic QA Auth/profile record and its uploaded fixture were created and left in place. No bulk cleanup or account deletion was attempted.

## Code and validation

- `apps/mobile/services/backend/app-check.ts`, `app-check.test.ts`, and `index.web.ts` distinguish emulator, configured, and missing-site-key states; the web SDK initializes Enterprise App Check only in the browser. The browser run exposed an Expo Router server-render crash (`document is not defined`) when the provider initialized during SSR; the browser-runtime guard fixes it.
- `yarn test`: 219 passed.
- `yarn typecheck`: passed.
- `yarn lint`: 0 errors, 432 warnings.
- Prettier check on the three backend files: passed.
- `git diff --check`: passed.

## Proof boundary

API enablement, key creation, provider registration, browser token exchange, authenticated Firestore operation, and authenticated Storage operation are separately observed above. Public web deployment was not requested or performed.

No raw environment dump, Firebase Auth ID token, App Check token, debug token, verification code, or test phone number is included here.
