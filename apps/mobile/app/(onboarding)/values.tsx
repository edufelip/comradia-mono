import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { DsPillButton } from '@/components/ds/primitives/DsPillButton';
import { DsFontFamily, DsSpace, getDsTheme } from '@/constants/design-system';
import { OnboardingChip } from '@/features/onboarding/components/OnboardingChip';
import { OnboardingScreen } from '@/features/onboarding/components/OnboardingScreen';
import { OnboardingStepper } from '@/features/onboarding/components/OnboardingStepper';
import { useOnboardingStore } from '@/features/onboarding/onboarding-store';
import { VALUE_ICONS } from '@/features/onboarding/visuals';
import { canLeaveValuesStep, VALUES_MAX, VALUE_IDS } from '@/features/profile/profile-schema';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTranslation } from '@/localization';

/**
 * S3 — three to five values plus the shared-passion weight. Once five are on, the
 * remaining chips are disabled: `toggleValue` already refuses a sixth, and the
 * chips say so instead of silently ignoring the tap.
 */
export default function ValuesScreen() {
  const colorScheme = useColorScheme();
  const scheme = colorScheme === 'dark' ? 'dark' : 'light';
  const ds = getDsTheme(scheme);
  const { t } = useTranslation();
  const router = useRouter();
  const draft = useOnboardingStore();

  const count = draft.values.length;
  const atMax = count >= VALUES_MAX;
  const canContinue = canLeaveValuesStep(draft);

  return (
    <OnboardingScreen
      footer={
        <DsPillButton
          contentColor={ds.color.onAccent}
          disabled={!canContinue}
          fullWidth
          label={t('onboarding.continue')}
          onPress={() => router.push('/starter')}
          scheme={scheme}
          style={[styles.cta, { backgroundColor: ds.color.accentPrimary }]}
          testID="onboarding-continue"
          variant="primary"
        />
      }
      lede={t('onboarding.values.lede')}
      onBack={() => router.back()}
      scheme={scheme}
      step={2}
      testID="onboarding-values"
      title={t('onboarding.values.title')}
    >
      <View style={styles.countRow}>
        <Text
          accessibilityLiveRegion="polite"
          style={[styles.count, { color: ds.color.accentPrimary }]}
          testID="values-count"
        >
          {t('onboarding.values.count', { count })}
        </Text>
      </View>

      <View style={styles.cloud}>
        {VALUE_IDS.map((id) => (
          <OnboardingChip
            key={id}
            disabled={atMax && !draft.values.includes(id)}
            icon={VALUE_ICONS[id]}
            label={t(`onboarding.values.${id}`)}
            onPress={() => draft.toggleValue(id)}
            role="checkbox"
            scheme={scheme}
            selected={draft.values.includes(id)}
            testID={`value-${id}`}
          />
        ))}
      </View>

      <OnboardingStepper
        decreaseLabel={t('onboarding.values.weight_decrease')}
        hint={t('onboarding.values.weight_hint')}
        increaseLabel={t('onboarding.values.weight_increase')}
        label={t('onboarding.values.weight')}
        onChange={draft.setSharedPassionWeight}
        scheme={scheme}
        value={draft.sharedPassionWeight}
        valueText={t('onboarding.values.weight_value', { value: draft.sharedPassionWeight })}
      />
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  countRow: {
    alignItems: 'flex-end',
    marginTop: DsSpace.sm,
  },
  count: {
    fontFamily: DsFontFamily.bold,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    lineHeight: 16,
  },
  cloud: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: DsSpace.xs,
  },
  cta: {
    height: 52,
  },
});
