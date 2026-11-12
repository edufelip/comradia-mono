import { useLayoutEffect, useRef, useState } from 'react';
import { StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { DsMotionPressable } from '@/components/ds/motion/DsMotionPressable';
import { DsMotionView } from '@/components/ds/motion/DsMotionView';
import { DsRadius, getDsTheme, type DsColorScheme } from '@/constants/design-system';

type OnboardingChipProps = {
  scheme: DsColorScheme;
  testID: string;
  label: string;
  /** Emoji shown before the label, hidden from the spoken name. */
  icon?: string;
  selected: boolean;
  /** E.g. an unselected value chip once five are chosen. */
  disabled?: boolean;
  /** Value chips are checkboxes; looking-for, union and prompt chips are radios. */
  role?: 'checkbox' | 'radio';
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

/** A pill chip from the chart's `.cause`, `.union-list button` and prompt picker. */
export function OnboardingChip({
  scheme,
  testID,
  label,
  icon,
  selected,
  disabled = false,
  role = 'checkbox',
  onPress,
  style,
}: OnboardingChipProps) {
  const ds = getDsTheme(scheme);
  const previousSelected = useRef(selected);
  const [selectionMotion, setSelectionMotion] = useState(false);

  useLayoutEffect(() => {
    if (previousSelected.current === selected) return;
    previousSelected.current = selected;
    setSelectionMotion(selected);
  }, [selected]);

  const backgroundColor = disabled
    ? ds.color.disabledSurface
    : selected
      ? ds.color.accentPrimary
      : ds.color.surface;
  const borderColor = disabled
    ? ds.color.disabledBorder
    : selected
      ? ds.color.accentPrimary
      : ds.color.border;
  const color = disabled
    ? ds.color.disabledText
    : selected
      ? ds.color.onAccent
      : ds.color.textPrimary;
  const labelContent = (
    <Text style={[styles.text, { color }]}>{icon ? `${icon} ${label}` : label}</Text>
  );

  return (
    <DsMotionPressable
      aria-checked={selected}
      accessibilityLabel={label}
      accessibilityRole={role}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      feedbackScale={0.98}
      onPress={onPress}
      style={[styles.chip, { backgroundColor, borderColor }, style]}
      testID={testID}
    >
      {/* The emoji is decoration; `accessibilityLabel` above is the spoken name. */}
      {selected && selectionMotion ? (
        <DsMotionView testID={`${testID}-selected-motion`} variant="scale">
          {labelContent}
        </DsMotionView>
      ) : (
        labelContent
      )}
    </DsMotionPressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    borderRadius: DsRadius.pill,
    borderWidth: 1.5,
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
});
