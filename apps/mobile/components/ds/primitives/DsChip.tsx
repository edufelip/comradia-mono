import { useLayoutEffect, useRef, useState } from 'react';
import { StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import {
  DsBorder,
  DsLayout,
  DsRadius,
  DsSpace,
  DsTypography,
  getDsTheme,
  type DsColorScheme,
} from '@/constants/design-system';
import { DsMotionPressable } from '../motion/DsMotionPressable';
import { DsMotionView } from '../motion/DsMotionView';

type DsChipProps = {
  scheme: DsColorScheme;
  testID?: string;
  label: string;
  /** Emoji shown before the label, hidden from the spoken name. */
  icon?: string;
  selected: boolean;
  /** E.g. an unselected value chip once five are chosen. */
  disabled?: boolean;
  /** Multi-select chips are checkboxes (default); single-select chips are radios. */
  role?: 'checkbox' | 'radio';
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * A selectable pill. Selected = accent fill with `onAccent` text; disabled uses the
 * disabled tokens. The accessible name is the label alone, so the emoji stays decoration.
 */
export function DsChip({
  scheme,
  testID,
  label,
  icon,
  selected,
  disabled = false,
  role = 'checkbox',
  onPress,
  style,
}: DsChipProps) {
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
    <Text style={[DsTypography.chip, { color }]}>{icon ? `${icon} ${label}` : label}</Text>
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
        <DsMotionView testID={testID ? `${testID}-selected-motion` : undefined} variant="scale">
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
    borderWidth: DsBorder.strong,
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: DsLayout.minTouchTarget,
    paddingHorizontal: DsSpace.md,
    paddingVertical: DsSpace.xs,
  },
});
