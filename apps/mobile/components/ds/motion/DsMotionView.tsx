import { useEffect, type ReactNode } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { DS_MOTION } from '@/constants/motion';

export type DsMotionVariant = 'reveal' | 'scale' | 'slide';

type DsMotionViewProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /** Optional per-item offset for a short, intentional list stagger. */
  delay?: number;
  variant?: DsMotionVariant;
};

const easeOut = Easing.bezier(...DS_MOTION.easing.easeOut);

/**
 * A short entrance wrapper for meaningful screen content. The starting frame
 * stays visible so a paused, hidden, or reduced-motion render never gates content.
 */
export function DsMotionView({
  children,
  style,
  testID,
  delay = 0,
  variant = 'reveal',
}: DsMotionViewProps) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);

  const motionStyle = useAnimatedStyle(() => {
    const value = progress.value;

    if (variant === 'scale') {
      return {
        opacity: 0.88 + value * 0.12,
        transform: [{ scale: 0.96 + value * 0.04 }],
      };
    }

    if (variant === 'slide') {
      return {
        opacity: 0.88 + value * 0.12,
        transform: [{ translateX: 12 * (1 - value) }],
      };
    }

    return {
      opacity: 0.82 + value * 0.18,
      transform: [{ translateY: 8 * (1 - value) }],
    };
  });

  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(progress);
      progress.value = 1;
      return () => cancelAnimation(progress);
    }

    const entrance = withTiming(1, {
      duration: DS_MOTION.duration.standard,
      easing: easeOut,
    });
    progress.value = delay > 0 ? withDelay(Math.max(0, delay), entrance) : entrance;

    return () => cancelAnimation(progress);
  }, [delay, progress, reduceMotion]);

  return (
    <Animated.View style={[style, motionStyle]} testID={testID}>
      {children}
    </Animated.View>
  );
}
