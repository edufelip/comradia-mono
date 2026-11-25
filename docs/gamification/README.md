# Cravos gamification: implementation spec

This is the source spec for the gamification program ("Cravos"). It was written as an
interactive plan (private Claude artifact: https://claude.ai/artifact/4PcFSoTPrHF8GPTWHsHku7) and
copied here as text so the build has a durable reference in the repo. Section numbers below
follow the plan.

`ui-reference.js` in this folder is the prototype layer drawn on top of real atlas screens. It
holds the exact layouts, token values and motion values for every new UI moment (points toast
with close button, weekly streak card, achievement unlock, "Seus Cravos" wallet card, catalog
and replay sheet, store rating banner, medal drawing). It is a reference, not app code: build
the real screens from `Ds*` primitives and tokens, as `AGENTS.md` and `docs/design-system.md`
require.

## Owner decisions for the build (25 Nov 2026)

These override anything in the plan text that says otherwise.

- **Scope:** everything, including redemption (section 10) and the web-only `apps/admin`
  (section 9). Redemption ships behind the `gam_redemption` flag, which stays **off** until legal
  sign-off; the legal checks in section 10 remain launch blockers, not build blockers.
- **Scheduled job:** one weekly Cloud Scheduler job is allowed (Monday 03:00
  America/Sao_Paulo) to close streak weeks, send the Sunday reminder (see section 6; the
  reminder itself is the Sunday 18:00 rule, so the job may run twice weekly via one schedule or
  the reminder may be sent lazily), expire lots and re-check active achievements. Record the
  exception in `docs/architecture.md`.
- **No points for moderation.** Moderators have no track, XP, levels, streaks or achievements.
- **Store rating banner:** never earns anything (Apple and Google forbid rewarding ratings).
- **Flags:** Firebase Remote Config for flags and experiment arms; Firestore
  `gamConfig/active` only for the active rule-set pointer.
- **Delivery:** one feature branch `feat/gamification`, one PR into `develop`.

---

Gamification plan · comradia-mono · 21 Nov 2026

## Cravos: recognition for conversations that happen

 A complete plan for points, levels, weekly streaks and achievements in Comradia, built on the Firestore documents and Cloud Functions triggers the app already has. It rewards matches that turn into real conversations, never swipe volume, and it keeps the design system's promise of "no dark patterns, no gamified pressure."

 Plan only: no code, tickets or deploys
 Grounded in repo files
 New events are marked NEW
 Proposals are marked PROPOSAL

 Theme
 System
 Light
 Dark
 Simulate reduced motion

 Repo factsReal screensProgram & nameEarning rulesLevelsStreaksAchievementsRules engineAdmin editorRedemptionIntegrityMotionRolloutMetricsDecisionsNot verified

 Context

## What the template left blank, and how it was filled

 The request arrived with its placeholders unfilled. Each one was resolved from the repository; anything that is a choice rather than a fact is listed again under Open decisions.

 | | Placeholder | Filled with | Source

 | App / repo | Comradia, /home/eduwaldo/Projects/comradia-mono | README.md

 | What it does | Dating app for people on the left in Brazil: build a card from vibe, values and a prompt answer, swipe, match, chat. Expo app on Firebase, no server. | README.md, docs/architecture.md

 | Participant types | Members, the only people who earn Cravos. Moderators (today: owner uids in REPORT_ALERT_UIDS, reviewing in the Firebase console) get no points for moderation (owner decision, 25 Nov 2026). | docs/moderation.md, functions/src/report-alert.ts

 | Language | Plan in English; screen copy, level and achievement names in pt-BR, in the voice of localization/pt-BR.ts | docs/design-system.md § Language and content

 | Design system | getDsTheme(scheme) tokens, DsTypography (Geist / Geist Mono), DS_MOTION | apps/mobile/constants/design-system.ts, motion.ts

 | Animation library | Reanimated ~4.1.1 + expo-haptics ~15.0.8, react-native-svg for shapes | apps/mobile/package.json

 | Admin app path | None exists. PROPOSAL: apps/admin (web only) | repo layout (apps/ has mobile, firebase, website)

 | Jurisdiction | Brazil, LGPD (Law 13,709/2018); political values, union membership and "looking for" are sensitive data under art. 11 | docs/legal/privacy-policy.en.md §5

 1 · Grounded in the repo

## What already measures activity, what is switched off, what could collide

 There is no event log, analytics SDK, streak, tier, badge or points feature anywhere in the repo. Activity exists only as Firestore documents that the security rules validate, plus five Cloud Functions triggers that already react to some of them. The plan builds on those and adds nothing on the client that writes points.

## Activity sources that exist today

 | | Firestore path (real) | Written by | Existing server hook | Used in this plan for

 | matches/{a_b} | client batch; rules allow create only when both likes exist (existsAfter) | notifyOnMatchCreated (onDocumentCreated) | match.created

 | matches/{a_b}/messages/{id} (from, text, createdAt) | sender; never edited | notifyOnMessageCreated | NEW derived message.first_in_match, message.timely_reply, conversation.started, conversation.sustained

 | matches/{a_b} delete | caller after withdrawing their like | cleanupOnMatchDeleted | clawbacks

 | reports/{reporter_target} (reason: harassment, hate, fake, spam, underage, other; context: profile / chat) | reporter, once per target | notifyOnReportCreated | holds and clawbacks

 | blocks/{uid}/by/{blockerUid} | blocker | none | NEW trigger for clawbacks

 | profiles/{uid} (photoPath, promptId, promptAnswer, updatedAt) | owner, full valid card | none (Storage trigger enforceProfilePhotoCap only sees files) | NEW trigger: profile.photo_added, profile.prompt_refreshed

 | users/{uid}/swipes/{target} (direction like / pass), likes/{target}/from/{me} | owner / liker | none | guardrail metric only; never rewarded

 | Firebase Auth user delete | account deletion in Profile | cleanupOnAuthUserDeleted (account-cleanup.ts) | purge gamification data

 Existing event "kinds": CreatedNotificationEvent.type is 'match' | 'message' in functions/src/notification-handler.ts; report pushes use type: report. Idempotency precedent: per-recipient claim markers written before FCM sends, expiring after seven days, and isEventOlderThan(event.time, 6) in event-age.ts.

## Switched off or not shipped

 - Payments: react-native-purchases and -ui are in package.json with zero imports. No reward may depend on purchases, and Cravos must never be buyable.

 - Feature flags: none. No Remote Config package, no flags collection.

 - Analytics: none. Only Crashlytics. The privacy policy says "We do not use third-party analytics tools".

 - App Check: integrated but in monitor mode, not enforced.

 - Prod Functions: comradia-prod still lists "Functions, App Check" as to do.

 - In-app moderation tool: none; review happens in the console.

 - Deferred: unmatch, voice intros ("coming soon"), more photos, ranking by distance.

 - Scheduled jobs: none on purpose ("add no scheduled jobs or external services").

## Naming that could collide

 - discover.union_badge = "Sindicalizado(a)", and the architecture calls it the "union badge". Copy must say conquistas or selos, never "badge"; code namespace gam.* / achievement.

 - discover.action.solidarity is the Like button ("Curtir"). Don't call points "solidariedade".

 - discover.praxis_label ("VALORES & PRIMEIRO ENCONTRO").

 - DsTypography.micro is documented as "Badges and tiny counters"; fine to reuse for counts.

 - DsStepProgress "Step n of N": keep "nível" off onboarding screens.

 - No existing "points", "XP", "tier" or "level" wording.

## Audience and real value

 - Brazil first: +55 phone sign-in only, São Paulo copy, unions such as apeoesp, metalurgicos_abc.

 - Six languages (en-US, pt-BR, es-ES, fr-FR, de-DE, it-IT).

 - Values include community_gardens, tenant_rights, bookshops_coffee, cycling, volunteering.

 - No business or audience doc exists beyond the README, the website and the legal drafts. The value chain is read from the screens: match (S8) → chat (S10).

## Constraints the plan must respect

 - Design principle: "No dark patterns, no gamified pressure."

 - Motion: 120 / 220 / 360 ms, ease-out [0.16, 1, 0.3, 1], "No springs, no bounce", Reduce Motion shows the end state.

 - Lock-screen copy is generic: no names or values (docs/notifications.md).

 - Costs: stay inside Blaze free allowances; budgets R$ 25 (dev) and R$ 50 (prod); owner yes before anything billed per hour or per message.

 - users/{uid} is owner-writable, so balances can never live there.

 2 · Key moments

## The real app, with Cravos in it

 These phones are not drawings. Each one is a copy of a screen from Comradia's own web build, rendered by the production components with the repo's screen-capture fixtures (tests/atlas/scenarios.ts, the same driver as yarn test:atlas) at 390 × 844 in pt-BR. The DOM and CSS are react-native-web's own output, with the app's Geist and MaterialIcons font files. Rendered on its own, each copy matched the live capture with 0 differing pixels. The theme buttons above switch between the light and dark captures.

 The Cravos layer is added on top of the real screen. It is built from the existing primitives (DsCard, DsNotice, DsSheet, DsPillButton, the value chip) with values copied from design-system.ts and motion.ts; anything new is marked PROPOSED in the spec. Press Show the app today to see the untouched screen.

 Cravos ganhos
 Sequência
 Conquista
 Carteira e níveis
 Catálogo
 Avaliação na loja
 Descobrir (sem mudança)

 ReplayShow the app today

 Real screen: /chat/maya_test-user, atlas checkpoint 12-chat.history. Cravos layer: A DsNotice overlay and one sent bubble, cloned from the real bubble.

## Points earned toast

- **Trigger**: A new gamification/{uid}/celebrations/{id} doc with kind: "toast", written by the engine when conversation.started (NEW) is released: both people have sent 3+ messages over 10+ minutes.

- **Motion**: Enters like DsMotionView variant="reveal": fades in and rises 8 pt over 220 ms ease-out. Leaves like DsNotice: fades and moves up 8 pt over 120 ms. Amount counts up from 0 over 600 ms (PROPOSED DS_MOTION.duration.countUp). Ten petals leave the icon over 700 ms and fade. Auto-dismisses after 5 s, the DsNotice minimum for a notice with no actions. Two earns within 2 s merge into one toast ("+35 Cravos · 2 ações").

- **Haptic**: Haptics.impactAsync(Light) when the count lands: the same weight as HapticTab.

- **Reduced motion**: Toast appears in place with the final number. No petals, no count-up.

- **Placement**: Exactly where PushNotificationBridge puts today's foreground notice: 16 pt from the sides, 8 pt below the safe area, z-index 3. It is the real DsNotice anatomy (DsCard, tone tint, 24 pt MaterialIcons glyph, cardTitle + body). PROPOSED: an icon prop so the glyph can be local-florist. It covers the chat header for 5 s and never the composer. PROPOSED: an onClose prop that adds a close button (20 pt close glyph in textSecondary, 44 pt target, on the title line) and plays the same 120 ms exit. It has no action buttons, so it still auto-dismisses after 5 s and never steals focus while someone is typing. Announced politely by screen readers.

- **Copy**: +30 Cravos · Conversa iniciada com Mayaa11y: "Você ganhou 30 Cravos. Conversa iniciada com Maya."

 ReplayShow the app todayShow rested state

 Real screen: /matches, atlas checkpoint 11-matches.ready. Cravos layer: A weekly-streak DsCard above the real match rows.

## Weekly streak progress

- **Where**: PROPOSAL: a DsCard at the top of the Matches tab (app/(tabs)/matches.tsx), above the match rows, inside the screen's existing gap.

- **Trigger**: The first qualifying action of the week (NEW streak.week_qualified): a message sent in any match, the weekly quest done, or a refreshed prompt answer. Swipes never count.

- **Motion**: The ring fills over 360 ms ease-out. This week's dot fills over 220 ms. The counter steps 5 → 6 over 120 ms. A milestone week (4, 12, 26, 52) gets a toast and, if the session allowance is free, the achievement screen.

- **Haptic**: Haptics.selectionAsync() once, when the ring closes. None for reminders.

- **Reduced motion**: Ring, dot and number show the end state at once.

- **Rested state**: Neutral surface, no red, no "you lost". The record stays visible and one action restarts it. A dashed cyan dot marks a week covered by a pause.

- **Reminder**: One push at Sunday 18:00 (America/Sao_Paulo), only if push is on, the week hasn't counted and the reminder setting is on. Generic lock-screen copy, as docs/notifications.md requires.

- **Copy**: Esta semana já conta: você respondeu a Maya. · Sua sequência descansou · Seu recorde continua: 9 semanas.

 ReplayShow the app today

 Real screen: /match/maya_test-user, atlas checkpoint 10-match.ready. Cravos layer: The real Match celebration screen, relabelled, with the medal in place of the portraits.

## Achievement unlock (full screen, gold or a level-up)

- **Trigger**: achievement.unlocked (NEW) for a new tier, when the session's full-screen allowance is free. Otherwise it waits in the "Novidades" inbox with a static medal.

- **Gating**: At most 1 full-screen gamification moment per app session. Never while the chat composer has focus, during onboarding, on /safety/[uid] or /blocked, or within 2 minutes of MatchCelebration. The match celebration always wins.

- **Motion**: Scrim fades in over 220 ms. The medal uses exactly the values of the heart in MatchCelebration: 360 ms, Easing.out(Easing.cubic), opacity 0 → 1, y −10 → 0, scale 0.62 → 1. The screen reuses the Match screen's layout (app/match/[id].tsx): blob background, hero title, two cards, primary and secondary pills. PROPOSED: a NEW route /conquista/[id] built from those same parts. 40 confetti pieces fall for 900 ms (PROPOSED DS_MOTION.duration.celebrate), drawn with react-native-svg + Reanimated shared values. Nothing flashes.

- **Haptic**: Haptics.notificationAsync(Success) once, when the medal settles.

- **Reduced motion**: Static medal, no confetti, scrim and copy appear at once.

- **Exit**: "Continuar", a tap on the scrim, Android back or Escape. Focus moves to the title on open and back to the previous element on close.

- **Copy**: Nova conquista · Primeira faísca · Bronze · Você e outra pessoa trocaram as primeiras mensagens de verdade. · Ver conquistas / Continuar

 ReplayShow the app today

 Real screen: /profile, atlas checkpoint 13-profile.ready. Cravos layer: A "Seus Cravos" DsCard after the real profile card.

## Wallet and levels

- **Where**: PROPOSAL: a "Seus Cravos" card on Profile, between the profile card and "Valores e paixões", that opens a pushed screen /cravos. No new tab, because the tab bar stays Discover / Matches / Profile.

- **Data**: Reads the projection gamification/{uid} (owner read only) and the last 20 entries of gamification/{uid}/ledger. Clawbacks show as plain "Ajuste" rows with a reason.

- **Motion**: On the first open of a session, the balance counts up from the last value seen (not from 0) over 600 ms, and the level bar fills over 360 ms. Later opens are static. A level-up crossfades the level chip over 220 ms. It uses the full-screen allowance only if it is free; otherwise it shows a toast.

- **Haptic**: None on open. Success on a level-up.

- **Reduced motion**: Final numbers and bar at once.

- **States**: Loading uses DsSkeletonCard. Empty: "Seus primeiros Cravos chegam quando uma conversa começa." Offline uses DsOfflineBanner and keeps cached numbers. "Trocar Cravos" stays a disabled "Em breve" row until gam_redemption is on.

- **Copy**: Seus Cravos · Nível Ramalhete · 1.240 de 2.500 para Jardim · Ajuste: match desfeito

 ReplayShow the app today

 Real screen: /profile, atlas checkpoint 13-profile.ready. Cravos layer: "Seus Cravos" and "Conquistas" DsCards; tap a medal to replay it in a DsSheet.

## Achievement catalog

- **Where**: PROPOSAL: a "Conquistas" DsCard on Profile, under "Seus Cravos". Bronze and silver replays open in a DsSheet (overlayNeutral scrim, surfaceElevated, 20 pt top corners, grab handle).

- **Interaction**: Tap an earned achievement in the phone to replay its unlock. Replays from the catalog never count against the session allowance. Locked ones show what's left ("Faltam 3").

- **Privacy**: Private by default. No achievement encodes values, causes, union membership or who someone is looking for: under LGPD art. 11 those are sensitive data.

- **Active achievements**: "Em roda" and "Escuta atenta" show a "ativa até 12 dez" caption and go grey (not hidden) when they lapse.

- **Copy**: Conquistas · Só você vê. Toque para rever.

 The full catalog is in section 7; clicking a card there replays its unlock on the real Conquista screen in section 2.

 ReplayShow the app today

 Tap Avaliar or Agora não in the phone.

 Real screen: /matches, atlas checkpoint 11-matches.ready. Added: a rating banner (an inline DsNotice) above the real match rows. The dashed panel after Avaliar only marks where the store's own sheet opens; it is not a copy of it.

## Store rating banner (no Cravos)

- **Rule**: Rating the app never earns Cravos, achievements or any perk. Apple and Google both forbid rewarding ratings or reviews, and neither review API tells the app whether the person rated, so a reward couldn't be checked anyway.

- **Layout**: The existing DsNotice, inline (no overlay shadow), laid out exactly like ForegroundNotification: glyph, then a column with title, body and the actions, so the buttons line up with the text. DsPillButton size="sm": Avaliar is primary, Agora não is ghost. Needs the same PROPOSED icon prop as the points toast, for the star glyph.

- **Where**: PROPOSAL: at the top of the Matches tab (app/(tabs)/matches.tsx), above the match rows, in the same slot as the streak card. When both qualify, the rating banner waits for the next visit, so there is never more than one card above the rows. Never on Discover, in a chat, during onboarding, on /safety/[uid] or /blocked.

- **When it shows**: On iOS and Android only (not web), and only when all of these hold: at least 14 days since it was last shown; at least 7 days since the first sign-in on this device; at least one match; no celebration or full-screen moment in this session; and the person has never tapped Avaliar.

- **Avaliar**: Calls StoreReview.requestReview() from expo-store-review (NEW dependency, not in package.json today). It opens the system review sheet (StoreKit on iOS, Play In-App Review on Android). The banner never shows again after this tap.

- **Agora não**: Hides the banner and starts a new 14-day wait.

- **"Already rated"**: The app can't know. Both APIs return nothing about whether a sheet appeared or a rating was sent. The closest signal is the Avaliar tap, so that tap is what stops the banner for good. iOS also shows its sheet at most 3 times a year and may show nothing at all.

- **Storage**: On the device, in AsyncStorage, under a per-user key, following the comradia.push.enabled.<uid> pattern in features/notifications/notifications.native.ts. PROPOSED key: comradia.rating.v1.<uid>, holding lastShownAt and ratedTapAt. No Firestore write and no rules change. Reinstalling the app clears it.

- **Motion**: Enters like DsMotionView variant="reveal": fades in and rises 8 pt over 220 ms ease-out. Leaves like DsNotice: fades and moves up 8 pt over 120 ms. No haptic and no confetti. With reduced motion it appears and leaves in place.

- **Wording**: Neutral. It never asks "Está gostando?" first and never sends only happy users to the store: Google's guidance forbids asking for an opinion before or while showing the rating option.

- **Copy**: Avalie o Comradia · Sua avaliação na loja ajuda outras pessoas a encontrar o app. Leva um minuto. · Agora não · Avaliar

 ReplayShow the app today

 Real screen: /discover, atlas checkpoint 08-discovery.ready. Cravos layer: Nothing, on purpose.

## Discover stays untouched

- **Rule**: Likes, passes and app opens never earn Cravos, so Discover gets no balance chip, no counter and no reward moment. Ranking and visibility never depend on Cravos or levels.

- **Why show it**: So the "app today" and "with Cravos" views are compared on the one screen where the plan deliberately adds nothing.

 What these phones are not. They are the web build (react-native-web in Chromium), not iOS or Android: no status bar, no native shadows, no haptics. The people (Ana, Maya, Lucas) and their messages are synthetic atlas fixtures; the few user-written fixture lines were in English and are shown in Portuguese here, while every interface string is the app's own pt-BR. The tab-bar labels look clipped at the bottom because that is how the current web build renders at 390 × 844.

 3 · Program and name

## One program: Cravos, for members

 Track A · Members

## Cravos (spendable)

 Earned for actions that move a match toward a real conversation. The balance goes up and down (clawbacks, future redemption). The level is based on lifetime net earnings and never goes down. The currency has no cash value, can't be transferred and can't be bought.

 Monthly target: engaged member ≈ 600, casual member ≈ 150.

 No points for moderation (owner decision, 25 Nov 2026). Reviewing reports earns no Cravos, XP, levels, streaks or achievements, so nothing pushes a moderator to rush a decision or to favour one outcome. A moderator who also uses the app as a member earns Cravos for member actions only, like anyone else.

## Points name

 | | Name | Why it fits | Trade-off

 | Cravos (working name) | The carnation is a romantic flower in Brazil and the symbol of the 1974 Carnation Revolution in the Portuguese-speaking world. Romance and solidarity in one word, matching "Where solidarity meets romance." It grows into the level ladder (Botão → Primavera). | Less obvious to younger users who don't know the history. Translations need a gloss (en "Carnations"). Masculine noun, so check grammar in copy ("1 Cravo", "30 Cravos").

 | Faíscas | "Sparks": instant, flirty, easy for everyone. | Generic and used by other dating products. No political roots.

 | Rosas | The socialist rose and a romantic gift. | Reads as a specific party symbol to some people (social democracy), and the plan avoids any party association.

 | Brasas | "Embers": slow warmth, matching the conversation-first rules. | Also means a rough-voiced person in slang. Less visual as an icon.

 | Cotas | Union dues ("cota"), a nod to the union field on profiles. | Sounds administrative, and "cotas" also means quotas, a charged public-policy word.

 4 · Earning rules

## What earns, how much, and when it is taken back
Every action maps to an existing Firestore document or trigger. Derived events are NEW and computed only on the server.

 | | Action | Event | Cravos | Caps | Clawback | Notes

 | Conversation started: each person sent 3+ messages over 10+ min | NEW conversation.started from notifyOnMessageCreated path | 30 each | 3/day · 1 per pair, lifetime | Match deleted within 7 days; report upheld against you in that match; you were blocked by them within 7 days | The core value event. Held 24 h before release.

 | Conversation sustained: both active on 3 different days within 14 days | NEW conversation.sustained | 40 each | 2/week · 1 per pair, lifetime | Report upheld in that match | Best available proxy for a real connection.

 | First message within 24 h of the match | NEW message.first_in_match | 10 | 5/day · 1 per pair | Voided if the other person reports or blocks within 72 h | Pending until they reply or 72 h pass. Rewards making the first move without paying for spam.

 | Timely reply: answering a message that waited under 24 h | NEW message.timely_reply | 5 | 6/day · 1 per pair per day · 2 h minimum gap | None (small) | Counters ghosting ("vácuo"). Never per message.

 | Mutual match | matches/{a_b} create → match.created | 5 each | 3/day · 1 per pair, lifetime | Match deleted within 7 days | Kept small: paying for matches pays for liking everyone. Shadow-test 0 vs 5.

 | Portrait added (first time) | NEW profile.photo_added (trigger on profiles/{uid}, photoPath null → set) | 30 | Lifetime 1 | Portrait removed within 7 days | The portrait is optional today. A fuller card helps every deck.

 | Prompt answer refreshed | NEW profile.prompt_refreshed | 10 | 1 per 30 days | None | Keeps cards current. Too small to farm.

 | Weekly streak week completed | NEW streak.week_completed | 15 | 1/week | None | See Streaks.

 | Streak milestone (4 / 12 / 26 / 52 weeks) | NEW streak.milestone | 50 / 100 / 200 / 400 | Once each, lifetime | None | Also unlocks the "Constância" tiers.

 | Weekly quest completed | NEW quest.completed | 25 | 1 quest/week | Re-evaluated if its parts are clawed back | Examples: "Responda 3 conversas", "Mande a primeira mensagem em 2 matches", "Atualize sua resposta".

## Never rewarded, on purpose

 Likes, passes or any swipe count (it would distort the deck and reward indiscriminate liking). App opens and session time. Turning on notifications (rewarding a permission prompt is a dark pattern). Filing reports or blocks (it invites false reports; an upheld report earns a private thank-you instead, not points). Invites (until referral fraud controls exist). Store ratings or reviews (Apple and Google forbid rewarding them, and the app can't see whether a rating happened). Achievements themselves (recognition is not currency, which avoids double counting).

 | | Monthly tuning | Engaged: times / month | Engaged: Cravos | Casual: times / month | Casual: Cravos

 | Mutual match (5) | 12 | 60 | 3 | 15

 | First message ≤ 24 h (10) | 8 | 80 | 1 | 10

 | Conversation started (30) | 5 | 150 | 1 | 30

 | Conversation sustained (40) | 2 | 80 | 0 | 0

 | Timely reply (5) | 18 | 90 | 4 | 20

 | Streak week (15) | 4 | 60 | 2 | 30

 | Weekly quest (25) | 3 | 75 | 1 | 25

 | Prompt refreshed (10) | 1 | 10 | 0.3 | 3

 | Total vs target | | 605 / 600 | | 133 / 150

 The frequencies are assumptions: there is no analytics data. The shadow phase measures the real distribution from createdAt on existing matches and messages documents, then the values are tuned from the admin editor without a release.

 5 · Levels

## Ladders that only go up
The level is computed from lifetime net earnings (earned minus clawbacks) as a high-water mark, so it never drops. No perk changes who sees whom: ranking stays untouched.

 | | Cravos level | Lifetime | Perks (PROPOSAL) | Engaged reaches it

 | Botão | 0 | Wallet, streak, achievements, 1 pause slot | Day 1

 | Flor | 300 | 2nd pause slot; choose the medal style on your wallet | ~2 weeks

 | Ramalhete | 1,000 | Early access to new features (e.g. voice intros, now "coming soon") | ~7 weeks

 | Jardim | 2,500 | 3rd pause slot; preview of the next seasonal achievement | ~4 months

 | Primavera | 5,000 | Invitation to the member council (product feedback group) | ~8 months

 6 · Streaks

## Weekly, with pauses and no punishment

## Why weekly, not daily

 Dating use comes in bursts, and replies arrive on someone else's schedule. A daily streak would push people to open the app and swipe for nothing, which breaks the design system's "no gamified pressure" rule and rewards the wrong action. A week is long enough for one honest conversation. It also lines up with how matches are made: a deck of up to 50 people, refreshed when someone comes back. The shadow phase checks this against the real distribution of active days per week, read from messages.createdAt and swipes.createdAt.

## Member streak rules

 - Week: Monday 00:00 to Sunday 23:59, America/Sao_Paulo.

 - Counts: one message sent in any match, or the weekly quest done, or a refreshed prompt answer (at most once per 30 days). Members with no matches can still keep a streak through the quest.

 - Pauses: earn 1 per 4 completed weeks; bank 1 / 2 / 3 by level. Used automatically when a week would rest.

 - Break: "Pausar" in settings freezes the streak for up to 12 weeks (travel, or dating someone) with no reminders.

 - Milestones: 4, 12, 26, 52 weeks (Cravos above plus "Constância" tiers).

 - Reminder: one push on Sunday at 18:00 if the week hasn't counted. Off by one switch; generic text.

 - Rested state: "Sua sequência descansou", with the record kept and no red or loss wording.

## Cost note

 Closing weeks needs time-based logic. Recommended: evaluate lazily on the next event, plus one weekly Cloud Scheduler job on Monday at 03:00 to close the remaining weeks and send Sunday reminders. That is one of the three free scheduler jobs, but the architecture says "add no scheduled jobs", so it needs the owner's yes (Open decisions).

 7 · Achievements (conquistas)

## Starter catalog
Bronze, silver and gold tiers. Click a card to replay its unlock on the real Conquista screen in section 2. All are private by default, and none can reveal sensitive data.

 Active achievements are re-checked every night (the same scheduler job) over a rolling window. Losing one writes an achievement.lapsed entry and greys it out with "ativa de novo quando…". Regaining it writes achievement.regained, which can trigger a toast but never another full-screen moment. Seasonal achievements are campaigns in the rule set, with dates and audiences editable in the admin.

 8 · Rules engine

## Everything in Firestore, versioned, editable without a release

 [diagram]

## Collections (all PROPOSAL)

 - gamRuleSets/{id}: version, status (draft → simulated → published → archived), parentVersion, author, notes, and the nested earnRules[], quests[], achievements[], streakRules, campaigns[], levels[].

 - gamConfig/active: {ruleSetId, publishedAt, publishedBy}. Rollback means pointing it back at an earlier published version.

 - gamification/{uid}: projection (balance, level, streak, achievements). Owner read only.

 - gamification/{uid}/ledger/{idempotencyKey}: append-only. Owner read only.

 - gamification/{uid}/celebrations/{id}: owner read; the owner may update only seenAt.

 - gamification/{uid}/counters/{bucket}, gamShadow/…, gamAudit/{id}, gamMetrics/{day}: server only.

 The existing rules end with "Everything else is denied", so these paths need explicit owner-read rules and nothing else. The Admin SDK in Functions writes past the rules. Each allow and deny gets a test in apps/firebase/tests.

## Ledger and projections

 - The document id is the idempotency key, so create() fails on a retry. Triggers already run with retry: true, so a retried event can never pay twice.

 - Key shape: {ruleId}:{sourceId}:{uid}, e.g. conversation_started:ab12_cd34:ab12. Clawback: clawback:{originalKey}.

 - Entries are never updated or deleted, except by account deletion (see Integrity). Corrections are new signed entries.

 - Every entry records ruleSetVersion, so a rollback never rewrites history.

 - rebuildProjection(uid) folds the ledger in createdAt order. A nightly sample of 1% of members compares the stored projection with a rebuild and alerts on drift.

 - Levels use a high-water mark; a negative balance blocks redemption but is shown as 0 with a note.

## Example rule (JSON)

{
 "id": "conversation_started",
 "track": "cravos",
 "event": "conversation.started",
 "award": { "amount": 30, "to": "both_participants" },
 "conditions": [
 { "fact": "conversation.messagesEach", "op": ">=", "value": 3 },
 { "fact": "conversation.spanMinutes", "op": ">=", "value": 10 },
 { "fact": "account.ageDays", "op": ">=", "value": 7 }
 ],
 "caps": { "perDay": 3, "perPairLifetime": 1 },
 "hold": { "hours": 24, "releaseIf": "no_report_no_block" },
 "clawback": [
 { "on": "match.deleted", "withinDays": 7 },
 { "on": "report.upheld", "scope": "match", "party": "reported" },
 { "on": "block.created", "withinDays": 7, "party": "blocked" }
 ],
 "idempotencyKey": "{ruleId}:{matchId}:{uid}",
 "celebration": { "kind": "toast", "copyKey": "gam.toast.conversation_started" },
 "audience": { "experiment": "gam_v1", "arm": "treatment" }
}

## Example ledger entry

gamification/ab12/ledger/conversation_started:ab12_cd34:ab12
{
 "track": "cravos",
 "kind": "earn", // earn | clawback | adjust | expire | redeem
 "amount": 30,
 "ruleId": "conversation_started",
 "ruleSetVersion": 7,
 "source": { "event": "conversation.started",
 "path": "matches/ab12_cd34",
 "eventId": "projects/…/events/9f2c…" },
 "lot": { "expiresAt": "2027-11-21" }, // used only once redemption is on
 "actor": "system",
 "createdAt": "2026-11-21T22:42:10Z"
}

## How the client learns what was earned

 There is no API server, so a celebrations[] response array exists only where a callable function is involved (claimQuest, redeem), which return { ok, celebrations: [...] }. Earns from triggers, which is most of them, write gamification/{uid}/celebrations/{id}. One listener (unseen, limit 10) feeds the toast queue while the app is open. Earns that land later stay unseen and show in a "Novidades" sheet on the next open. Notable ones (new tier, level, milestone) can also send a push through the existing dispatcher with a NEW type: 'reward', in generic, per-locale copy. Today the app ignores unknown types, as it does report.

 9 · Admin editor

## Edit, simulate, publish, roll back
No admin app exists. PROPOSAL: apps/admin, a web-only app with its own toolchain like the other apps. Firebase Auth with a NEW gamAdmin custom claim; every write goes through callable Functions that append to gamAudit.

## Rule sets
Versions, status, diff against published, publish (two people), roll back.

## Earn rules
Form with live preview and monthly projection (demo below).

## Quests
Weekly goals, parts, reward, audience.

## Achievements
Tiers, criteria, rolling window, season dates, medal art.

## Streak rules
Qualifying actions, pause earn rate, bank sizes, reminder time.

## Campaigns
Multiplier, audience, dates, issuance budget cap.

## Levels
Thresholds, names in six languages, perks.

## Simulator
Replays the last 14 days of real events against a draft.

## Ledger lookup
Find a member, read entries, add a signed adjustment.

## Flags and experiment
Read-only mirror of flag values and arm sizes.

## Liability
Outstanding balance by lot expiry (redemption phase).

## Audit log
Who changed what, when, and why.

 Example · earn rule editor

## Edit draft v8

 Action

 Cravos

 Per day

 Campaign ×

 Campaign days

 AudienceExperiment gam_v1 · treatmentAll membersShadow only

 Toast preview
 [diagram]
+30 CravosConversa iniciada com Maya

 Live preview

## Projected monthly Cravos

 Bars show the total for each persona with this rule as drafted and all other rules as published. The black tick is the target (600 / 150). Frequencies are the assumptions from section 4.

## Rule JSON

 Example · simulator

## Replay the last 14 days against draft v8

 Example data, not real counts. In the real tool these come from matches and messages documents created in the window, with each event run through both rule sets in memory. Nothing is written.

 Run simulation

 Not run yet.

 Example · ledger lookup

## Member demo-7f3a

 | | Key | Kind | Amount

 Balance

 Signed amount

 Case id

 Reason (required, 10+ characters)

 Second approver (over 500)

 Append adjustment

 Rows have no edit or delete action: the ledger is append-only.

 10 · Future redemption

## Design only, behind gam_redemption

## Mixed catalog

 - Partner-funded: a coffee at independent bookshop-cafés, indie cinema tickets, bike-share day passes, community garden seed kits. These match the bookshops_coffee, indie_film_music, cycling and community_gardens values without exposing anyone's values.

 - App perks: an extra pause, wallet medal styles, early access. Cost to the app is close to zero.

 - Drops: limited stock, first come (concert tickets). Prefer drops over raffles at first; see legal checks.

 - Give: turn Cravos into a partner-funded donation to a community kitchen. The partner pays; Cravos never become money.

## Money rules

 - No cash value, not transferable, not purchasable, not exchangeable for money.

 - Expiry per lot: each earn is a lot that expires 12 months after it was earned. Spending uses the oldest lot first (FIFO). Notice 30 days before; an expire ledger entry when it happens.

 - Liability: outstanding unexpired Cravos × expected cost per Cravo per catalog mix, minus expected breakage. A monthly report in the admin Liability screen; partner-funded items carry zero app cost.

 - Eligibility: account 30+ days old, level Flor or higher, no open report against the member, balance ≥ price.

## Transactional flow

 - Client calls redeem({itemId, idempotencyKey}); App Check required.

 - One Firestore transaction: check the flag, eligibility and stock; take lots oldest first; write one redeem entry per lot; decrement stock; create redemptions/{id} with status pending.

 - Fulfilment assigns a code from a pre-loaded partner pool. Status becomes fulfilled; on failure, failed plus refund entries.

 - Response: { ok, redemptionId, code, celebrations: [...] }.

 - Partners get only a single-use code, never a name, uid or profile.

## Legal and privacy checks before launch (Brazil)

 - LGPD: new purpose in the privacy policy (program operation, contract basis art. 7 V); DPO review. Redemption history can reveal political opinion (e.g. redeeming at a movement-run shop), so treat it as sensitive and never share it with partners.

 - Raffles and prize promotions (Law 5,768/1971 and its regulations) need prior authorization from the federal authority, today the Ministry of Finance's prizes and betting secretariat. Verify with counsel, or launch with drops only.

 - Consumer code (CDC): clear program terms, visible expiry, no unilateral devaluation without notice.

 - Tax treatment of prizes, and partner contracts (operator terms) for any data partners touch.

 - Terms of use (docs/legal/terms.*.md) gain a program rulebook ("regulamento").

 11 · Integrity

## Hard to farm, fair to undo

 | | Risk | Control

 | Client writes points | Points come only from Functions using the Admin SDK. Rules deny every client write to gamification/** except celebrations.seenAt. There are no client-written events: the engine derives events from documents the rules already validate.

 | Two accounts farming each other | Per-pair lifetime caps on every pair-based rule. conversation.started needs both accounts 7+ days old, 3+ messages each and a 10+ minute span. A hold if both accounts share a hashed push token (users/{uid}/pushTokens/{sha256(token)} already hashes). Enforce App Check before the UI phase (today it is in monitor mode).

 | Rapid ping-pong messages | Timing and count checks only. The engine never reads message text, for privacy. Timely-reply credit needs a 2 h gap per pair.

 | Undo after the reward | Clawback entries on match.deleted (≤ 7 days), report.upheld for the reported party, and block.created (≤ 7 days) for the blocked party. The blocker never loses anything.

 | Rewards before verification | Pair rewards sit in a 24–72 h hold (status: held in counters, not the ledger) and are released only if no report or block lands.

 | Self-dealing by staff | Admins can't adjust their own balance. Adjustments over 500 need a second approver. Publishing needs two people. Everything lands in gamAudit.

 | Velocity | Alerts when a member earns over 3× the engaged daily mean, starts over 5 conversations in a day, or when a rule's daily issuance exceeds the simulator forecast by 25%. Alerts reach owners the same way report alerts do (REPORT_ALERT_UIDS pattern). gam_kill_switch stops all issuance.

 | Moderation | Earns nothing (owner decision, 25 Nov 2026), so there is no incentive to rush reviews or to uphold more reports.

 | Account deletion | Extend cleanupOnAuthUserDeleted / account-cleanup.ts to delete gamification/{uid} recursively, plus gamShadow/{uid}. Per-pair counters on the other member store a salted hash of the pair, not the deleted uid. Only anonymized daily totals remain in gamMetrics. If redemption is live, keep pseudonymized redemption records for the legally required period.

 12 · Motion spec

## Celebrate the result, never block the task
Reanimated 4 withTiming with Easing.bezier(0.16, 1, 0.3, 1); no withSpring. useReducedMotion() shows end states. Haptics through expo-haptics.

 | | Moment | Animation | Timing | Haptic | Reduced motion | Blocking?

 | Points toast | translateY −16 → 0 + opacity; count-up; 10 petals | 220 in · 600 count · 700 petals · 5 s hold · 220 out | impact Light | Static toast, final number | No. pointerEvents="box-none", no actions

 | Streak progress | Ring stroke offset; dot fill; counter step | 360 · 220 · 120 | selection | End state | No (inline)

 | Achievement unlock | Scrim fade; medal scale 0.92 → 1; copy rise; 40 confetti | 220 · 360 · 220 (+180 delay) · 900 | notification Success | Static medal, no confetti | Dismissable at once; at most 1 per session

 | Level up | Bar fill; level chip crossfade | 360 · 220 | notification Success | End state | Toast if the allowance is used

 | Wallet open | Balance count-up from last seen value; bar fill | 600 · 360, first open per session only | none | End values | No

 | Rested streak | none (no shake, no red) | — | none | — | No

## Session rules

 - At most 1 full-screen gamification moment per app session; the rest go to "Novidades".

 - MatchCelebration always wins and blocks gamification full screens for 2 minutes.

 - Toasts queue; two within 2 s merge; never more than one on screen.

 - Nothing animates while hidden; a celebration that arrives while blurred plays on focus or not at all. This avoids the first-frame jumps flagged in docs/qa/motion-audit.md.

## Design-system changes needed (PROPOSAL)

 - DS_MOTION.duration.countUp = 600 and celebrate = 900: off the current scale, so rule 10 requires updating design-system.md and motion-design.md in the same change.

 - DsAchievementTier fixed palette (bronze, silver, gold) beside DsArt, with contrast tests for any text on it.

 - New primitives: DsRewardToast (composes DsNotice overlay), DsProgressRing, DsCountUp, DsMedal, DsConfetti; each with a component test and a specimen entry (yarn ds:specimen).

 13 · Rollout

## Phases behind flags

 | | Phase | What ships | Flags (PROPOSAL) | Exit criteria

 | 0 · Prerequisites | Flag system (Remote Config: new @react-native-firebase/remote-config + web SDK), App Check enforced, rules for the new paths, DS tokens and primitives, privacy and terms drafts for the lawyer, owner yes for new Functions and one scheduler job. | gam_kill_switch | Rules and Functions tests green; owner approval recorded.

 | 1 · Shadow (4 weeks, all members, invisible) | Engine runs on real events and writes gamShadow only. No UI, no pushes. | gam_shadow=true, gam_ui_enabled=false | Median monthly earn within ±20% of 600 / 150; under 2% of members hit any daily cap; no unresolved velocity alert; projection drift 0.

 | 2 · A/B (6–8 weeks) | UI for the treatment arm; control sees nothing and earns nothing (shadow continues for comparison). | gam_experiment_pct (start 20, then 50), gam_streak_reminders, gam_fullscreen_celebrations | Primary metric improves and no guardrail fails (section 14). Needs enough volume: about 1,500 matches per arm to detect +15% on a 30% base rate. The private beta is likely too small, so wait for volume or treat the result as directional.

 | 3 · Ramp | 50% → 100%. | same | Guardrails hold for 2 weeks at each step.

 | 4 · Redemption | Catalog, lots, liability report. | gam_redemption | Legal sign-off; partner contracts; liability report reviewed.

## Delivery and test conventions from AGENTS.md and docs/testing.md

 - Each app keeps its own toolchain and lockfile; run commands from the app folder. Access changes go in apps/firebase/firestore.rules with a rules test.

 - Each change ships with a test in the layer that owns it: rules tests (apps/firebase/tests, yarn test); emulator-backed Functions tests (apps/firebase/functions/tests) for the engine, idempotency, caps, holds and clawbacks; mobile unit tests for pure helpers; component tests for toast, medal, ring and wallet, including reduced motion and the first frame; Playwright E2E for the wallet journey (Chromium + WebKit, 390 × 844 and 320 × 568, dark, pt-BR / es-ES). Coverage thresholds stay where they are.

 - UI from Ds* primitives and tokens only (comradia/no-raw-color, comradia/ds-scale), with the new-UI checklist in the PR, every string in all six dictionaries, and yarn test:all in apps/mobile.

 - Conventional commits with an app scope (feat(firebase): …, feat(mobile): …), PRs into develop. Deployments need the owner's yes. Report implemented, CI green, deployed and store-live as separate states.

 14 · Success metrics

## Targets against the control group

 | | Metric | Definition (from existing documents) | Target vs control

 | Primary: match → conversation rate | conversation.started pairs ÷ matches created in the window | +15% relative

 | Time to first message | Median from matches.createdAt to the first messages.createdAt | −25%

 | First message within 24 h | Share of matches | +10 pp

 | Weekly meaningful-active members | Members with a qualifying streak action in the week | +10%

 | 4-week retention | Active in week 4 after sign-up | +5 pp

 | Sustained conversations per active member | conversation.sustained per member per month | +10%

 | Guardrail: reports per 1,000 conversations | reports with context: chat | no more than +5%

 | Guardrail: like ratio | likes ÷ swipes in users/{uid}/swipes | no more than +5% (no spam-liking)

 | Guardrail: blocks per match, notification turn-offs, account deletions, moderator queue age | existing documents and push-token removal | no worse

## Event names (first party, PROPOSAL)

 gam_points_awarded · gam_points_clawed_back · gam_points_held · gam_toast_shown · gam_toast_merged · gam_fullscreen_shown · gam_fullscreen_suppressed · gam_achievement_unlocked · gam_achievement_lapsed · gam_achievement_regained · gam_level_up · gam_streak_week_completed · gam_streak_pause_used · gam_streak_rested · gam_streak_paused · gam_streak_reminder_sent · gam_streak_reminder_opened · gam_wallet_viewed · gam_quest_completed · gam_program_opted_out · gam_experiment_assigned

 Server events come from the ledger itself. The few view events (toast_shown, wallet_viewed) are written by the client to an owner-write, metrics-only path that never affects points. Daily aggregates go to gamMetrics/{day}.

## Consent

 - Keep the privacy policy's promise of no third-party analytics: measure first party, with no SDK.

 - Running the program: contract basis (art. 7 V). Experiment assignment and metrics: legitimate interest (art. 7 IX) with a documented balancing test and an opt-out ("Desativar Cravos" in Profile stops issuance, UI and reminders).

 - Never segment results by values, causes, union or "looking for": that processes sensitive data beyond the art. 11 consent (SENSITIVE_DATA_CONSENT_VERSION "2026-11-13").

 - Update both privacy-policy drafts (en and pt-BR) before phase 2 and get the lawyer's review; the drafts are still marked DRAFT.

 15 · Open decisions

## What the owner needs to choose

 | | Decision | Options | Recommendation

 | Points for moderation | Decided: none (owner decision, 25 Nov 2026) | Closed. Moderation stays outside the program.

 | Points name | Cravos · Faíscas · Rosas · Brasas · Cotas | Cravos.

 | Flag system | Remote Config · a Firestore config/flags doc | Remote Config for flags and percentage arms (free); Firestore only for the active rule-set pointer.

 | Admin surface | New apps/admin · Firebase console only | Console during shadow; apps/admin before the A/B phase, since the simulator and two-person publish need it.

 | Scheduled job | One weekly + nightly Cloud Scheduler job · lazy evaluation only | One job (inside the free tier). Needs the owner's yes because the architecture says no scheduled jobs.

 | Reward matches at all | 5 Cravos · 0 | Run both in shadow; keep 0 if the like ratio rises.

 | Public achievements on cards | Private · opt-in for non-sensitive ones | Private for the A/B; consider opt-in afterwards.

 | Utility perks (e.g. undo a pass) | Offer as a level perk · keep perks cosmetic | Cosmetic only until monetization is decided (RevenueCat is installed but unused).

 | Points for upheld reports | Yes · thank-you note only | Thank-you note only.

 | Raffles | Sorteios · drops | Drops first; raffles only after authorization.

 | Lot expiry | 6 · 12 · 24 months | 12 months.

 | Analytics | First party · Firebase Analytics | First party, which keeps the privacy-policy promise.

 16 · Limits of this plan

## What was read, what wasn't, what is unverified

## Read in the repo
README.md, AGENTS.md, docs/architecture.md, design-system.md, motion-design.md, motion-request.md, moderation.md, notifications.md, testing.md, qa/motion-audit.md, qa/private-beta-review.md, superpowers/plans/2026-11-13-private-beta.md, legal/privacy-policy.en.md; constants/design-system.ts, motion.ts, features/profile/profile-schema.ts, features/matches/MatchCelebration.tsx, localization/pt-BR.ts (keys), package.json, functions/src/index.ts, and the match list of firestore.rules. For the real screens: app/(tabs)/profile.tsx, matches.tsx, app/chat/[id].tsx, app/match/[id].tsx, DsNotice, DsCard, DsSheet, DsPillButton, DsMotionView, PushNotificationBridge.native.tsx and tests/atlas/*.

## Not read or not available

 - No business or audience document exists beyond the README, website and legal drafts.

 - No usage data: there is no analytics, and no production data was queried. Every frequency and target is an assumption to tune in shadow.

 - The full bodies of firestore.rules and account-cleanup.ts were only skimmed.

 - The Comradia Design System artifact was not opened; the repo token file was used instead.

 - Brazilian prize-promotion rules are cited from general knowledge and need counsel.

## Not verified

 - The screens are the web build only. Nothing was run on iOS or Android, so native shadows, safe areas, keyboard and haptics are unchecked.

 - The Cravos layer is HTML on top of the real DOM, not React Native code: it matches the tokens and primitive values, but it has not run through Reanimated or the component tests.

 - Frequencies, caps and targets are unvalidated assumptions.

 Plan only. No code changed, no tickets created, nothing deployed. The phones in section 2 are captures of the real web build; the Cravos layer on them is a design proposal, not shipped code.

---

## Appendix A: achievement catalog data (from the plan's section 7)

```js
const BADGES_A=[
    {id:'faisca',name:'Primeira faísca',desc:'Você e outra pessoa trocaram as primeiras mensagens de verdade.',crit:'Conversations started',tiers:[1,5,20],unit:'conversas iniciadas',kind:'Progress',src:'conversation.started'},
    {id:'papo',name:'Papo que rende',desc:'Uma conversa seguiu por dias. É assim que começa.',crit:'Sustained conversations',tiers:[1,5,15],unit:'conversas que renderam',kind:'Progress',src:'conversation.sustained'},
    {id:'passo',name:'Primeiro passo',desc:'Você mandou a primeira mensagem em até 24 h depois do match.',crit:'First message ≤ 24 h after match',tiers:[3,10,30],unit:'primeiras mensagens',kind:'Progress',src:'message.first_in_match'},
    {id:'vacuo',name:'Sem vácuo',desc:'Você responde as pessoas no mesmo dia.',crit:'Timely replies',tiers:[10,50,200],unit:'respostas no dia',kind:'Progress',src:'message.timely_reply'},
    {id:'constancia',name:'Constância',desc:'Semana após semana, você aparece.',crit:'Weekly streak length',tiers:[4,12,26],unit:'semanas seguidas',kind:'Streak',src:'streak.milestone'},
    {id:'cartao',name:'Cartão em dia',desc:'Sua resposta continua com a sua cara.',crit:'Prompt answer refreshed',tiers:[1,3,6],unit:'respostas atualizadas',kind:'Progress',src:'profile.prompt_refreshed'},
    {id:'roda',name:'Em roda',desc:'Ativa: você esteve presente em 3 das últimas 4 semanas.',crit:'Active 3 of last 4 weeks (rolling)',tiers:[1,3,6],unit:'meses mantendo a roda',kind:'Active · can lapse',src:'streak.week_qualified'},
    {id:'escuta',name:'Escuta atenta',desc:'Ativa: respondeu 80% das mensagens em até 24 h nos últimos 30 dias.',crit:'≥ 80% replies ≤ 24 h, last 30 days, min. conversations',tiers:[5,10,20],unit:'conversas no período',kind:'Active · can lapse',src:'message.timely_reply'},
    {id:'primavera',name:'Primavera vermelha',desc:'Temporada de primavera: conversas novas entre 22 set e 21 dez.',crit:'Conversations started in season (22 Sep – 21 Dec)',tiers:[3,6,12],unit:'conversas na temporada',kind:'Seasonal',src:'campaign: spring_2026'},
    {id:'maio',name:'1º de Maio',desc:'Campanha do Dia do Trabalhador: conversas valem o dobro na semana.',crit:'Conversations started 24 Apr – 1 May (×2 campaign)',tiers:[2,4,8],unit:'conversas na semana',kind:'Campaign',src:'campaign: may_day'},
    {id:'namorados',name:'Dia dos Namorados',desc:'Uma conversa que rendeu na semana de 12 de junho.',crit:'Sustained conversations 5 – 12 Jun',tiers:[1,2,3],unit:'conversas que renderam',kind:'Seasonal',src:'campaign: namorados'},
  ];
```

## Appendix B: earning actions data (from the plan's admin editor)

```js
const ACTIONS={
    'conversation.started':{label:'Conversa iniciada',copy:'Conversa iniciada com Maya',eng:5,cas:1,val:30,day:3,src:'NEW · derived from matches/{a_b}/messages'},
    'conversation.sustained':{label:'Conversa que rendeu',copy:'Conversa com Maya está rendendo',eng:2,cas:0,val:40,day:1,src:'NEW · derived'},
    'message.first_in_match':{label:'Primeira mensagem ≤ 24 h',copy:'Primeiro passo com Lucas',eng:8,cas:1,val:10,day:5,src:'NEW · derived from messages create'},
    'message.timely_reply':{label:'Resposta no mesmo dia',copy:'Resposta no mesmo dia',eng:18,cas:4,val:5,day:6,src:'NEW · derived'},
    'match.created':{label:'Match',copy:'Novo match com Lucas',eng:12,cas:3,val:5,day:3,src:'existing · matches/{a_b} create'},
    'profile.prompt_refreshed':{label:'Resposta atualizada',copy:'Cartão em dia',eng:1,cas:0.3,val:10,day:1,src:'NEW · trigger on profiles/{uid}'},
  };
```
