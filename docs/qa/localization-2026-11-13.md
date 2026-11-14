# Localization validation — 2026-11-13

Implemented Brazilian Portuguese, Spanish, French, German and Italian, with English fallback. All six dictionaries contain the same 256 keys and interpolation placeholders. Regional device tags resolve to the supported language. Generic push copy, Firestore token-locale rules, native language metadata and iOS photo-library permission copy cover all six locales.

## Executed checks

- Mobile unit suite: 201 passed. Focused localization/config suite: 25 passed.
- Mobile component suite: 355 passed.
- Mobile TypeScript check: passed, including a final rerun after integration.
- Mobile lint: zero errors, 379 warnings; this is not a warning-free result.
- Expo config evaluation: passed; six advertised locales and plugin options inspected without printing credentials.
- Isolated Firestore token-rule tests: 8 passed. Functions suite on that emulator: 23 passed. After final French/Italian terminology edits, Functions build and all 3 notification-locale tests passed again.
- Localized browser matrix: 165 passed (11 states × 3 widths × 5 required languages), with 33 captures per language. Screenshot metadata, dimensions and source hashes passed integrity checks.
- `git diff --check`: passed. The owned Playwright server on port 8288 stopped after the run.

The browser evidence uses synthetic rendering fixtures, fixed dates, fresh contexts and blocked external HTTP traffic. It validates representative localized rendering rather than real-account, provider or native behavior.

## Screenshot evidence

Capture root: `apps/mobile/.artifacts/flow-atlas/languages-2026-11-13T19-02-27Z/`.

Open `html/index.html` for the report; `integrity.json` records the verified 165-capture count and per-language totals. All screenshots have sidecar metadata.

Visually inspected these original screenshots under `languages/` in the earlier `languages-2026-11-13T18-53-20Z` capture root:

- `fr-FR-mobile/02-welcome.default.png`
- `de-DE-mobile/02-welcome.default.png`
- `it-IT-mobile/02-welcome.default.png`
- `de-DE-tablet/13-profile.edit-invalid.png`
- `fr-FR-web/14-safety.report-draft.png`
- `it-IT-web/13-profile.edit-invalid.png`

No clipping or overlapping controls was observed in these six captures. The German tablet profile capture was inspected again after the German copy corrections. This is a focused visual sample, not a claim that every capture received manual inspection. English fixture profile answers and report text represent user-authored content and intentionally remain untranslated.

## Limits and remaining delivery work

An independent read-only review covered the dictionaries, locale resolution, Expo configuration, native permission files, token registration, notification handlers, rules and owning tests. It found English wording in the German empty-matches message and a missing noun in the German onboarding sentence. Both strings were corrected, with the focused 25-test suite passing afterward and the browser matrix refreshed for the corrected source. No additional runtime or configuration defects were confirmed in that review.

The full rules run on alternate emulator ports encountered the existing Storage helper's hardcoded port 9199. Its Storage tests failed against the alternate port; no full Storage-suite pass is claimed. The owning token-rule and Functions suites passed separately on the isolated Firestore emulator.

Native language metadata and permission copy need a rebuilt binary and installed-device validation. Updated token rules and notification Functions have not been deployed by this task; provider delivery in the new languages is unverified. No PR, commit, merge or release is claimed.

See [localization implementation and rerun instructions](../localization.md).
