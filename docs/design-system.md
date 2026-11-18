# Comradia design system

The single source of truth for how Comradia looks and behaves. **All new UI is built from this document and the `Ds*` primitives.** If something you need is not here, extend the system first (see [Changing the system](#changing-the-system)), then build the screen.

- Live specimen, every token and primitive in light and dark: [`design-system-specimen.html`](design-system-specimen.html) (generated from the code; open it in a browser).
- Tokens (code): [`apps/mobile/constants/design-system.ts`](../apps/mobile/constants/design-system.ts), [`motion.ts`](../apps/mobile/constants/motion.ts), [`ds-content-width.ts`](../apps/mobile/constants/ds-content-width.ts).
- Primitives (code): [`apps/mobile/components/ds/`](../apps/mobile/components/ds).
- Motion detail: [`motion-design.md`](motion-design.md). Testing: [`testing.md`](testing.md). Languages: [`localization.md`](localization.md).

Scope: the mobile app (`apps/mobile`: iOS, Android and the web export) and the landing page (`apps/website`, [see its section](#website)). The Firebase app has no UI.

## The ten rules

1. Colors come from `getDsTheme(scheme).color`. Never a hex, `rgb()` or named color. (`comradia/no-raw-color` enforces this.)
2. Text styles come from `DsTypography`. Never a bare `<Text>`: it falls back to the system font.
3. Spacing from `DsSpace`, corners from `DsRadius`, strokes from `DsBorder`, sizes from `DsLayout` and `DsIconSize`. If the value you need is not on a scale, change the scale, not the screen. (`comradia/ds-scale` enforces this, and literal font sizes, weights and families are rejected too.)
4. Use a `Ds*` primitive when one exists. Do not restyle a `Pressable` into a button.
5. Every screen works in **light and dark**, on a **320 pt wide phone**, and on **web at 768 and 1024+**.
6. Every control is at least **44 × 44 pt** to touch, has a role and an accessible name, and shows its state without relying on color alone.
7. Every user-visible string, including accessibility labels, goes through `t()` and fits the longest of the six languages (German and French run about 30% longer than English).
8. Motion is short, ease-out, and respects Reduce Motion. No springs, no bounce.
9. Every interactive element has a `testID`, and the change ships with a test in the layer that owns it ([`testing.md`](testing.md)).
10. Anything off-system needs this document updated in the same change.

## Principles

- **Warm, plain, human.** Comradia is for people who want to meet people who share their values. The UI is soft cream and crimson, generous with space, and never loud. No dark patterns, no gamified pressure.
- **One thing at a time.** One headline, one primary action per screen. The primary action is the dark pill; crimson marks selection and emphasis.
- **Content over chrome.** Surfaces are flat: color separates them, not heavy borders or shadows.
- **Safe by default.** Safety actions (report, block, unblock) are always reachable and never styled as decoration.
- **Inclusive by construction.** Contrast, touch targets, screen readers, reduced motion, text scaling and six languages are requirements, not polish.

## Foundations

### Theme and color scheme

There are two schemes, `light` and `dark`, with exactly the same token keys (a unit test enforces parity). Screens follow the device setting:

```tsx
const colorScheme = useColorScheme();
const scheme = colorScheme === 'dark' ? 'dark' : 'light';
const ds = getDsTheme(scheme);
```

Every primitive takes a `scheme` prop; pass the same value down. There is no theme context, so a screen that forgets `scheme` mixes light and dark.

### Color

Colors are semantic roles. Pick the role by meaning, not by how the value looks.

| Role | Tokens | Use |
| --- | --- | --- |
| Canvas | `canvas` | Screen background. |
| Surface | `surface`, `surfaceElevated`, `surfaceMuted`, `surfaceWarning`, `shell` | Cards and sheets (`surface`, `surfaceElevated`); quiet fills such as skeleton bars, secondary buttons (`surfaceMuted`); attention card (`surfaceWarning`); translucent bar behind content (`shell`). |
| Text | `textPrimary`, `textSecondary`, `textTertiary`, `readOnlyText` | Headings and body; supporting copy; hints, placeholders and counters (never for essential text); read-only values. |
| On-fill text | `onActionPrimary`, `onAccent` | Label on the primary button; label on an accent fill (selected chip). |
| Action | `actionPrimary` | The main call to action (near-black in light, cream in dark). |
| Accent | `accentPrimary` (+ `Hover`, `Soft`), `accentText`, `accentWarm` (+ `Soft`), `accentCyan` (+ `Soft`) | Brand crimson. `accentPrimary` is for **fills, borders and icons shapes** (selection, progress, dots); `accentText` is for **text and icons that carry meaning** on canvas, surface and soft fills (links, tab highlight, selected label). Soft = tinted background of an accent. Warm and cyan are secondary accents for illustration and rare highlights. |
| Status | `success`, `warning`, `danger` (+ `Soft`, `dangerBorder`) | Confirmation, offline and caution, errors and destructive actions. |
| Lines | `border`, `borderStrong` | Hairlines and dividers; field outlines and outline buttons. |
| Focus | `focusRing` | Keyboard focus ring on web. |
| Disabled | `disabledSurface`, `disabledText`, `disabledBorder` | Controls that cannot be used now. |
| Overlay | `overlayNeutral`, `overlaySoft`, `overlayStrong` | Scrims behind sheets and modals. |
| Switch | `switchThumb` | Thumb of the switch. |

Fixed palettes that do **not** change with the scheme live beside the theme and are the only literals the app may use:

- `DsCategoryColor` (forest, brick, crimson, wine, coral): one hue per vibe, used as `` `${accent}22` `` tints and selected borders.
- `DsArt`: the welcome illustrations (sun and faces, including skin tones).

**Brand colors.** Light: crimson `#D92D3A`, ink `#231214`, cream `#FBF6F4`. Dark: coral `#E05A47` on `#181112`. The accent is for emphasis, never for large flat areas, and never as the primary button.

**Contrast (enforced by tests).** WCAG AA needs 4.5:1 for normal text and 3:1 for large text and UI shapes. `design-system.test.ts` checks every pair below in both themes, compositing translucent fills over their underlay as the screen does.

| Pair | Minimum | Light | Dark |
| --- | --- | --- | --- |
| `textPrimary` / `textSecondary` / `textTertiary` on `canvas`, `surface`, `surfaceMuted` | 4.5 | 4.5 to 18.0 | 5.0 to 17.4 |
| `accentText` on `canvas`, `surface`, `surfaceMuted`, `accentPrimarySoft` | 4.5 | 5.4 to 6.4 | 5.4 to 7.1 |
| `onAccent` on `accentPrimary` | 4.5 | 4.79 | 5.07 |
| `onActionPrimary` on `actionPrimary` | 4.5 | 18.0 | 17.4 |
| `danger` on `canvas`, `surface`, `dangerSoft` | 4.5 | 4.9 to 5.8 | 5.3 to 6.7 |
| `warning` on `warningSoft`; `success` on `successSoft` and `canvas` | 4.5 | pass | pass |
| `accentPrimary` on `canvas` and `surface` (fills, borders, icons) | 3 | 4.47 to 4.79 | 4.7 to 5.1 |
| `focusRing` on `canvas` and `surface` | 3 | 5.0 to 5.3 | 10.0 to 10.7 |

Add a row to `TEXT_PAIRS` in the test when you add a pair.

**Do**

- `backgroundColor: ds.color.surface`, `color: ds.color.textPrimary`.
- Accent text and icons: `ds.color.accentText`. Accent fills, borders and dots: `ds.color.accentPrimary`.
- Tint an accent with the alpha suffix on a token value: `` `${accent}22` ``.
- Put a new fixed color in `DsCategoryColor` or `DsArt` (with a test), or add a scheme-aware token.

**Don't**

- `color: '#fff'`, `'rgba(0,0,0,.5)'`, `'white'`: use `onAccent`, `overlayNeutral` and friends.
- `accentPrimary` as the color of text: it is a fill color. Use `accentText`.
- Convey state by color only: pair it with text, an icon, a border change or a role (chips and cards do).

### Typography

One family: **Geist** (400, 500, 700) and **Geist Mono** (500), loaded in `app/_layout.tsx` (the app waits for the fonts). Only these weights exist (`DsFontFamily`: `body`, `medium`, `bold`, `mono`); there is no semibold. Literal `fontSize`, `lineHeight`, `fontWeight` and `fontFamily` are lint errors: spread a style. Use a `DsTypography` style and override only the color:

```tsx
<Text style={[DsTypography.body, { color: ds.color.textSecondary }]}>…</Text>
```

| Style | Size / line | Family | Use |
| --- | --- | --- | --- |
| `hero` | 40 / 44, −1.5 tracking | Bold | The one large moment on a screen (welcome headline, match celebration). |
| `display` | 30 / 34, −1 tracking | Bold | Onboarding and auth headlines. |
| `heading` | 20 / 26 | Bold | Section and sheet headings. |
| `title` | 24 / 30 | Bold | Screen title in a tab (one per screen, `accessibilityRole="header"`). |
| `screenTitle` | 16 / 22 | Bold | Top-bar title. |
| `cardTitle` | 16 / 22 | Bold | Card and row titles. |
| `bodyLarge` | 16 / 24 | Regular | Longer reading text: chat messages, profile answers. |
| `body` | 14 / 20 | Regular | Default reading text. |
| `input` | 15 / 20 | Regular | Text typed into a field. Not smaller than this. |
| `button` | 14 / 20 | Medium | Button labels. |
| `label` | 13 / 18 | Bold | Bold label of a selectable card or a field. |
| `chip` | 13 / 18 | Medium | Chip, tag and banner text. |
| `caption` | 12 / 16, tabular | Regular | Metadata, helper and error text, banners. |
| `eyebrow` | 10.5 / 14, mono, uppercase, +0.8 | Mono | Step counters and kickers. |
| `micro` | 11 / 14, tabular | Medium | Badges and tiny counters. |
| `figure` | 32 / 38, tabular | Bold | Big numbers. |

Rules: sentence case everywhere (the `eyebrow` style uppercases by itself); one `title` or `display` per screen; line length under about 70 characters on wide web; honor system text scaling (do not set `allowFontScaling={false}`; give containers `minHeight`, never a fixed `height`, so scaled text can grow); numbers that change or align use the tabular styles.

### Spacing

`DsSpace`: `xxs` 4, `xs` 8, `sm` 12, `md` 16, `lg` 20, `xl` 24, `xxl` 32. Use it for padding, gaps and margins. Rhythm: 8 between related items, 16 between groups, 24 to 32 between sections. A `gap` is better than margins on children.

Screen gutter (`DsLayout.screenGutter`) is 22 on phones (the one value off the `DsSpace` scale, because it is a layout constant). Off-scale spacing is a lint error.

### Radius

`DsRadius`: `sm` 12 (inputs, banners, skeleton bars, small tiles), `lg` 16 (cards, fields, sheets on desktop), `xxl` 20 (large selectable cards, sheet top corners on phones), `pill` 9999 (buttons, chips, switch tracks, avatars, dots: always a full capsule or circle). Nest radii so an inner corner is never larger than the outer one minus the padding.

### Borders

`DsBorder`: `hairline` 1 (cards on canvas, dividers, fields), `strong` 1.5 (selectable controls: chips, option cards, outline buttons), `focus` 3 (web focus ring, drawn by `app/+html.tsx`).

### Layout

- **Phones (< 768)**: content is full width inside the 22 pt gutter; never capped.
- **Tablet and desktop web**: `DsScreen` caps the content width through `contentWidth` (`resolveDsContentLayout`):

| `contentWidth` | 768–1023 | ≥ 1024 | Use |
| --- | --- | --- | --- |
| `form` | 600 | 600 | Sign-in and short forms. |
| `content` (default) | 680 | 880 | Reading and lists. |
| `wide` | 680 | 1040 | Grids and the deck. |
| `workspace` | 680 | 1360 left-aligned, 28 padding | Multi-column work areas. |
| `full` | none | none | Edge-to-edge (media). |

- **Breakpoints**: `DsLayout.breakpointTablet` 768 and `breakpointDesktop` 1024. Bottom sheets become centered dialogs from 768 (`useDsModalSheetLayout`: max 560 wide, 85% tall).
- **Safe areas**: `DsScreen` handles the top inset (`withTopInset`, default on); screens that dock a footer add `insets.bottom`. Never place a control under the home indicator or notch.
- **Keyboard**: screens with text fields use `<DsScreen keyboardAware>` and `keyboardDismissMode="on-drag"`; sheets lift themselves with `useDsKeyboardOverlap`. Keep the primary action reachable while the keyboard is open.
- **Small phones**: test at 320 × 568; nothing may clip or overlap, and long text wraps.

### Elevation

Surfaces are flat. `DsShadow.none` and `soft` (empty by design) for normal cards, `floating` (`elevation` 6) for floating panels and toasts, `thumb` for the switch knob. Separate cards from canvas with `surface` vs `canvas`, not a shadow or heavy border.

### Iconography and imagery

- Icons: **MaterialIcons** from `@expo/vector-icons`, at `DsIconSize` 18 / 20 / 24 (24 in the tab bar). Color from tokens (`textPrimary` by default, `accentPrimary` for emphasis). Decorative icons get `aria-hidden`.
- Emoji are used as friendly category and country markers (vibes, values, `🇧🇷`). They are decoration: hide them from the spoken label.
- Portraits: `ProfilePhoto` (arch or circle). With no image it shows the person's initial on `accentPrimarySoft`. Each profile has one optional portrait (framed 3:4).
- Art: the sun, topo rings and face stack on the welcome screen use `DsArt`. Soft background blobs use `DsBlobBackground` (opt in with `withBlobs`).
- Brand: `assets/images/logo.svg`, `comradia-mark.svg`; the lockup is `components/ui/brand-lockup.tsx`.

### Motion

Source of truth: `DS_MOTION` in `constants/motion.ts` and [`motion-design.md`](motion-design.md).

- Durations: `fast` 120 ms (press feedback), `standard` 220 ms (content and state changes), `slow` 360 ms (large transitions). Easing: ease-out cubic `[0.16, 1, 0.3, 1]`. No springs or bounce.
- One visual lead at a time. Stagger only the items of one small group. Do not reveal every section of every screen.
- Entrances use `DsMotionView` (`reveal`, `scale`, `slide`); the first frame stays visible, so paused or reduced-motion renders never hide content.
- Press feedback uses `DsMotionPressable` (scale 0.95–0.985, a 6% opacity dip).
- Reduce Motion (`useReducedMotion`): no scale, slide or loop; show the end state at once. The skeleton does not pulse.
- Never animate layout properties of long lists, and never gate content or an action behind an animation.

## Components

All primitives live in `apps/mobile/components/ds/primitives` (motion in `components/ds/motion`), take `scheme` and `testID`, use tokens only, honor Reduce Motion, and are drawn in the [specimen](design-system-specimen.html). Their copy is passed in by the caller (already localized), so a primitive has no i18n dependency.

| Component | What it is | Notes |
| --- | --- | --- |
| `DsScreen` | Page shell: canvas background, safe area, scroll, content width, optional blobs and keyboard handling. | Props: `scrollable` (default true), `withTopInset`, `contentWidth`, `withBlobs`, `keyboardAware`, plus `ScrollView` props. Every screen starts here. |
| `DsPillButton` | The button. | `variant`: `primary` (dark action), `secondary` (muted fill), `outline`, `ghost`. `size`: `md` 46 high, `sm` and `xs` 44. Props: `label`, `onPress`, `loading`, `disabled`, `selected`, `leftIcon`, `rightIcon`, `fullWidth` (default true), `contentColor`, `accessibilityLabel`. `loading` shows a spinner, sets `busy`, disables presses. Pass `contentColor={ds.color.onAccent}` on an accent-filled button. |
| `DsIconButton` | Round icon-only button, 42 pt (+1 hit slop). | `accessibilityLabel` required. |
| `DsBackButton` | Round back arrow, 36 pt (+4 hit slop = 44). | Pushed screens; localized label. |
| `DsCard` | Rounded surface with `DsSpace.lg` padding. | `variant`: `default`, `muted`, `warning`. Not a button. |
| `DsChip` | Pill chip with optional emoji. | `selected`, `disabled`, `role` `checkbox` (multi, default) or `radio` (single). Selected = accent fill + `onAccent` label. Min height 44. |
| `DsSwitch` | 44 × 26 switch. | `value`, `onValueChange`, optional `label` (then the whole row is the 44 pt target and the label is the name), `disabled`. Own implementation: RN Web paints the native thumb teal. |
| `DsSelectCard` | Selectable card: tinted emoji tile, label, description. | `radio`; `accent` tints the tile and the selected border; `disabled`. |
| `DsTextField` | Text field with label, helper or error, prefix and suffix. | States: default, focused, filled, error, disabled, read-only. The row draws the focus border; an error replaces the helper, shows an icon and is announced as an alert. Row 52 high, `input` text. Props pass through to `TextInput` (`keyboardType`, `autoComplete`, ...). |
| `DsStepProgress` | Segmented bar with "Step n of N" text and optional back button. | `step`, `total`, `label` (localized text, the spoken progress); the bar is decorative. |
| `DsSheet` | Bottom sheet on phones, centered dialog from 768. | `visible`, `onClose`, `title`, `closeLabel`, `footer`. Closes by the visible button, a scrim tap, Android back or Escape. `accessibilityViewIsModal`; focus moves in and returns. |
| `DsNotice` | Card notice: tone, title, optional body, actions. | `tone` `info` / `success` / `warning` / `danger`; `urgency` `alert` or `status`; `overlay` adds the floating shadow; auto-dismisses only when it has no actions, never under 5 s. |
| `DsEmptyState` | `DsCard` with a title, one warm line and an optional single action. | The empty state of every list (Matches, Discover, Blocked). |
| `DsListRow` | Row: leading avatar, title, subtitle, trailing meta, chevron, unread dot. | One button with a combined spoken name (unread, title, subtitle). Min 64 high, optional inset divider. |
| `DsAvatar` | Portrait or circle with an initial fallback. | `shape` `arch` or `circle`; `size` 32 / 40 / 56 / 96; `loading`, `presence`; hidden from assistive tech unless it has a label. |
| `DsSectionHeader` | Label with an optional trailing action. | `variant` `eyebrow` or `screenTitle`; `header` role. |
| `DsDivider` | 1 pt line. | `onMuted` for `surfaceMuted` backgrounds; `inset` to start at the text of a row. |
| `DsSkeletonCard` | Card-shaped loading placeholder, pulses unless Reduce Motion. | Requires a localized `label`; `progressbar` role. |
| `DsOfflineBanner` | Warning strip with a cloud-off icon. | `role="alert"`; show it at the top while offline. |
| `DsBlobBackground` | Two soft blobs behind a screen. | Via `DsScreen withBlobs`; decorative. |
| `DsMotionView`, `DsMotionPressable` | Entrance and press motion. | See [Motion](#motion). |
| `useDsKeyboard*`, `useDsModalSheetLayout` | Keyboard-aware scroll, sheet lift, desktop dialog layout. | Use them instead of ad-hoc keyboard code. |

Feature components that compose these (`ProfilePhoto` over `DsAvatar` with the photo URL and a localized label, `ForegroundNotification` over `DsNotice`, `PhoneField` over `DsTextField`, `OnboardingScreen` over `DsStepProgress`) add only i18n and data; do not restyle them there.

**Buttons: which one.** One `primary` per screen, docked at the bottom or under the form. A second, less important action is `outline` or `ghost`. A destructive action is `outline` with `danger` content and a confirmation. A selectable pill uses `selected`. Disabled uses the disabled tokens and keeps its label. Do not change a button's label while `loading`.

**Need something that is not here?** Add it to the system first, see [Changing the system](#changing-the-system).

## Patterns

### Screen anatomy

```
DsScreen (canvas, safe area, content width)
  ├─ [DsOfflineBanner]                      when offline
  ├─ header row: [DsBackButton] + title      title uses accessibilityRole="header"
  ├─ content (cards, lists, fields)          gaps from DsSpace
  └─ footer: primary DsPillButton            docked above the bottom inset
```

- **Tab screens** (`Discover`, `Matches`, `Profile`): `title` + `body` subtitle in `textSecondary`, then content. The tab bar is `surface` with a `border` top line, active `accentText`, inactive `textTertiary`, 24 pt MaterialIcons and localized titles. Tabs fade in 220 ms (instant with Reduce Motion).
- **Onboarding steps**: `OnboardingScreen` (over `DsStepProgress`): gutter 22, progress row, `display` title, `body` lede, content, CTA docked at the bottom, `keyboardAware`.
- **Pushed screens** (chat, match, blocked): `DsBackButton` top left; the title is a header.
- **Modals**: the match celebration and sheets use the overlay tokens; closable by a visible control.

### States

Every data screen defines all five:

| State | Pattern |
| --- | --- |
| Loading | `DsSkeletonCard`s in the shape of the content; a spinner only inside a button (`loading`). |
| Empty | `DsEmptyState`: what is empty, why in one line, and one action. Warm, never blaming. |
| Error | Say what happened and the next step, with a retry `DsPillButton`. Field errors are inline under the field (`caption`, `danger`, plus an icon). Use `role="alert"`. See `session-error-view.tsx`. |
| Offline | `DsOfflineBanner` at the top; keep cached content visible. |
| Partial or paged | Load more on scroll; a skeleton row at the end; never block the list. |

### Forms

- One question per screen where possible (onboarding). Validate on blur and on submit, never on every keystroke.
- Label above the field; helper text below; the error replaces the helper in the same place.
- The primary action stays enabled unless the form is invalid *and* the reason is visible; show a reason, not a silent disabled button.
- Keep the keyboard type, `autoComplete` and `textContentType` right for each field. Phone is Brazil-only today (`🇧🇷 +55` prefix).

### Lists and cards

Cards use `DsCard` on `canvas`; rows inside a card are `DsListRow`s separated by `DsDivider`, not extra cards. A tappable card has a pressed state (`DsMotionPressable`) and a combined accessible name.

### Safety and destructive actions

Report, block and unblock are never hidden behind an icon without a label. Destructive actions are `outline` with `danger` content, ask for confirmation, and say what will happen ("They won't see you or be able to message you").

## Accessibility

Requirements for every screen (verify with the accessibility tree in the E2E web suite):

- **Roles and names.** Buttons are `button`; chips `checkbox` or `radio`; switches `switch`; titles `header`; images `image` with a localized name; loading `progressbar`; errors `alert`. Icon-only buttons need `accessibilityLabel`.
- **State.** Expose `selected`, `checked`, `disabled`, `busy` through `accessibilityState` (and `aria-checked` on web).
- **Touch targets.** At least 44 × 44. Small visuals reach it with `hitSlop` (the back and icon buttons do) or `minHeight`. Keep 8 pt between adjacent targets.
- **Contrast.** See [the table](#color). Text on images needs a scrim.
- **Focus (web).** Visible 3 pt `focusRing` outline with 3 pt offset on `:focus-visible` (global, from `app/+html.tsx`); composite controls (`DsTextField`, the code field) show focus as the accent border (`DsBorder.strong`) on the whole control instead of the outline. Tab order follows reading order; no keyboard traps; Escape closes sheets.
- **Motion.** Reduce Motion respected everywhere; nothing flashes more than three times per second.
- **Text scaling.** Layouts survive 200% system font size: wrap, `minHeight`, no clipping.
- **Not color alone.** Selection also changes border or fill shape and exposes state; errors have text and an icon.
- **Decoration.** Emoji, illustrations and blobs are hidden from assistive tech (`aria-hidden`, `importantForAccessibility="no-hide-descendants"`).

## Language and content

- All copy lives in `apps/mobile/localization/*.ts` and is read with `t('key')`. Add the key to **all six** dictionaries (`en-US`, `pt-BR`, `es-ES`, `fr-FR`, `de-DE`, `it-IT`); a test checks parity and placeholders.
- Never concatenate sentences; use interpolation (`t('onboarding.progress', { current, total })`) so word order can change.
- Accessibility labels are copy too: translate them.
- Design for expansion: German and French strings run long. Allow two lines for labels, use `flex` and wrapping, and test 320 pt wide in a long language.
- Voice: warm, direct, plain words, sentence case, no jargon, no exclamation pressure. Say what happened and what to do. Names of people are user content and are not translated.
- Dates, numbers and ages follow the active locale; never hard-code a format.

## Web specifics

The same code exports to the web (`expo export --platform web`).

- Cursor pointer on interactive roles and a 3% brightness dip on hover (global, `app/+html.tsx`); no layout shift on hover.
- Cap content with `DsScreen contentWidth`; for screens not built on `DsScreen`, use `resolveWebWidthCap`.
- Native `Switch` and `Modal` look different on web; prefer the DS versions.
- Inputs inside a custom row set `outlineWidth: 0` and let the row show the focus border.
- Test in Chromium and WebKit at 390 × 844 and 320 × 568, in dark mode, and in two languages (the Playwright suite does).

## Website

`apps/website` is a static landing page (plain HTML, CSS and JS, no build). It is the same brand, expressed in CSS:

- **Tokens mirror the app.** The `:root` variables in `styles.css` copy `design-system.ts` (`--canvas`, `--surface`, `--text-primary`, `--text-secondary`, `--text-tertiary`, `--accent`, `--accent-text`, `--accent-hover`, `--on-accent`, `--action`, `--on-action`, `--border`, `--border-strong`, `--focus-ring`). Change a value in the app first, then here. The dark scheme follows `prefers-color-scheme`.
- **Geist is self-hosted** in `apps/website/fonts/` (SIL OFL license included), so the page makes no third-party requests. Weights 400, 500, 700.
- The header link uses `--radius-pill` and `--action`.
- `--accent` is for fills and borders. The eyebrow and early-access note use `--accent-text`, as in the app.
- Same rules: visible focus ring, 44 pt-class touch targets, text contrast, no motion beyond a state change, works at 320 px.

## Changing the system

1. **Need a value** (color, size, text style)? Add it to `constants/design-system.ts` in both schemes, with a name that says its role (not its color). Extend `design-system.test.ts` (key parity, valid color, contrast if it is text or UI).
2. **Need a component?** Check the [component table](#components) first. If it is missing, build it in `components/ds/primitives` (take `scheme` and `testID`, caller passes localized text, use only tokens), add a component test in `apps/mobile/tests/component/`, add it to the specimen generator, and update the table. If a feature component is needed by a second feature, promote it the same way.
3. **Regenerate the specimen**: from `apps/mobile` run `yarn ds:specimen`. A unit test fails when the committed page is out of date.
4. **Website**: mirror new color or type tokens in `apps/website/styles.css`.
5. **Do not** edit the specimen by hand, add a UI library, or add a second way of doing something the system already does.

## New-UI checklist

Copy into the PR description for any screen or component change.

- [ ] Built on `DsScreen` and `Ds*` primitives; no re-skinned `Pressable` where a primitive fits.
- [ ] Lint passes (no raw colors, spacing, radius, borders or text metrics off the scales); no bare `<Text>`; accent text uses `accentText`.
- [ ] Looks right in **light and dark** and at **320 pt** and **768 / 1024+** on web.
- [ ] One primary action; hierarchy is clear without color.
- [ ] Loading, empty, error and offline states exist.
- [ ] Touch targets ≥ 44; roles, names and states set; icon-only buttons labeled; decoration hidden.
- [ ] Focus ring visible on web; keyboard order sane.
- [ ] Motion uses `DS_MOTION`, ease-out, honors Reduce Motion.
- [ ] Every string through `t()` in all six languages; long strings wrap.
- [ ] `testID` on interactive elements; component test (and E2E when a journey changes); coverage thresholds untouched.
- [ ] If anything off-system was needed: this document, the tokens, and the specimen are updated in the same change.

## Enforcement

- **Lint** (errors in `app/`, `features/` and `components/`; run `yarn lint`): `comradia/no-raw-color` flags hex, the CSS color functions (`rgb()`, `hsl()`, `oklch()`, `color-mix()` and the rest) in strings and templates, and a string that is exactly a named color (`'white'`). `transparent` is allowed. A literal like `'Order #123'` reads as a hex and needs the disable comment. `comradia/ds-scale` flags spacing off the `DsSpace` scale (0, 4, 8, 12, 16, 20, 24, 32), radius not in `DsRadius`, border widths not in `DsBorder`, and any literal `fontSize`, `lineHeight`, `letterSpacing`, `fontWeight` or `fontFamily`. Computed values and token references are not flagged. A justified exception needs `// eslint-disable-next-line comradia/ds-scale -- <reason>` (or `no-raw-color`); artwork geometry is the usual one.
- **Tests**: `design-system.test.ts` (token parity, valid values, contrast of every allowed pair, scales), `specimen.test.ts` (the specimen matches the tokens), `no-raw-color.test.ts` and `ds-scale.test.ts` (the rules; the scale rule's allowed lists must equal the tokens), `native-colors-config.test.ts` (splash, adaptive icon and notification colors come from the tokens), plus a component test per primitive.
- **Review**: component choice, hierarchy, states and copy are checked in review with the checklist above; the lint rules guard the values.
- **Agents**: `AGENTS.md` requires every AI agent to follow this document for any new UI.

## Known limits

Honest list of what the system does not cover yet.

- **Not every screen input is a `DsTextField`.** `PhoneField` composes it; `CodeField` (six boxes over one transparent input) and the name and birthday inputs in `vibe.tsx` use the same tokens but keep their own structure because tests and behavior depend on it. Move them over when you next change them.
- **`DsListRow` is not adopted yet.** `MatchRow` and `BlockedRow` are cards with inner buttons and chips; they keep their structure until the list design changes. A read or unread row differs by the accent dot and the spoken "unread", not by weight (every `cardTitle` is bold).
- **Field text size on iOS Safari (web).** Browsers zoom the page when an input under 16 px takes focus, and `input` is 15. Check on a real device before changing it.
- **Strokes without a token.** The active box of the code field and the ring around the welcome face stack use `DsBorder.strong` (1.5); a 2 px stroke would need a new `DsBorder` value.
- **Escape on web** closes `DsSheet` through `Modal`'s `onRequestClose`; it is tested at the callback level, not in a browser.
- **Native splash and adaptive icon colors** are set from the tokens in `app.config.ts`; the splash image and the Android adaptive-icon background image are artwork and are not recolored.
- **Website** has no component tests; check it in a browser in both schemes after changing `styles.css`.
