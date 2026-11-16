import { useLayoutEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  DsBorder,
  DsRadius,
  DsSpace,
  DsTypography,
  getDsTheme,
  type DsColorScheme,
} from '@/constants/design-system';
import { DsMotionPressable } from '../motion/DsMotionPressable';
import { DsMotionView } from '../motion/DsMotionView';

type DsSelectCardProps = {
  scheme: DsColorScheme;
  testID?: string;
  /** Emoji shown in the tinted tile. */
  icon: string;
  /** The card's own colour: tints the tile and the selected border. */
  accent: string;
  label: string;
  description: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
};

const TILE = 36;

/**
 * A selectable card for exclusive choices: icon tile, label and description. It behaves as
 * one radio option whose spoken name is "label. description"; the tinted accent, border and
 * the checked state carry the selection, so colour alone is never the only signal.
 */
export function DsSelectCard({
  scheme,
  testID,
  icon,
  accent,
  label,
  description,
  selected,
  disabled = false,
  onPress,
}: DsSelectCardProps) {
  const ds = getDsTheme(scheme);
  const previousSelected = useRef(selected);
  const [selectionMotion, setSelectionMotion] = useState(false);

  useLayoutEffect(() => {
    if (previousSelected.current === selected) return;
    previousSelected.current = selected;
    setSelectionMotion(selected);
  }, [selected]);

  const iconTile = (
    <View
      aria-hidden
      style={[
        styles.tile,
        { backgroundColor: disabled ? ds.color.disabledSurface : `${accent}22` },
      ]}
    >
      <Text style={DsTypography.bodyLarge}>{icon}</Text>
    </View>
  );

  return (
    <DsMotionPressable
      aria-checked={selected}
      accessibilityLabel={`${label}. ${description}`}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      feedbackScale={0.985}
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor: disabled
            ? ds.color.disabledSurface
            : selected
              ? `${accent}22`
              : ds.color.surface,
          borderColor: disabled ? ds.color.disabledBorder : selected ? accent : ds.color.border,
        },
      ]}
      testID={testID}
    >
      {selected && selectionMotion ? (
        <DsMotionView
          style={styles.iconMotion}
          testID={testID ? `${testID}-selected-motion` : undefined}
          variant="scale"
        >
          {iconTile}
        </DsMotionView>
      ) : (
        iconTile
      )}
      <Text
        style={[
          DsTypography.label,
          { color: disabled ? ds.color.disabledText : ds.color.textPrimary },
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          DsTypography.caption,
          styles.description,
          { color: disabled ? ds.color.disabledText : ds.color.textSecondary },
        ]}
      >
        {description}
      </Text>
    </DsMotionPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: DsRadius.xxl,
    borderWidth: DsBorder.strong,
    minHeight: 96,
    overflow: 'hidden',
    padding: DsSpace.md,
    width: '100%',
  },
  tile: {
    alignItems: 'center',
    borderRadius: DsRadius.sm,
    height: TILE,
    justifyContent: 'center',
    marginBottom: DsSpace.sm,
    overflow: 'hidden',
    width: TILE,
  },
  iconMotion: {
    alignSelf: 'flex-start',
    width: TILE,
  },
  description: {
    marginTop: DsSpace.xxs,
  },
});
