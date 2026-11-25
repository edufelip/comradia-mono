import type { TextStyle, ViewStyle } from 'react-native';

export type DsColorScheme = 'light' | 'dark';

/** Any color role name from the theme, for props that let a caller pick a fill (e.g. a progress bar). */
export type DsColorToken = keyof DsTheme['color'];

export type DsTheme = {
  color: {
    canvas: string;
    shell: string;
    surface: string;
    surfaceMuted: string;
    surfaceElevated: string;
    surfaceWarning: string;
    textPrimary: string;
    textSecondary: string;
    textTertiary: string;
    accentPrimary: string;
    actionPrimary: string;
    onActionPrimary: string;
    accentPrimaryHover: string;
    accentPrimarySoft: string;
    /** Accent for text and icons on canvas, surface and soft fills (passes AA; `accentPrimary` is for fills and borders). */
    accentText: string;
    accentWarm: string;
    accentWarmSoft: string;
    disabledSurface: string;
    disabledText: string;
    disabledBorder: string;
    success: string;
    successSoft: string;
    warning: string;
    warningSoft: string;
    danger: string;
    dangerSoft: string;
    dangerBorder: string;
    readOnlyText: string;
    border: string;
    borderStrong: string;
    accentCyan: string;
    accentCyanSoft: string;
    onAccent: string;
    focusRing: string;
    switchThumb: string;
    overlayNeutral: string;
    overlaySoft: string;
    overlayStrong: string;
  };
  blob: {
    topLeft: string;
    bottomRight: string;
  };
};

const THEME_BY_SCHEME: Record<DsColorScheme, DsTheme> = {
  light: {
    color: {
      canvas: '#FBF6F4',
      shell: '#ffffffb3',
      surface: '#ffffff',
      surfaceMuted: '#f7eeeb',
      surfaceElevated: '#ffffff',
      surfaceWarning: '#fff3e0',
      textPrimary: '#231214',
      textSecondary: '#7A5A5C',
      textTertiary: '#866567',
      accentPrimary: '#D92D3A',
      actionPrimary: '#231214',
      onActionPrimary: '#ffffff',
      accentPrimaryHover: '#B8222E',
      accentPrimarySoft: '#FCE8E9',
      accentText: '#B8222E',
      accentWarm: '#E05A47',
      accentWarmSoft: '#FCEEE8',
      disabledSurface: '#f0e8e6',
      disabledText: '#7A5A5C',
      disabledBorder: '#e8dfdc',
      success: '#1b7447',
      successSoft: '#e3efe6',
      warning: '#a04a07',
      warningSoft: '#ffedd5',
      danger: '#C42431',
      dangerSoft: '#FCE8E9',
      dangerBorder: '#fecaca',
      readOnlyText: '#9a3412',
      border: '#e8dfdc',
      borderStrong: '#d9cbca',
      accentCyan: '#06b6d4',
      accentCyanSoft: '#06b6d420',
      onAccent: '#ffffff',
      focusRing: '#1f7a4c',
      switchThumb: '#ffffff',
      overlayNeutral: 'rgba(35, 18, 20, 0.32)',
      overlaySoft: 'rgba(217, 45, 58, 0.35)',
      overlayStrong: 'rgba(217, 45, 58, 0.85)',
    },
    blob: {
      topLeft: '#ffd9c7',
      bottomRight: '#fce8e9',
    },
  },
  dark: {
    color: {
      canvas: '#181112',
      shell: '#00000080',
      surface: '#231719',
      surfaceMuted: '#2e1e20',
      surfaceElevated: '#2a1b1d',
      surfaceWarning: '#3a2610',
      textPrimary: '#fbf6f4',
      textSecondary: '#c4a6a8',
      textTertiary: '#a48a8c',
      accentPrimary: '#E05A47',
      actionPrimary: '#fbf6f4',
      onActionPrimary: '#181112',
      accentPrimaryHover: '#f27e6e',
      accentPrimarySoft: '#e05a4729',
      accentText: '#f27e6e',
      accentWarm: '#f28a7c',
      accentWarmSoft: '#f28a7c29',
      disabledSurface: '#2e1e20',
      disabledText: '#c4a6a8',
      disabledBorder: '#3d282a',
      success: '#4ade80',
      successSoft: '#16301f',
      warning: '#f59e0b',
      warningSoft: '#3a2610',
      danger: '#f87171',
      dangerSoft: '#7f1d1d66',
      dangerBorder: '#7f1d1d',
      readOnlyText: '#fdba74',
      border: '#3d282a',
      borderStrong: '#523639',
      accentCyan: '#22d3ee',
      accentCyanSoft: '#22d3ee29',
      onAccent: '#181112',
      focusRing: '#4ade80',
      switchThumb: '#ffffff',
      overlayNeutral: 'rgba(8, 8, 8, 0.48)',
      overlaySoft: 'rgba(224, 90, 71, 0.3)',
      overlayStrong: 'rgba(224, 90, 71, 0.7)',
    },
    blob: {
      topLeft: '#3a1d20',
      bottomRight: '#261517',
    },
  },
};

