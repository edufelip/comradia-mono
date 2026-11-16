# Comradia flow/checkpoint manifest

Source snapshot: `982fa3cc56cff181bd28181e82a4de2427b966ec`. Definition only; no atlas capture has run.

17 flows; 140 web checkpoints × three viewports = 420 planned base screenshots. 20 native checkpoints are tracked separately and excluded from web completeness.

Machine-readable source: [flow-checkpoints.json](flow-checkpoints.json).

## Capture contract

- Use a fresh artifact root per run, disposable emulator accounts, deterministic clock/data, and explicit failure/pending fixtures. Never create real SMS or delete owner/cloud accounts for atlas capture.
- Hold requests/subscriptions to capture loading and pending states; inject named error outcomes. A fixture screenshot proves rendering, not a production/provider failure. Harness work is not implemented by this manifest.
- Capture full-page at 390×844, 820×1000, 1440×1000. Full-page height alone is not a defect. Keep transient overlays in a separate viewport capture where full-page loses their context.
- Current shell uses bottom tabs at every width; only tab routes require them. Do not invent navigation rails/sidebar requirements.
- Stable IDs identify logical checkpoints, not selector strings. Record source SHA, platform, locale, theme, viewport, fixture, expected result, file path and unbaselined status beside every screenshot.
- Assert expected state before capture, settle finite entrance motion for ordinary checkpoints, and never mask missing elements with a fixed delay. Capture motion as clips/frames separately.
- Evidence sources below show where behavior is implemented/tested; they do not mean an atlas screenshot already exists.
- Async races without a unique visual result require behavioral assertions plus the final-state screenshot; no screenshot alone proves absence of a write, alert or stale completion.
- Native OS/provider cases require a separate device matrix. Do not count them as captured web states or infer passing negative delivery from silence.
- Fail missing or duplicate manifest IDs, missing routes, unexpected paths and absent required screenshots. Counts must come from the future capture verifier, not these definition totals.

## Flow catalog

### 01-entry — `/`

Cold start → session guard → appropriate destination.

Sources: `apps/mobile/app/index.tsx`, `apps/mobile/app/_layout.tsx`

Behavior evidence: `apps/mobile/tests/component/root-layout.test.tsx`

| Checkpoint | Fixture / action | Expected capture |
| --- | --- | --- |
| `01-entry.signed-out` | Restore signed-out session | Welcome replaces entry route |
| `01-entry.onboarding` | Authenticate user with no public profile | Vibe onboarding replaces entry route |
| `01-entry.ready` | Restore authenticated complete profile | Discover replaces entry route |
| `01-entry.loading` | Hold initial auth/profile resolution | Loading gate; no protected-content flash |
| `01-entry.profile-error` | Reject profile lookup then retry | Recovery state then correct destination |

### 02-welcome — `/welcome`

Welcome → sign up or log in.

Sources: `apps/mobile/app/(auth)/welcome.tsx`

Behavior evidence: `apps/mobile/tests/e2e/welcome.spec.ts`, `apps/mobile/tests/component/welcome.test.tsx`

| Checkpoint | Fixture / action | Expected capture |
| --- | --- | --- |
| `02-welcome.default` | Signed out; fresh launch | Headline and both named CTAs usable |
| `02-welcome.signup` | Press start | Registration with signup copy |
| `02-welcome.login` | Press existing-account CTA | Registration with login copy |
| `02-welcome.dark` | Use dark scheme | Readable artwork and CTAs |
| `02-welcome.portuguese` | Use pt-BR locale | Translated welcome copy |
| `02-welcome.spanish` | Use es-ES locale | Translated welcome copy |

### 03-registration — `/register`

Choose phone or available social provider → authenticate.

Sources: `apps/mobile/app/(auth)/register.tsx`

Behavior evidence: `apps/mobile/tests/e2e/sign-in.spec.ts`, `apps/mobile/tests/component/register.test.tsx`

