import { useEffect } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { DsTypography, type DsColorScheme, getDsTheme } from '@/constants/design-system';
import { DS_MOTION } from '@/constants/motion';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const RING_SIZE = 64;
const STROKE = 6;
const RADIUS = 27;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

type DsProgressRingProps = {
  scheme: DsColorScheme;
  /** Fraction of the ring that is filled, 0 to 1 (clamped). */
  progress: number;
  /** Optional visible counter inside the ring, e.g. "1/1" (already localized). */
  label?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * The 64 pt streak ring. The arc eases in over `slow` 360 ms and shows its end state at once
 * with Reduce Motion. Decorative like `DsStepProgress`'s bar: announce the streak in the card
 * copy, not here.
 */
export function DsProgressRing({ scheme, progress, label, testID, style }: DsProgressRingProps) {
  const ds = getDsTheme(scheme);
  const reduceMotion = useReducedMotion();
  const target = Math.min(1, Math.max(0, progress));
  const arc = useSharedValue(reduceMotion ? target : 0);
  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - arc.value),
  }));

  useEffect(() => {
    arc.value = reduceMotion
      ? target
      : withTiming(target, {
          duration: DS_MOTION.duration.slow,
          easing: Easing.bezier(...DS_MOTION.easing.easeOut),
        });
  }, [arc, reduceMotion, target]);

  return (
    <View
      aria-hidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.ring, style]}
      testID={testID}
    >
      <View style={styles.rotated}>
        <Svg viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            fill="none"
            r={RADIUS}
            stroke={ds.color.surfaceMuted}
            strokeWidth={STROKE}
            testID={testID ? `${testID}-track` : undefined}
          />
          <AnimatedCircle
            animatedProps={arcProps}
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            fill="none"
            r={RADIUS}
            stroke={ds.color.accentPrimary}
            strokeDasharray={CIRCUMFERENCE}
            strokeLinecap="round"
            strokeWidth={STROKE}
            testID={testID ? `${testID}-arc` : undefined}
          />
        </Svg>
      </View>
      {label ? (
        <View pointerEvents="none" style={styles.labelBox}>
          <Text style={[DsTypography.label, { color: ds.color.textPrimary }]}>{label}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    height: RING_SIZE,
    position: 'relative',
    width: RING_SIZE,
  },
  // The arc starts at 12 o'clock instead of 3.
  rotated: {
    ...StyleSheet.absoluteFillObject,
    transform: [{ rotate: '-90deg' }],
  },
  labelBox: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
