import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { getDsTheme, type DsColorScheme } from '@/constants/design-system';

type Props = {
  active: boolean;
  focused: boolean;
  scheme: DsColorScheme;
  first: ReactNode;
  second: ReactNode;
  testID?: string;
};

/** A brief, one-shot meet between two profile portraits after a mutual like. */
export function MatchCelebration({ active, focused, scheme, first, second, testID }: Props) {
  const ds = getDsTheme(scheme);
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(active && !reduceMotion ? 0 : 1);
  const hasStarted = useRef(false);

  useEffect(() => {
    if (!active) {
      progress.value = 1;
      return;
    }

    if (!focused) {
      cancelAnimation(progress);
      return;
    }

    if (hasStarted.current) return;
    hasStarted.current = true;
    if (reduceMotion) {
      progress.value = 1;
      return;
    }

    progress.value = 0;
    progress.value = withTiming(1, {
      duration: 360,
      easing: Easing.out(Easing.cubic),
    });

    return () => {
      cancelAnimation(progress);
      if (hasStarted.current) progress.value = 1;
    };
  }, [active, focused, progress, reduceMotion]);

  const firstPortraitStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(progress.value, [0, 1], [-14, 0], Extrapolation.CLAMP) }],
  }));
  const secondPortraitStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(progress.value, [0, 1], [14, 0], Extrapolation.CLAMP) }],
  }));
  const heartStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [-10, 0], Extrapolation.CLAMP) },
      { scale: interpolate(progress.value, [0, 1], [0.62, 1], Extrapolation.CLAMP) },
    ],
  }));

  return (
    <View style={styles.frame} testID={testID}>
      <View style={styles.photos}>
        <Animated.View style={firstPortraitStyle}>{first}</Animated.View>
        <Animated.View style={secondPortraitStyle}>{second}</Animated.View>
        <Animated.View
          accessible={false}
          accessibilityElementsHidden
          aria-hidden
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
          style={[styles.emblem, heartStyle]}
          testID={testID ? `${testID}-emblem` : undefined}
        >
          <Svg height={40} viewBox="0 0 24 24" width={40}>
            <Circle cx={12} cy={1.5} fill={ds.color.accentWarm} r={1.1} />
            <Circle cx={22.5} cy={12} fill={ds.color.accentPrimary} r={1.1} />
            <Circle cx={12} cy={22.5} fill={ds.color.accentWarm} r={1.1} />
            <Circle cx={1.5} cy={12} fill={ds.color.accentPrimary} r={1.1} />
            <Path
              d="M12 21s-7.4-4.4-9.4-9.1C.6 6.2 4.7 2 8.8 4c1.3.6 2.3 1.7 3.2 2.9C12.9 5.7 13.9 4.6 15.2 4c4.1-2 8.2 2.2 6.2 7.9C19.4 16.6 12 21 12 21Z"
              fill={ds.color.accentPrimary}
            />
          </Svg>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
  },
  photos: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    position: 'relative',
  },
  emblem: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    position: 'absolute',
    top: -25,
    width: 40,
  },
});