export const DsRadius = {
  /** Inputs, banners, skeleton bars, small tiles. */
  sm: 12,
  /** Cards, fields, sheets. */
  lg: 16,
  /** Large selectable cards. */
  xxl: 20,
  /** Buttons, chips, switch tracks, avatars, dots: always a full capsule or circle. */
  pill: 9999,
} as const;

export const DsSpace = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
} as const;

/** Layout constants shared by every screen. */
export const DsLayout = {
  /** Horizontal padding of a full-width screen on a phone. */
  screenGutter: 22,
  /** Smallest tappable area on any control (iOS HIG, Android and WCAG 2.5.8 all agree on ~44). */
  minTouchTarget: 44,
  /** Height of a primary control: pill button (`md`) and the like. */
  controlHeight: 46,
  /** Height of a text field row. */
  fieldHeight: 52,
  /** Width at which web switches from the phone to the tablet layout (and sheets to dialogs). */
  breakpointTablet: 768,
  /** Width at which web switches to the desktop layout. */
  breakpointDesktop: 1024,
} as const;

/** Stroke widths for borders, dividers and focus rings. */
export const DsBorder = {
  hairline: 1,
  /** Selectable controls (chips, option cards, outline buttons). */
  strong: 1.5,
  /** Keyboard focus ring on web. */
  focus: 3,
} as const;

/** Icon glyph sizes. Icons come from `@expo/vector-icons` (MaterialIcons). */
export const DsIconSize = {
  sm: 18,
  md: 20,
  lg: 24,
} as const;

/** Only these Geist files are loaded (app/_layout.tsx): 400, 500, 700, plus Geist Mono 500. */
export const DsFontFamily = {
  body: 'Geist_400Regular',
  medium: 'Geist_500Medium',
  bold: 'Geist_700Bold',
  mono: 'GeistMono_500Medium',
} as const;

const TABULAR: TextStyle['fontVariant'] = ['tabular-nums'];

export const DsTypography: Record<
  | 'hero'
  | 'display'
  | 'heading'
  | 'title'
  | 'screenTitle'
  | 'cardTitle'
  | 'bodyLarge'
  | 'body'
  | 'input'
  | 'caption'
  | 'button'
  | 'chip'
  | 'label'
  | 'micro'
  | 'eyebrow'
  | 'figure',
  TextStyle
