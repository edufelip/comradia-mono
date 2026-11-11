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
      canvas: '#FBF6F4',
      shell: '#ffffffb3',
      surface: '#ffffff',
      surfaceMuted: '#f7eeeb',
      surfaceElevated: '#ffffff',
      surfaceWarning: '#fff3e0',
      textPrimary: '#231214',
      textSecondary: '#7A5A5C',
      textTertiary: '#9A7B7D',
      accentPrimary: '#D92D3A',
      actionPrimary: '#231214',
      onActionPrimary: '#ffffff',
      accentPrimaryHover: '#B8222E',
      accentPrimarySoft: '#FCE8E9',
      accentWarm: '#E05A47',
      accentWarmSoft: '#FCEEE8',
      disabledSurface: '#f0e8e6',
      disabledText: '#7A5A5C',
      disabledBorder: '#e8dfdc',
      success: '#1f7a4c',
      successSoft: '#e3efe6',
      warning: '#b45309',
      warningSoft: '#ffedd5',
      danger: '#D92D3A',
      dangerSoft: '#FCE8E9',
      dangerBorder: '#fecaca',
      readOnlyText: '#9a3412',
      border: '#e8dfdc',
      borderStrong: '#d9cbca',
      accentCyan: '#06b6d4',
      accentCyanSoft: '#06b6d420',
      onAccent: '#fbf6f4',
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
      textTertiary: '#9c8082',
      accentPrimary: '#E05A47',
      actionPrimary: '#fbf6f4',
      onActionPrimary: '#181112',
      accentPrimaryHover: '#f27e6e',
      accentPrimarySoft: '#e05a4729',
      accentWarm: '#f28a7c',
      accentWarmSoft: '#f28a7c29',
      disabledSurface: '#2e1e20',
      disabledText: '#c4a6a8',
      disabledBorder: '#3d282a',
      success: '#4ade80',
      successSoft: '#16301f',
      warning: '#f59e0b',
      warningSoft: '#3a2610',
      danger: '#ef4444',
      dangerSoft: '#7f1d1d66',
      dangerBorder: '#7f1d1d',
      readOnlyText: '#fdba74',
      border: '#3d282a',
      borderStrong: '#523639',
      accentCyan: '#22d3ee',
      accentCyanSoft: '#22d3ee29',
      onAccent: '#181112',
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