| Checkpoint | Fixture / action | Expected capture |
| --- | --- | --- |
| `03-registration.default` | Signup mode with blank phone | Provider buttons and disabled send action |
| `03-registration.login-mode` | Set mode=login then switch mode | Correct copy and preserved usable controls |
| `03-registration.phone-valid` | Enter emulator Brazilian phone | Formatted phone and enabled send |
| `03-registration.phone-focus` | Focus phone field | Visible focus and usable form |
| `03-registration.sending` | Hold startPhoneSignIn promise | Loading action; repeated actions disabled |
| `03-registration.send-error` | Reject phone request with network error | Localized recoverable error |
| `03-registration.rate-limit` | Reject request with too_many_requests | Localized rate-limit error |
| `03-registration.provider-busy` | Hold Google sign-in | Provider loading; competing actions disabled |
| `03-registration.provider-error` | Reject Google authentication | Visible mapped error |
| `03-registration.provider-cancel` | Cancel provider authentication | No false error; form usable |
| `03-registration.success` | Authenticate existing emulator account | Discover landing |

### 04-verification — `/verify-phone`

Phone request → six-digit verification → session routing; resend/edit recovery.

Sources: `apps/mobile/app/(auth)/verify-phone.tsx`

Behavior evidence: `apps/mobile/tests/e2e/sign-in.spec.ts`, `apps/mobile/tests/component/verify-phone.test.tsx`

| Checkpoint | Fixture / action | Expected capture |
| --- | --- | --- |
| `04-verification.default` | Open with valid emulator phone and pending verification | Empty code and resend countdown |
| `04-verification.partial` | Enter fewer than six digits | Submit disabled; digits visible |
| `04-verification.submitting` | Hold confirmation on sixth digit | Busy state; no duplicate confirmation |
| `04-verification.wrong-code` | Submit incorrect emulator code | Localized error; code cleared |
| `04-verification.expired` | Reject with code_expired | Expired-code recovery copy |
| `04-verification.no-pending` | Reject with no_pending_code | Missing-session recovery copy |
| `04-verification.resend-ready` | Advance controlled countdown past 30 seconds | Resend enabled |
| `04-verification.resend-error` | Reject resend request | Error and retry remain available |
| `04-verification.resend-success` | Resend through emulator | Countdown restarts |
| `04-verification.edit-number` | Press edit phone | Registration landing |
| `04-verification.invalid-route` | Open with missing or invalid phone | Safe registration redirect |
| `04-verification.success` | Confirm correct emulator code for new account | Vibe onboarding landing |

### 05-onboarding-basics — `/vibe`

New account → basics, optional portrait, vibe, audience and union → values.

Sources: `apps/mobile/app/(onboarding)/vibe.tsx`

Behavior evidence: `apps/mobile/tests/e2e/onboarding.spec.ts`, `apps/mobile/tests/component/onboarding-vibe.test.tsx`, `apps/mobile/tests/component/profile-photo.test.tsx`

| Checkpoint | Fixture / action | Expected capture |
| --- | --- | --- |
| `05-onboarding-basics.default` | New authenticated account; empty draft | Step one; Continue unavailable |
| `05-onboarding-basics.valid` | Enter valid name birthday vibe and audience | Continue enabled |
| `05-onboarding-basics.invalid-birthday` | Enter invalid calendar date | Date validation state |
| `05-onboarding-basics.underage` | Enter birthday younger than 18 | Age validation; Continue disabled |
| `05-onboarding-basics.age-boundaries` | Use controlled date and valid 18/99 year boundary fixture | Boundary age accepted |
| `05-onboarding-basics.union` | Enable union membership and choose union | Selected union and badge choice visible |
| `05-onboarding-basics.photo` | Choose deterministic portrait fixture | Cropped portrait preview and removal action |
| `05-onboarding-basics.photo-error` | Reject photo picker | Recoverable localized photo error |
| `05-onboarding-basics.photo-removed` | Remove selected portrait | Initial/fallback preview restored |
| `05-onboarding-basics.back-retained` | Advance to Values then go back | Draft fields and selections preserved |

### 06-onboarding-values — `/values`

Select 3–5 values and shared-passion weight → starter.

Sources: `apps/mobile/app/(onboarding)/values.tsx`

Behavior evidence: `apps/mobile/tests/e2e/onboarding.spec.ts`, `apps/mobile/tests/component/onboarding-values.test.tsx`

| Checkpoint | Fixture / action | Expected capture |
| --- | --- | --- |
| `06-onboarding-values.default` | Open with no values selected | Counter and disabled Continue |
| `06-onboarding-values.minimum` | Select three values | Continue enabled; selected pills clear |
| `06-onboarding-values.maximum` | Select five then attempt sixth | Five selected; limit preserved |
| `06-onboarding-values.weight-low` | Decrease weight to zero | Lower bound displayed; control state correct |
| `06-onboarding-values.weight-high` | Increase weight to 100 | Upper bound displayed; control state correct |
| `06-onboarding-values.back-retained` | Go to starter then return | Values and weight preserved |