> = {
  /** The one large moment on a screen (welcome headline, match celebration). */
  hero: {
    fontFamily: DsFontFamily.bold,
    fontSize: 40,
    lineHeight: 44,
    fontWeight: '700',
    letterSpacing: -1.5,
  },
  /** Section and sheet headings. */
  heading: {
    fontFamily: DsFontFamily.bold,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
  },
  /** Onboarding and auth headlines. */
  display: {
    fontFamily: DsFontFamily.bold,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: -1,
  },
  title: {
    fontFamily: DsFontFamily.bold,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
  },
  screenTitle: {
    fontFamily: DsFontFamily.bold,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
  },
  cardTitle: {
    fontFamily: DsFontFamily.bold,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
  },
  /** Longer reading text: chat messages, profile answers. */
  bodyLarge: {
    fontFamily: DsFontFamily.body,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
  },
  body: {
    fontFamily: DsFontFamily.body,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
  },
  /** Text typed into a field. */
  input: {
    fontFamily: DsFontFamily.body,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '400',
  },
  caption: {
    fontFamily: DsFontFamily.body,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    fontVariant: TABULAR,
  },
  button: {
    fontFamily: DsFontFamily.medium,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  /** Bold label of a selectable card or a field. */
  label: {
    fontFamily: DsFontFamily.bold,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  /** Label inside a chip or tag. */
  chip: {
    fontFamily: DsFontFamily.medium,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  /** Small uppercase mono label: step counters and section kickers. */
  eyebrow: {
    fontFamily: DsFontFamily.mono,
    fontSize: 10.5,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  micro: {
    fontFamily: DsFontFamily.medium,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500',
    fontVariant: TABULAR,
  },
  figure: {
    fontFamily: DsFontFamily.bold,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '700',
    fontVariant: TABULAR,
  },
} as const;

export const DsShadow: Record<'none' | 'soft' | 'floating' | 'thumb', ViewStyle> = {
  none: {},
  soft: {},
  floating: {
    elevation: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
  },
  /** The knob of a switch. */
  thumb: {
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
};

/**
 * Category accents: one fixed hue per onboarding vibe. They tint an icon tile and a selected
 * border (as a `${accent}22` alpha suffix), so they are the same in light and dark. They
 * are content colors, not status or brand roles; use `getDsTheme` for those.
 */
export const DsCategoryColor = {
  forest: '#2F8F5B',
  brick: '#B5523C',
  crimson: '#D92D3A',
  wine: '#8E1622',
  coral: '#E05A47',
} as const;

/**
 * Colors of the welcome illustrations (sun, avatars). They are artwork, not interface:
 * they do not change with the color scheme, and skin tones are deliberately outside the
 * interface palette. Everything else must come from `getDsTheme`.
 */
export const DsArt = {
  sunCore: '#FFD9C7',
  sunEdge: '#E05A47',
  faces: [
    { background: '#F5B08F', shirt: '#D92D3A', skin: '#8D5524' },
    { background: '#FCE8E9', shirt: '#231214', skin: '#E0AC69' },
    { background: '#FFD9C7', shirt: '#E05A47', skin: '#C68642' },
  ],
} as const;

/** Only `constants/design-system.ts` may hold color literals, so the mixer lives here. */
function mixHex(from: string, to: string, amount: number): string {
  const channel = (hex: string, offset: number) =>
    Number.parseInt(hex.slice(offset, offset + 2), 16);
  const blend = (offset: number) => {
    const mixed = Math.round(
      channel(from, offset) + (channel(to, offset) - channel(from, offset)) * amount,
    );
    return mixed.toString(16).padStart(2, '0');
  };
  return `#${blend(1)}${blend(3)}${blend(5)}`;
}

/** Pure white and black exist only as blending targets for the fixed palettes below. */
const WHITE = '#ffffff';
const BLACK = '#000000';
const BRAND_INK = '#231214';

type TierSchemeShades = { light: string; dark: string };

type DsAchievementTierPalette = {
  /** The tier's metal: chip fills and the medal rim's mid stop. */
  base: string;
  /** Light end of the bevelled rim gradient. */
  rimLight: string;
  /** Dark end of the rim gradient and the inner bevel's outer edge. */
  rimDark: string;
  /** A face tinted with the metal, drawn on the card surface, per scheme. */
  face: TierSchemeShades;
  /** The centered glyph's ink, per scheme. */
  glyphInk: TierSchemeShades;
  /** The decorative highlight arc on the rim. */
  highlightArc: string;
  /** Text on a chip filled with `base`; the only AA-passing ink on all three metals. */
  ink: string;
};

function tierPalette(base: string): DsAchievementTierPalette {
  return {
    base,
    rimLight: mixHex(base, WHITE, 0.45),
    rimDark: mixHex(base, BLACK, 0.32),
    face: {
      light: mixHex(THEME_BY_SCHEME.light.color.surface, base, 0.1),
      dark: mixHex(THEME_BY_SCHEME.dark.color.surface, base, 0.16),
    },
    glyphInk: {
      light: mixHex(base, BLACK, 0.38),
      dark: mixHex(base, WHITE, 0.35),
    },
    highlightArc: WHITE,
    ink: BRAND_INK,
  };
}

/**
 * Achievement tiers (bronze, silver, gold), the fixed palette of the Cravos conquistas.
 * Like `DsArt` it does not change with the scheme, except for the medal shades that sit on
 * a card (`face`, `glyphInk`). Text on a tier fill always uses `ink`: white fails AA on
 * silver and bronze. The medal itself never carries text.
 */
export const DsAchievementTier = {
  bronze: tierPalette('#B5703F'),
  silver: tierPalette('#8C97A3'),
  gold: tierPalette('#C9961E'),
} as const satisfies Record<string, DsAchievementTierPalette>;

export type DsAchievementTierKey = keyof typeof DsAchievementTier;

export function getDsTheme(scheme: DsColorScheme): DsTheme {
  return THEME_BY_SCHEME[scheme];
}
