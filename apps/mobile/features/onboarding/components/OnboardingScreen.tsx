import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DsScreen } from '@/components/ds/primitives/DsScreen';
import { DsStepProgress } from '@/components/ds/primitives/DsStepProgress';
import {
  DsLayout,
  DsSpace,
  DsTypography,
  getDsTheme,
  type DsColorScheme,
} from '@/constants/design-system';
import { ONBOARDING_STEPS } from '@/features/onboarding/visuals';
import { useTranslation } from '@/localization';
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
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <DsScreen
      keyboardAware
      // The birthday number pad has no Done key on iOS; a drag closes it.
      keyboardDismissMode="on-drag"
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + DsSpace.lg, paddingTop: insets.top + DsSpace.md },
      ]}
      scheme={scheme}
      testID={testID}
      withTopInset={false}
    >
      <View>
        <DsStepProgress
          backLabel={t('onboarding.back')}
          backTestID="onboarding-back"
          label={t('onboarding.progress', { current: step, total: ONBOARDING_STEPS })}
          onBack={onBack}
          scheme={scheme}
          step={step}
          style={styles.progress}
          testID="onboarding-progress"
          total={ONBOARDING_STEPS}
        />
        <Text
          accessibilityRole="header"
          style={[DsTypography.display, { color: ds.color.textPrimary }]}
        >
          {title}
        </Text>
        <Text style={[DsTypography.body, styles.lede, { color: ds.color.textSecondary }]}>
          {lede}
        </Text>
        {children}
      </View>

      <View style={styles.footer}>{footer}</View>
    </DsScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: DsLayout.screenGutter,
  },
  progress: {
    marginBottom: DsSpace.lg,
  },
  lede: {
    marginTop: DsSpace.xs,
  },
  footer: {
    gap: DsSpace.xs,
    marginTop: 'auto',
    paddingTop: DsSpace.md,
    width: '100%',
  },
});
