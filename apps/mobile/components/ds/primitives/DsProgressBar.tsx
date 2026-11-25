import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  DsRadius,
  type DsColorScheme,
  type DsColorToken,
  getDsTheme,
} from '@/constants/design-system';
import { DS_MOTION } from '@/constants/motion';

const BAR_HEIGHT = 8;

type DsProgressBarProps = {
  scheme: DsColorScheme;
  /** Current value. The fill animates from its previous value; the bar is decorative. */
  value: number;
  min?: number;
  max?: number;
  /** Fill color role; the track is always `surfaceMuted`. */
  fill?: DsColorToken;
  /** Spoken name of what the bar measures (already localized). */
  accessibilityLabel: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * An 8 pt pill progress bar (level progress in the Cravos wallet). The fill eases in over
 * `slow` 360 ms and appears at its final width at once with Reduce Motion.
 */
export function DsProgressBar({
  scheme,
  value,
  min = 0,
  max = 100,
  fill = 'accentPrimary',
  accessibilityLabel,
  testID,
  style,
}: DsProgressBarProps) {
  const ds = getDsTheme(scheme);
  const reduceMotion = useReducedMotion();
  const target = Math.min(1, Math.max(0, max === min ? 1 : (value - min) / (max - min)));
  const progress = useSharedValue(reduceMotion ? target : 0);
  const fillStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.value }] }));

  useEffect(() => {
    progress.value = reduceMotion
      ? target
      : withTiming(target, {
          duration: DS_MOTION.duration.slow,
          easing: Easing.bezier(...DS_MOTION.easing.easeOut),
        });
  }, [progress, reduceMotion, target]);

  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="progressbar"
      accessibilityValue={{ min, max, now: value }}
      style={[styles.track, { backgroundColor: ds.color.surfaceMuted }, style]}
      testID={testID}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          styles.fill,
          { backgroundColor: ds.color[fill] },
          fillStyle,
        ]}
        testID={testID ? `${testID}-fill` : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    borderRadius: DsRadius.pill,
    height: BAR_HEIGHT,
    overflow: 'hidden',
  },
  fill: {
    transformOrigin: 'left center',
  },
});
