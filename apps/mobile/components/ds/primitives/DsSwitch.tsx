import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  DsLayout,
  DsRadius,
  DsShadow,
  DsSpace,
  DsTypography,
  getDsTheme,
  type DsColorScheme,
} from '@/constants/design-system';
import { DS_MOTION } from '@/constants/motion';
import { DsMotionPressable } from '../motion/DsMotionPressable';

type DsSwitchProps = {
  scheme: DsColorScheme;
  testID?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  /** Row label on the left. When set, the whole row is the target and the label is the name. */
  label?: string;
  /** Spoken name; defaults to `label`. One of the two is required. */
  accessibilityLabel?: string;
  disabled?: boolean;
};

const TRACK_WIDTH = 44;
const TRACK_HEIGHT = 26;
const THUMB = 20;
const TRACK_PADDING = DsSpace.xxs;
const TRAVEL = TRACK_WIDTH - THUMB - TRACK_PADDING * 2;

/**
 * A switch of our own rather than RN's `Switch`: its web build paints the "on" thumb Material
 * teal (`#009688`), and the thumb colour of a checked switch cannot be themed from React
 * Native. Role, checked state and the spoken name stay the platform ones.
 */
export function DsSwitch({
  scheme,
  testID,
  value,
  onValueChange,
  label,
  accessibilityLabel,
  disabled = false,
}: DsSwitchProps) {
  const ds = getDsTheme(scheme);
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(value ? 1 : 0);
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * TRAVEL }],
  }));

  useEffect(() => {
    progress.value = reduceMotion
      ? value
        ? 1
        : 0
      : withTiming(value ? 1 : 0, {
          duration: DS_MOTION.duration.fast,
          easing: Easing.bezier(...DS_MOTION.easing.easeOut),
        });
  }, [progress, reduceMotion, value]);

  const trackColor = disabled
    ? ds.color.disabledSurface
    : value
      ? ds.color.accentPrimary
      : ds.color.disabledBorder;

  return (
    <DsMotionPressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      aria-checked={value}
      disabled={disabled}
      feedbackScale={0.96}
      onPress={() => onValueChange(!value)}
      style={[styles.hitArea, label ? styles.row : null]}
      testID={testID}
    >
      {label ? (
        <Text
          style={[
            DsTypography.button,
            styles.label,
            { color: disabled ? ds.color.disabledText : ds.color.textPrimary },
          ]}
        >
          {label}
        </Text>
      ) : null}
      <View style={[styles.track, { backgroundColor: trackColor }]}>
        <Animated.View
          style={[
            styles.thumb,
            { backgroundColor: ds.color.switchThumb },
            reduceMotion ? { transform: [{ translateX: value ? TRAVEL : 0 }] } : thumbStyle,
          ]}
          testID={testID ? `${testID}.thumb` : undefined}
        />
      </View>
    </DsMotionPressable>
  );
}

const styles = StyleSheet.create({
  hitArea: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: DsLayout.minTouchTarget,
    minWidth: DsLayout.minTouchTarget,
  },
  row: {
    flexDirection: 'row',
    gap: DsSpace.sm,
    justifyContent: 'space-between',
  },
  label: {
    flex: 1,
  },
  track: {
    borderRadius: DsRadius.pill,
    height: TRACK_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: TRACK_PADDING,
    width: TRACK_WIDTH,
  },
  thumb: {
    ...DsShadow.thumb,
    borderRadius: DsRadius.pill,
    height: THUMB,
    width: THUMB,
  },
});