### 07-onboarding-starter — `/starter`

Choose prompt and answer → atomic profile/account save → Discover.

Sources: `apps/mobile/app/(onboarding)/starter.tsx`

Behavior evidence: `apps/mobile/tests/e2e/onboarding.spec.ts`, `apps/mobile/tests/component/onboarding-starter.test.tsx`

| Checkpoint | Fixture / action | Expected capture |
| --- | --- | --- |
| `07-onboarding-starter.default` | Valid earlier draft; blank answer | Finish disabled; voice coming-soon affordance |
| `07-onboarding-starter.prompt` | Choose a different prompt | Question and selected pill update |
| `07-onboarding-starter.valid` | Enter nonblank answer | Finish enabled and character counter correct |
| `07-onboarding-starter.answer-limit` | Enter 280-character fixture | Limit and wrapping remain usable |
| `07-onboarding-starter.saving` | Hold onboarding save promise | Busy state; no duplicate submission |
| `07-onboarding-starter.save-error` | Reject save | Draft retained and localized error shown |
| `07-onboarding-starter.success` | Complete emulator onboarding | Discover landing; public/private writes checked separately |

### 08-discovery — `/discover`

Load eligible page → inspect card → Pass/Like → next card or match.

Sources: `apps/mobile/app/(tabs)/discover.tsx`

Behavior evidence: `apps/mobile/tests/e2e/discover.spec.ts`, `apps/mobile/tests/component/discover.test.tsx`

| Checkpoint | Fixture / action | Expected capture |
| --- | --- | --- |
| `08-discovery.loading` | Hold discovery read | Loading card; no empty-state flash |
| `08-discovery.ready` | Seed eligible page including portraits and initials | Person card and named actions; self excluded |
| `08-discovery.empty` | Seed no remaining eligible people | Caught-up state and refresh |
| `08-discovery.read-error` | Reject discovery read | Retry state |
| `08-discovery.retry` | Retry read successfully | Ready card replaces error |
| `08-discovery.pass-pending` | Hold swipe write | Current card retained; actions disabled |
| `08-discovery.pass-success` | Resolve pass | Next candidate; no match |
| `08-discovery.like-success` | Resolve non-mutual like | Next candidate; no match |
| `08-discovery.write-error` | Reject swipe write | Original card restored; no explicit swipe-write error message is currently implemented. |
| `08-discovery.refresh` | Refresh empty page after adding eligible fixture | New eligible card |
| `08-discovery.hidden-return` | Resolve swipe while tab hidden then return | Final state without replay or stale navigation |
| `08-discovery.account-change` | Change session while swipe pending | Prior account completion cannot affect new account |

### 09-discovery-filters — `/discover`

Open filters → change age/vibe → apply/cancel/reset without passing hidden people.

Sources: `apps/mobile/features/discovery/DiscoveryFilterPanel.tsx`, `apps/mobile/features/discovery/discovery-filters.ts`, `apps/mobile/app/(tabs)/discover.tsx`

Behavior evidence: `apps/mobile/tests/e2e/private-beta.spec.ts`, `apps/mobile/tests/component/discover.test.tsx`

| Checkpoint | Fixture / action | Expected capture |
| --- | --- | --- |
| `09-discovery-filters.default` | Open filters with defaults | 18–99 and any-vibe selection; page-limit disclosure |
| `09-discovery-filters.selected` | Select vibe and valid age interval | Selection visible; input readable |
| `09-discovery-filters.invalid` | Set minimum greater than maximum or invalid bounds then apply | Inline validation; panel retained |
| `09-discovery-filters.filtered` | Apply to fixture containing both matching and hidden people | Only matching card displayed; no hidden swipe writes |
| `09-discovery-filters.filtered-empty` | Apply interval/vibe excluding all loaded candidates | Filter-specific empty state and reset |
| `09-discovery-filters.reset` | Clear filters | Original loaded candidates restored |
| `09-discovery-filters.cancel` | Modify draft then cancel and reopen | Applied filters retained; draft discarded |
| `09-discovery-filters.account-reset` | Switch accounts and back after applying filter | Defaults restored; no other-account draft |
| `09-discovery-filters.localized-dark-es` | Capture es-ES in dark reduced-motion context | Translated labels; no overflow |
| `09-discovery-filters.localized-dark` | Capture pt-BR in dark reduced-motion context | Translated labels; no overflow |

