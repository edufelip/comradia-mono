import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DsScreen } from '@/components/ds/primitives/DsScreen';
import { DsFontFamily, DsSpace, getDsTheme, type DsColorScheme } from '@/constants/design-system';
import { OnboardingProgress } from '@/features/onboarding/components/OnboardingProgress';
import type { ReactNode } from 'react';

type OnboardingScreenProps = {
  scheme: DsColorScheme;
  step: number;
  onBack?: () => void;
  title: string;
  lede: string;
  children: ReactNode;
  /** Docked at the bottom of the screen, like the welcome CTAs. */
  footer: ReactNode;
  testID?: string;
};

/**
 * Shared shell for S2–S4: scrolled content with the step header, title and lede,
 * then the CTA pinned to the bottom edge above the safe area. Keyboard-aware so
 * the birthday and answer fields stay visible while typing.
 */
export function OnboardingScreen({
  scheme,
  step,
  onBack,
  title,
  lede,
  children,
  footer,
  testID,
}: OnboardingScreenProps) {
  const ds = getDsTheme(scheme);
  const insets = useSafeAreaInsets();

  return (
    <DsScreen
      keyboardAware
      // The birthday number pad has no Done key on iOS; a drag closes it.
      keyboardDismissMode="on-drag"
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + 20, paddingTop: insets.top + 16 },
      ]}
      scheme={scheme}
      testID={testID}
      withTopInset={false}
    >
      <View>
        <OnboardingProgress onBack={onBack} scheme={scheme} step={step} />
        <Text accessibilityRole="header" style={[styles.title, { color: ds.color.textPrimary }]}>
          {title}
        </Text>
        <Text style={[styles.lede, { color: ds.color.textSecondary }]}>{lede}</Text>
        {children}
      </View>

      <View style={styles.footer}>{footer}</View>
    </DsScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: 22,
  },
  title: {
    fontFamily: DsFontFamily.bold,
    fontSize: 30,
    letterSpacing: -1,
    lineHeight: 34,
  },
  lede: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  footer: {
    gap: DsSpace.xs,
    marginTop: 'auto',
    paddingTop: DsSpace.md,
    width: '100%',
  },
});
