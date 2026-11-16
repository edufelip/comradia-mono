import { MaterialIcons } from '@expo/vector-icons';
import { useLayoutEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DsMotionPressable } from '@/components/ds/motion/DsMotionPressable';
import { DsMotionView } from '@/components/ds/motion/DsMotionView';
import { DsCard } from '@/components/ds/primitives/DsCard';
import {
  DsFontFamily,
  DsRadius,
  DsSpace,
  getDsTheme,
  type DsColorScheme,
} from '@/constants/design-system';
import {
  clampSharedPassionWeight,
  SHARED_PASSION_MAX,
  SHARED_PASSION_MIN,
  SHARED_PASSION_STEP,
} from '@/features/onboarding/onboarding-store';

type OnboardingStepperProps = {
  scheme: DsColorScheme;
  label: string;
  decreaseLabel: string;
  increaseLabel: string;
  hint: string;
  /** Already formatted for display, e.g. `60%`. */
  valueText: string;
  value: number;
  onChange: (next: number) => void;
};

/**
 * S3's shared-passion weight: − / + in steps of ten inside 0–100, with the
 * number itself an `adjustable` element so screen readers can increment and
 * decrement it with a swipe.
 */
export function OnboardingStepper({
  scheme,
  label,
  decreaseLabel,
  increaseLabel,
  hint,
  valueText,
  value,
  onChange,
}: OnboardingStepperProps) {
  const ds = getDsTheme(scheme);
  const step = (delta: number) => onChange(clampSharedPassionWeight(value + delta));
  const canDecrease = value > SHARED_PASSION_MIN;
  const canIncrease = value < SHARED_PASSION_MAX;
  const previousValue = useRef(value);
  const [valueHasChanged, setValueHasChanged] = useState(false);

  useLayoutEffect(() => {
    if (previousValue.current === value) return;
    previousValue.current = value;
    setValueHasChanged(true);
  }, [value]);

  const valueLabel = (
    <Text style={[styles.value, { color: ds.color.accentPrimary }]}>{valueText}</Text>
  );

  return (
    <DsCard scheme={scheme} style={styles.card}>
      <View>
        <Text style={[styles.label, { color: ds.color.textPrimary }]}>{label}</Text>
        <Text style={[styles.hint, { color: ds.color.textSecondary }]}>{hint}</Text>
      </View>

      <View style={styles.controls}>
        <DsMotionPressable
          accessibilityLabel={decreaseLabel}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canDecrease }}
          disabled={!canDecrease}
          feedbackScale={0.94}
          onPress={() => step(-SHARED_PASSION_STEP)}
          style={[
            styles.button,
            {
              backgroundColor: canDecrease ? ds.color.surfaceMuted : ds.color.disabledSurface,
            },
          ]}
          testID="weight-decrease"
        >
          <MaterialIcons
            color={canDecrease ? ds.color.textPrimary : ds.color.disabledText}
            name="remove"
            size={20}
          />
        </DsMotionPressable>

        <View
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          accessibilityLabel={label}
          accessibilityRole="adjustable"
          accessibilityValue={{
            max: SHARED_PASSION_MAX,
            min: SHARED_PASSION_MIN,
            now: value,
            text: valueText,
          }}
          onAccessibilityAction={(event) => {
            const action = event.nativeEvent.actionName;
            if (action === 'increment') step(SHARED_PASSION_STEP);
            if (action === 'decrement') step(-SHARED_PASSION_STEP);
          }}
          style={styles.valueBox}
          testID="weight-value"
        >
          {valueHasChanged ? (
            <DsMotionView key={value} testID="weight-value-motion" variant="scale">
              {valueLabel}
            </DsMotionView>
          ) : (
            valueLabel
          )}
        </View>

        <DsMotionPressable
          accessibilityLabel={increaseLabel}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canIncrease }}
          disabled={!canIncrease}
          feedbackScale={0.94}
          onPress={() => step(SHARED_PASSION_STEP)}
          style={[
            styles.button,
            {
              backgroundColor: canIncrease ? ds.color.surfaceMuted : ds.color.disabledSurface,
            },
          ]}
          testID="weight-increase"
        >
          <MaterialIcons
            color={canIncrease ? ds.color.textPrimary : ds.color.disabledText}
            name="add"
            size={20}
          />
        </DsMotionPressable>
      </View>
    </DsCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: DsSpace.sm,
    marginTop: DsSpace.md,
  },
  label: {
    fontFamily: DsFontFamily.semibold,
    fontSize: 14,
    lineHeight: 20,
  },
  hint: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  controls: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    alignItems: 'center',
    borderRadius: DsRadius.pill,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  valueBox: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 6,
  },
  value: {
    fontFamily: DsFontFamily.bold,
    fontSize: 22,
    fontVariant: ['tabular-nums'],
    lineHeight: 28,
  },
});
