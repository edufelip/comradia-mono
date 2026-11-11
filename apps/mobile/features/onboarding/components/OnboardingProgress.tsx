import { StyleSheet, Text, View } from 'react-native';
import { DsBackButton } from '@/components/ds/primitives/DsBackButton';
import {
  DsFontFamily,
  DsRadius,
  DsSpace,
  getDsTheme,
  type DsColorScheme,
} from '@/constants/design-system';
import { ONBOARDING_STEPS } from '@/features/onboarding/visuals';
import { useTranslation } from '@/localization';

type OnboardingProgressProps = {
  scheme: DsColorScheme;
  /** 1-based step being shown; the segments before it are filled. */
  step: number;
  onBack?: () => void;
};

/**
 * The `ob-top` row of the onboarding steps: optional back button, "Step n of 3"
 * and one segment per step. Step 1 is the first signed-in screen, so it has no
 * back button.
 */
export function OnboardingProgress({ scheme, step, onBack }: OnboardingProgressProps) {
  const { t } = useTranslation();
  const ds = getDsTheme(scheme);
  const segments = Array.from({ length: ONBOARDING_STEPS }, (_, index) => index < step);

  return (
    <View style={styles.row}>
      {onBack ? (
        <DsBackButton
          accessibilityLabel={t('onboarding.back')}
          onPress={onBack}
          scheme={scheme}
          testID="onboarding-back"
        />
      ) : null}

      <View style={styles.track}>
        <Text style={[styles.label, { color: ds.color.textTertiary }]} testID="onboarding-progress">
          {t('onboarding.progress', { current: step, total: ONBOARDING_STEPS })}
        </Text>
        <View aria-hidden style={styles.segments}>
          {segments.map((filled, index) => (
            <View
              key={index}
              style={[
                styles.segment,
                {
                  backgroundColor: filled ? ds.color.accentPrimary : ds.color.surfaceMuted,
                },
              ]}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: DsSpace.sm,
    marginBottom: DsSpace.lg,
  },
  track: {
    flex: 1,
    gap: 6,
  },
  label: {
    fontFamily: DsFontFamily.mono,
    fontSize: 10.5,
    letterSpacing: 0.8,
    lineHeight: 14,
    textTransform: 'uppercase',
  },
  segments: {
    flexDirection: 'row',
    gap: 6,
  },
  segment: {
    borderRadius: DsRadius.pill,
    flex: 1,
    height: 4,
    overflow: 'hidden',
  },
});