### 10-match — `/match/[id]`

Mutual like → celebration → chat or keep swiping.

Sources: `apps/mobile/app/match/[id].tsx`

Behavior evidence: `apps/mobile/tests/e2e/match-chat.spec.ts`, `apps/mobile/tests/component/match-modal.test.tsx`, `apps/mobile/tests/component/match-celebration.test.tsx`

| Checkpoint | Fixture / action | Expected capture |
| --- | --- | --- |
| `10-match.loading` | Hold match/profile lookup | Loading state |
| `10-match.ready` | Create mutual likes with shared values | Both names/portraits, shared values and actions |
| `10-match.fallbacks` | Use missing portraits and no shared values | Initials and honest absence of shared-values chips |
| `10-match.missing` | Open nonexistent match ID | Not-found state and safe exit |
| `10-match.error` | Reject match read | Recoverable error and retry |
| `10-match.chat` | Press send message | Correct chat landing |
| `10-match.keep-swiping` | Press keep swiping | Discover landing |
| `10-match.reduced-motion` | Open valid match with OS/browser reduced motion | Settled readable celebration without forced motion |

### 11-matches — `/matches`

Matches tab → live ordered list → correct chat.

Sources: `apps/mobile/app/(tabs)/matches.tsx`

Behavior evidence: `apps/mobile/tests/e2e/match-chat.spec.ts`, `apps/mobile/tests/component/matches.test.tsx`

| Checkpoint | Fixture / action | Expected capture |
| --- | --- | --- |
| `11-matches.loading` | Hold initial match snapshot | Loading state |
| `11-matches.empty` | Seed no mutual matches | Empty state with discovery action |
| `11-matches.ready` | Seed multiple matches with portraits/fallbacks and shared values | Newest first; correct named rows |
| `11-matches.error` | Reject match subscription | Error and retry |
| `11-matches.live-arrival` | Deliver second snapshot with a new match | New row visible; existing rows stable |
| `11-matches.hidden-arrival` | Deliver match while tab hidden then return | No delayed entrance replay |
| `11-matches.open-chat` | Press specific match row | Correct peer conversation |

### 12-chat — `/chat/[id]`

Two independent accounts match → exchange live messages → reload → safety.

Sources: `apps/mobile/app/chat/[id].tsx`

Behavior evidence: `apps/mobile/tests/e2e/two-account-smoke.spec.ts`, `apps/mobile/tests/e2e/match-chat.spec.ts`, `apps/mobile/tests/component/chat.test.tsx`

| Checkpoint | Fixture / action | Expected capture |
| --- | --- | --- |
| `12-chat.loading` | Hold match/message reads | Loading state |
| `12-chat.missing` | Open missing or inaccessible match | Not-found state; no private history leakage |
| `12-chat.empty` | Open valid match without messages | Header and empty usable composer |
| `12-chat.history` | Seed both-author history | Ordered readable bubbles; initial history not animated |
| `12-chat.composing` | Type multiline message | Composer and input remain usable |
| `12-chat.sending` | Hold send promise | Pending action; duplicate send guarded |
| `12-chat.sent` | Send through real emulator client | Own bubble and cleared composer |
| `12-chat.received` | Deliver peer message through isolated subscription fixture (networking remains in E2E) | Live incoming bubble |
| `12-chat.send-error` | Reject write | Draft retained and localized error |
| `12-chat.read-error` | Reject subscription | Recoverable read error |
| `12-chat.closed` | Block one member while chat open | Closed state; composer removed |
| `12-chat.hidden-return` | Deliver incoming message while hidden then return | Message visible without delayed motion |
| `12-chat.reload` | Reload conversation after both authors send | Both messages persist |

### 13-profile — `/profile`

Own card → edit/save/cancel; portrait lifecycle; sign out or account deletion.

Sources: `apps/mobile/app/(tabs)/profile.tsx`, `apps/mobile/features/profile/ProfileEditor.tsx`, `apps/mobile/features/profile/ProfilePhoto.tsx`

Behavior evidence: `apps/mobile/tests/e2e/private-beta.spec.ts`, `apps/mobile/tests/e2e/photos.spec.ts`, `apps/mobile/tests/component/profile.test.tsx`, `apps/mobile/tests/component/profile-photo.test.tsx`

