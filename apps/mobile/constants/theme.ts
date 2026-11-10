import { DsFontFamily, getDsTheme } from './design-system';

const light = getDsTheme('light').color;
const dark = getDsTheme('dark').color;

export const Colors = {
  light: {
    text: light.textPrimary,
    background: light.canvas,
    tint: light.textPrimary,
    icon: light.textSecondary,
    tabIconDefault: light.textTertiary,
    tabIconSelected: light.textPrimary,
  },
  dark: {
    text: dark.textPrimary,
    background: dark.canvas,
    tint: dark.textPrimary,
    icon: dark.textSecondary,
    tabIconDefault: dark.textTertiary,
    tabIconSelected: dark.textPrimary,
  },
};

// Real Geist weights, loaded via @expo-google-fonts/geist and gated in
// app/_layout.tsx — see DsFontFamily in constants/design-system.ts for the
// single source of truth on which static weight backs each role.
export const Fonts = {
  sans: DsFontFamily.body,
  serif: DsFontFamily.display,
  rounded: DsFontFamily.display,
  mono: DsFontFamily.mono,
};
