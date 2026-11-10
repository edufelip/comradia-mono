import type { TextStyle, ViewStyle } from 'react-native';

export type DsColorScheme = 'light' | 'dark';

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
      canvas: '#f8f5f2',
      shell: '#ffffffb3',
      surface: '#ffffff',
      surfaceMuted: '#f1ebe5',
      surfaceElevated: '#ffffff',
      surfaceWarning: '#fff3e0',
      textPrimary: '#181211',
      textSecondary: '#5c524f',
      textTertiary: '#736865',
      accentPrimary: '#c83232',
      actionPrimary: '#181211',
      onActionPrimary: '#ffffff',
      accentPrimaryHover: '#a62424',
      accentPrimarySoft: '#c832321a',
      accentWarm: '#b86b14',
      accentWarmSoft: '#b86b141a',
      disabledSurface: '#e6dfd9',
      disabledText: '#5c524f',
      disabledBorder: '#d6cdc6',
      success: '#1f7a4c',
      successSoft: '#e3efe6',
      warning: '#b45309',
      warningSoft: '#ffedd5',
      danger: '#b3261e',
      dangerSoft: '#fee2e2',
      dangerBorder: '#fecaca',
      readOnlyText: '#9a3412',
      border: '#e6dfd9',
      borderStrong: '#d6cdc6',
      accentCyan: '#06b6d4',
      accentCyanSoft: '#06b6d420',
      onAccent: '#fbf9f5',
      overlayNeutral: 'rgba(24, 18, 17, 0.32)',
      overlaySoft: 'rgba(200, 50, 50, 0.35)',
      overlayStrong: 'rgba(200, 50, 50, 0.85)',
    },
    blob: {
      topLeft: '#ffe4e6',
      bottomRight: '#fef3c7',
    },
  },
  dark: {
    color: {
      canvas: '#110d0d',
      shell: '#00000066',
      surface: '#1c1616',
      surfaceMuted: '#282020',
      surfaceElevated: '#1c1616',
      surfaceWarning: '#3a2610',
      textPrimary: '#ffffff',
      textSecondary: '#c4b8b8',
      textTertiary: '#9c8e8e',
      accentPrimary: '#f87171',
      actionPrimary: '#ffffff',
      onActionPrimary: '#110d0d',
      accentPrimaryHover: '#fca5a5',
      accentPrimarySoft: '#f8717129',
      accentWarm: '#e0a838',
      accentWarmSoft: '#e0a83829',
      disabledSurface: '#282020',
      disabledText: '#c4b8b8',
      disabledBorder: '#362b2b',
      success: '#4ade80',
      successSoft: '#16301f',
      warning: '#f59e0b',
      warningSoft: '#3a2610',
      danger: '#ef4444',
      dangerSoft: '#7f1d1d66',
      dangerBorder: '#7f1d1d',
      readOnlyText: '#fdba74',
      border: '#362b2b',
      borderStrong: '#473939',
      accentCyan: '#22d3ee',
      accentCyanSoft: '#22d3ee29',
      onAccent: '#1a0e0e',
      overlayNeutral: 'rgba(8, 8, 8, 0.48)',
      overlaySoft: 'rgba(248, 113, 113, 0.3)',
      overlayStrong: 'rgba(248, 113, 113, 0.7)',
    },
    blob: {
      topLeft: '#3b1519',
      bottomRight: '#332211',
    },
  },
};

export const DsRadius = {
  sm: 12,
  md: 12,
  lg: 16,
  xl: 16,
  pill: 22,
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

export const DsFontFamily = {
  display: 'Geist_700Bold',
  bold: 'Geist_700Bold',
  semibold: 'Geist_500Medium',
  medium: 'Geist_500Medium',
  body: 'Geist_400Regular',
  mono: 'GeistMono_500Medium',
} as const;

const TABULAR: TextStyle['fontVariant'] = ['tabular-nums'];

export const DsTypography: Record<
  'title' | 'screenTitle' | 'cardTitle' | 'body' | 'caption' | 'button' | 'micro' | 'figure',
  TextStyle
> = {
  title: {
    fontFamily: DsFontFamily.display,
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
  body: {
    fontFamily: DsFontFamily.body,
    fontSize: 14,
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

export const DsShadow: Record<'none' | 'soft' | 'floating', ViewStyle> = {
  none: {},
  soft: {},
  floating: {
    elevation: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
  },
};

export function getDsTheme(scheme: DsColorScheme): DsTheme {
  return THEME_BY_SCHEME[scheme];
}
