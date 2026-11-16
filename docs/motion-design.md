# Motion design

Motion should make Comradia easier to follow and more satisfying to use. Keep the
story focused: one visual lead at a time, short state changes, and transitions
that carry a person from one step to the next. The direction takes cues from
[Barty-Bart's motion-graphics skills](https://github.com/Barty-Bart/motion-graphics)
— especially a single element moving through a workflow and each important stop
reacting — and adapts those ideas to native and web UI. The video rendering
toolchain is not part of the app.

## Shared timing

`DS_MOTION` in `apps/mobile/constants/motion.ts` is the shared source for timing
and easing:

| Token      | Duration | Use                                       |
| ---------- | -------: | ----------------------------------------- |
| `fast`     |   120 ms | Press feedback and small acknowledgements |
| `standard` |   220 ms | Content and state transitions             |
| `slow`     |   360 ms | Larger transitions                        |

Use the shared cubic ease-out curve `[0.16, 1, 0.3, 1]`. Do not use spring or
elastic bounce for these controls.

## `DsMotionView`

Import `DsMotionView` from `@/components/ds/motion/DsMotionView`:

```tsx
<DsMotionView delay={45} testID="profile-summary" variant="slide">
  <ProfileSummary />
</DsMotionView>
```

| Prop       | Default  | Behavior                                                                                |
| ---------- | -------- | --------------------------------------------------------------------------------------- |
| `children` | Required | Rendered immediately, including before and during entrance motion                       |
| `variant`  | `reveal` | `reveal`: gentle vertical drift; `scale`: slight scale; `slide`: short horizontal drift |
| `delay`    | `0`      | Optional stagger offset in milliseconds                                                 |
| `style`    | —        | Style for the animated wrapper                                                          |
| `testID`   | —        | ID on the wrapper                                                                       |

The opening frame remains visible at partial opacity, so a paused animation or a
headless render never hides content. Use delays only for related items in one
small group; do not apply the same reveal to every screen section. Reanimated's
`useReducedMotion` bypasses entrances when the system setting is enabled. In
Reanimated 4 this hook reads the system preference at app startup, so a setting
changed while the app is running takes effect on the next launch.

## Press feedback and selection

`DsMotionPressable` is the shared pressable wrapper used by common controls. It
keeps the original Pressable target and forwards accessibility and event props.
Press in and release use 120 ms ease-out timing, with a small scale and opacity
change. Disabled controls do not start feedback, and an active press is reset if
the control becomes disabled, reduced motion becomes active, or it unmounts.
Reduced-motion users get no scale or opacity transition.

`DsPillButton` also accepts `selected` for selectable pills. When a caller
provides it, the button exposes the selected state to assistive technology and
uses the scheme's accent surface and border. Ordinary action buttons keep no
selection state. `DsBackButton` and the default `DsIconButton` keep their
existing visual dimensions; their hit slop preserves a 44-point target while
the feedback scales the pressed visual.

## Coverage

| Surface                                                     | Motion behavior                                             | Reduced motion / lifecycle                                                                                 |
| ----------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `DsMotionView`                                              | Short reveal, scale, or slide entrance; optional item delay | Content stays visible; entrance is skipped; active timing is cancelled on unmount                          |
| `DsMotionPressable`                                         | Fast scale and opacity press/release feedback               | Feedback is skipped; pressed value resets on disable, preference change, and unmount                       |
| `DsPillButton`                                              | Shared press feedback and selected visual state             | Selected state remains static; disabled/loading state keeps its existing label and behavior                |
| `DsIconButton`                                              | Shared press feedback; 1-point hit slop                     | Press motion is skipped                                                                                    |
| `DsBackButton`                                              | Shared press feedback; 4-point hit slop                     | Press motion is skipped                                                                                    |
| Welcome `SunBurst`                                          | One 2.88-second ease-out ray turn                           | No turn under reduced motion; the finite animation is cancelled on unmount                                 |
| `DsSkeletonCard`                                            | Existing loading pulse                                      | Existing `AccessibilityInfo` check removes the pulse for reduced motion; currently not used by app screens |
| `DsCard`, `DsScreen`, `DsBlobBackground`, `DsOfflineBanner` | Static layout, background, or status surface                | No motion to suppress                                                                                      |

The shared design-system primitives do not currently contain choice cards,
chips, or a toggle component. Those controls live in feature folders and should
use the shared pressable and entrance wrappers while keeping their own checked,
selected, and switch accessibility states.

## Focused checks

- `tests/component/ds-motion.test.tsx` covers visible content, delay, reduced
  motion, and unmount cleanup.
- `tests/component/ds-press-feedback.test.tsx` covers feedback across all three
  shared buttons, selected accessibility, reduced motion, and interrupted press
  cleanup.
- `tests/component/welcome-art.test.tsx` covers the one-shot sun turn and its
  reduced-motion alternative.
