# Private beta implementation and acceptance

Branch `feat/private-beta` is stacked on reviewed PR10 `bb19a1c`; PR10 remains open. This change adds editable public profile fields, session-only age/vibe filters over the existing Discover page (up to 50 people), per-device localized generic notifications, trusted orphan-message cleanup and authored Comradia branding.

Profile updates enumerate allowed fields and preserve private account data, age, photo and creation timestamp. UI writes are confirmed before session updates; failed saves retain drafts, duplicate taps are latched, and account changes/unmount fence late completions. Filters never pass hidden people; reset restores the loaded page. Account changes clear both applied filters and drafts.

Notification registrations accept optional en-US/pt-BR/es-ES locale; legacy registrations remain valid. Each language group refreshes token ownership and safety before FCM. Attempted token IDs prevent duplicate delivery if locale changes between groups. Generic content excludes private message text and identity. The existing claim-before-send loss window remains. Deploy updated rules before distributing the new client; Functions deployment is separate.

Cleanup reads parent absence and deletes at most 100 messages in the same transaction. Parent recreation conflicts/retries and preserves the active conversation, including older history conservatively. After 20 pages the handler throws so retry resumes remaining pages. No historical backfill or broader client deletion permission.

Local verification at this checkpoint:

- Typecheck passed; lint has zero errors (warnings remain).
- Unit: 195 passed.
- Component: 355 passed; 95.13% statements, 87.38% branches, 96.07% functions, 98.15% lines, unchanged floors. Final rerun after keyboard-aware screen integration has the same results.
- Rules: 160 passed; Functions: 21 passed, including seven trusted-cleanup scenarios.
- Focused browser persistence: three passed, Chromium/WebKit 390px and Chromium 320px. Real emulator/rules assertions preserve age/photo/createdAt/private account and confirm reload persistence and filter reset without swipe writes.
- Full browser regression: 143 passed, seven skipped, zero retries. Additional focused acceptance passed English persistence and Portuguese/Spanish controls in all three projects (nine cases); the independent two-session chat smoke passed all three projects after correcting a name-only test locator to the stable match ID. Both real UI sessions mutually like, exchange live messages in both directions, and preserve the conversation after reload; no reply or mutual like is injected by Admin fixtures.

Independent Luna review inspected all 42 staged paths at its checkpoint and found no confirmed actionable defects. The coordinator reviewed subsequent keyboard opt-in and test-only changes. Native acceptance remains a separate gate.

Motion uses the existing DS wrappers and button feedback. Editor/filter reveal only opens on user action, follows focus, settles when hidden and skips animation for reduced motion. Filter apply settles card progress without a swipe animation. Screenshot review found selected accent text below 4.5:1 on soft backgrounds; new controls now use primary text with selected border/background and accessible selection state. Explicit staged-diff motion scanner inspected 29 source files with no findings. Native rendering, keyboard and large-font acceptance remain pending.

The release APK rebuilt from PR10 bb19a1c succeeded (SHA-256 `ccdc3f4a019ac062de71c521ecc478a8c5ebf9c295fc87d4e190bb9c424dc277`). It predates this beta implementation. The initial installation returned DEVICE_IN_USE. The owner subsequently released the session. Bound device installation succeeded, launch succeeded, and the preserved Rafa QA session displayed Discover and Profile on the Galaxy A16 (Android 16). This is install/launch/navigation evidence, not a new notification-provider or App Check server-attestation receipt. No beta native binary or cloud deployment has been produced.


Post-commit mutation checks independently reverted the owning source while keeping new tests: all four profile tests, four Discover tests and one locale-registration test failed without the change, with zero new tests incorrectly passing and zero suite-load errors. Each run restored a clean tree; typecheck passed after restoration. Final source scanner inspected 30 files with no findings. Native screen keyboard avoidance reuses the existing DS opt-in; keyboard and large-font visual replay remains pending.
