# App localization

Comradia supports Brazilian Portuguese (`pt-BR`), Spanish (`es-ES`), French (`fr-FR`), German (`de-DE`) and Italian (`it-IT`), plus English (`en-US`) as the fallback. Each dictionary contains all 256 current UI keys, including authentication, onboarding, discovery, profile editing, safety, errors, accessibility labels and notification settings.

The app follows the device/app language. Regional tags such as `fr-CA`, `de-AT`, `it-CH`, `pt-PT` and `es-419` resolve to their supported language dictionary; underscore tags and case variations are accepted. Unsupported languages use English. This adds language support, not a change to Brazil-specific phone registration, union options or user-authored profile text. User content is not automatically translated.

`apps/mobile/localization/core.ts` registers dictionaries and resolves tags. `index.test.ts` checks all registered dictionaries for exact key parity, nonempty text and matching interpolation placeholders, with explicit exceptions for proper names, numbers and structural name templates. It also guards against copied Spanish prose in Italian. These checks supplement proofreading; they do not measure linguistic quality by themselves.

Native configuration advertises all six locales through the installed `expo-localization` plugin (iOS language metadata and Android per-app language configuration). The six JSON files under `apps/mobile/localization/native/` localize iOS photo-library permission copy. Native configuration changes require rebuilding the app; a passing Expo config test is not an installed-binary receipt.

Push token registration rules accept the six canonical tags. Notification Functions choose generic translated match/message text for each token's locale and preserve English fallback for legacy or unsupported values. No private profile names or message bodies are added to push content. Mobile dictionaries, server copy and Firestore rules must change together. These changes have not been deployed by this implementation task.

## Validation

From `apps/mobile`:

```sh
yarn typecheck
yarn test
yarn test:component
```

The existing unit command includes locale/key/interpolation and native configuration tests. `playwright.languages.config.ts` exercises 11 representative states at three widths for each of the five required languages (165 screenshots). It uses the atlas's isolated synthetic backend, fresh browser contexts, fixed date and blocked external HTTP traffic; it does not qualify cloud, provider, native keyboard or motion behavior.

To run this focused capture suite, create a fresh root, copy the manifest, and supply it explicitly:

```sh
mkdir -p .artifacts
language_root=$(mktemp -d "$PWD/.artifacts/languages-XXXXXX")
cp ../../docs/qa/flow-checkpoints.json "$language_root/manifest.json"
COMRADIA_ATLAS_ROOT="$language_root" npx playwright test --config=playwright.languages.config.ts
```

Port 8288 must be free. Playwright owns and stops this test server; it never reuses an existing server. Reports go to the supplied root. The base 420-checkpoint atlas and this focused language matrix are separate runs.

From `apps/firebase`, `yarn test` runs the Firestore/Storage rules and notification integration suites on the repository's usual emulator ports. For shared-machine QA, use an isolated emulator configuration and run `tests/push-tokens.test.ts` plus Functions tests with that emulator's `FIRESTORE_EMULATOR_HOST`. The existing Storage test helper hardcodes port 9199, so it cannot follow an alternate Storage port without a separate harness change.