| Checkpoint | Fixture / action | Expected capture |
| --- | --- | --- |
| `13-profile.ready` | Restore complete QA profile | Own public card and actions |
| `13-profile.missing` | Hold or omit profile while signed in | Sign-out remains usable |
| `13-profile.edit` | Open editor | All editable fields; immutable age/photo excluded from form |
| `13-profile.edit-selected` | Change vibe audience union values and prompt in draft | Correct selected states and 3–5-value limit |
| `13-profile.edit-invalid` | Clear name or leave fewer than three values then save | Validation; no write |
| `13-profile.edit-saving` | Hold updateProfile promise | Save and cancel disabled; no duplicate write |
| `13-profile.edit-error` | Reject updateProfile | Draft retained; retry available |
| `13-profile.edit-cancel` | Modify draft then cancel | Own card unchanged |
| `13-profile.edit-success` | Save changed emulator profile then reload | Persisted edits; age/photo/createdAt/private fields unchanged |
| `13-profile.edit-account-switch` | Change UID during pending save | New account unaffected by late completion |
| `13-profile.photo` | Use existing portrait fixture | Change and remove available |
| `13-profile.photo-uploading` | Hold upload promise | Busy state; duplicate action guarded |
| `13-profile.photo-error` | Reject picker or upload | Recoverable photo error |
| `13-profile.photo-remove` | Remove portrait | Initial fallback; old file handling checked separately |
| `13-profile.signout-error` | Reject sign-out | Profile stays usable |
| `13-profile.signed-out` | Complete sign-out | Welcome landing; protected state cleared |
| `13-profile.delete-confirm` | Open delete panel | Consequences and confirm/cancel actions |
| `13-profile.delete-cancel` | Cancel deletion | No data removed; profile retained |
| `13-profile.delete-reauth` | Use sign-in older than freshness threshold | Recent-sign-in guidance; no deletion |
| `13-profile.delete-error` | Reject deleteAccount | Error and retry/cancel state |
| `13-profile.deleted` | Delete disposable emulator account only | Welcome landing; deletion effects checked separately |

### 14-safety — `/safety/[uid]`

From Discover/chat → report or block → both users lose access.

Sources: `apps/mobile/app/safety/[uid].tsx`

Behavior evidence: `apps/mobile/tests/e2e/safety.spec.ts`, `apps/mobile/tests/component/safety.test.tsx`

| Checkpoint | Fixture / action | Expected capture |
| --- | --- | --- |
| `14-safety.profile-context` | Open from disposable candidate | Correct target and profile context |
| `14-safety.chat-context` | Open from existing match | Correct target and chat context |
| `14-safety.block-confirm` | Press block | Confirmation with cancel and confirm |
| `14-safety.block-cancel` | Cancel block | No write; sheet usable |
| `14-safety.block-pending` | Hold block promise | Busy controls; no duplicate block |
| `14-safety.block-error` | Reject block write | Recoverable error |
| `14-safety.blocked` | Confirm disposable emulator block | Return to safe destination; target hidden |
| `14-safety.report-draft` | Choose reason and enter details | Selected reason and bounded details |
| `14-safety.report-pending` | Hold report promise | Busy controls |
| `14-safety.report-error` | Reject report write | Draft retained and error |
| `14-safety.reported` | Submit disposable emulator report | Return safely; report also blocks |

### 15-notifications-web — `/profile`

Web profile → honest unavailable push state.

Sources: `apps/mobile/features/notifications/NotificationSettings.tsx`, `apps/mobile/features/notifications/notifications.web.ts`

Behavior evidence: `apps/mobile/tests/component/notification-settings.test.tsx`, `apps/mobile/tests/component/notification-settings-recovery.test.tsx`

| Checkpoint | Fixture / action | Expected capture |
| --- | --- | --- |
| `15-notifications-web.unavailable` | Use web notification adapter | Unavailable copy; no fake native permission prompt |

### 16-native-notifications — `/profile + OS notification surface`

Native opt-in → registration → alert receipt → validated tap routing.

Sources: `apps/mobile/features/notifications/NotificationSettings.tsx`, `apps/mobile/features/notifications/notifications.native.ts`

Behavior evidence: `apps/mobile/tests/component/notification-native-integration.test.ts`, `apps/mobile/tests/component/notification-settings.test.tsx`

