import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
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

  return (
    <Pressable
      aria-checked={selected}
      accessibilityLabel={label}
      accessibilityRole={role}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.chip, { backgroundColor, borderColor }, style]}
      testID={testID}
    >
      {/* The emoji is decoration; `accessibilityLabel` above is the spoken name. */}
      <Text style={[styles.text, { color }]}>{icon ? `${icon} ${label}` : label}</Text>
    </Pressable>
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