| Checkpoint | Fixture / action | Expected capture |
| --- | --- | --- |
| `16-native-notifications.disabled` | Native OS permission not requested and local opt-in false | No unsolicited prompt |
| `16-native-notifications.prompt` | Press enable | OS permission sheet for exact app |
| `16-native-notifications.enabled` | Grant permission and finish registration | Enabled settings; language metadata verified separately |
| `16-native-notifications.denied` | Deny permission | Settings recovery action |
| `16-native-notifications.provisional` | Restore iOS provisional authorization | Enabled registration without repeat prompt |
| `16-native-notifications.error` | Reject registration or revoke | Error and correct recovery action |
| `16-native-notifications.background-match` | Trigger real disposable-account mutual match with app backgrounded | Generic localized match alert |
| `16-native-notifications.background-message` | Peer sends with app backgrounded | Generic localized message alert; no message body |
| `16-native-notifications.terminated-tap` | Receive alert with app terminated then tap | Correct authorized conversation after session readiness |
| `16-native-notifications.blocked` | Block peer then trigger event | No alert; absence verified with bounded provider evidence |
| `16-native-notifications.signed-out` | Sign out then trigger event | No account-linked alert; no cross-account routing |
| `16-native-notifications.wrong-recipient` | Deliver old-account notification after UID switch | No private route opened |

### 17-native-auth-media — `/register + /vibe + /profile`

Native provider and media handoffs → safe return to app.

Sources: `apps/mobile/app/(auth)/register.tsx`, `apps/mobile/features/profile/pick-photo.ts`

Behavior evidence: `apps/mobile/tests/component/register.test.tsx`, `apps/mobile/tests/component/profile-photo.test.tsx`

| Checkpoint | Fixture / action | Expected capture |
| --- | --- | --- |
| `17-native-auth-media.apple-available` | Use supported signed-out Apple device | Apple action offered only when available |
| `17-native-auth-media.apple-prompt` | Press Apple sign-in on configured test device | OS provider sheet |
| `17-native-auth-media.apple-cancel` | Cancel native provider sheet | Return to usable registration without false error |
| `17-native-auth-media.apple-error` | Inject native provider failure | Localized recoverable error |
| `17-native-auth-media.google-handoff` | Press native Google on configured test device | Account picker and correct return routing |
| `17-native-auth-media.photo-picker` | Open photo library from onboarding/profile | OS permission or library chooser |
| `17-native-auth-media.photo-cancel` | Cancel library/crop | Previous portrait and profile retained |
| `17-native-auth-media.photo-permission` | Deny media access where OS requests it | Recoverable picker error; no destructive change |

## Known gaps and exclusions

- **voice-intro (specified-gap):** Starter voice intro is coming soon; capture disabled affordance, not a recording journey.
- **web-push (platform-exclusion):** Web push is unavailable; capture honest unavailable state only.
- **native-provider (qualification-gap):** Component tests and emulator evidence do not establish fresh OS/provider delivery or negative delivery guarantees.
- **large-screen-navigation (not-implemented):** No tablet rail or desktop sidebar; do not classify existing bottom tabs as atlas failures.

## Next implementation boundary

Runner, fixture injection layer, screenshot verifier, Comradia skill adapter, Linear QA Run mapping, proof publishing and screenshot inspection are separate work. This manifest grants no deployment, external messaging, destructive cloud testing or product-feature implementation authorization.

## Scope exclusions

- Static marketing website apps/website is outside this Expo-client manifest.
- Backend-only cleanup and security invariants need tests/provider receipts, not invented screens.
- Future location/ranking, voice recording and unimplemented navigation shells are not working journeys.

## Fixture contract

- **accounts:** Disposable emulator accounts A and B with explicit complete/incomplete profiles; do not use owner data.
- **time:** Freeze age calculations, timestamps, resend countdown and sign-in freshness per checkpoint.
- **pending:** Hold named owning-layer promise/subscription until after capture; settle via state assertions.
- **errors:** Reject named operation with the localized error code called out by setup; no production outage required.
- **twoAccountChat:** Use two independent authenticated contexts; create mutual likes and messages through UI. Fixture ordering may be controlled; never inject replies and call it a two-account proof.
- **negativeCases:** No-write/no-alert/account-fence results require behavioral assertions in addition to screenshots.
- **privacy:** Use synthetic portraits and text; redact device account identifiers and credentials; never put token values in sidecars.

Known implementation gap: failed swipes restore the card without explicit error feedback. The runner captures that implemented state.
