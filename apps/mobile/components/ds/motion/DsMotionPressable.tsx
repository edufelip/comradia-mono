import { useEffect } from 'react';
import {
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { DS_MOTION } from '@/constants/motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const easeOut = Easing.bezier(...DS_MOTION.easing.easeOut);

type DsMotionPressableProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  feedbackScale?: number;
};

/** Animated feedback for shared pressable controls without changing their hit area. */
export function DsMotionPressable({
  disabled = false,
  feedbackScale = 0.97,
  onPressIn,
  onPressOut,
  style,
  ...pressableProps
}: DsMotionPressableProps) {
  const reduceMotion = useReducedMotion();
  const pressed = useSharedValue(0);

  const feedbackStyle = useAnimatedStyle(() => ({
    opacity: 1 - pressed.value * 0.06,
    transform: [{ scale: 1 + (feedbackScale - 1) * pressed.value }],
  }));

  useEffect(() => {
    if (disabled || reduceMotion) {
      cancelAnimation(pressed);
      pressed.value = 0;
    }

    return () => cancelAnimation(pressed);
  }, [disabled, pressed, reduceMotion]);

  const handlePressIn = (event: GestureResponderEvent) => {
    if (!disabled && !reduceMotion) {
      pressed.value = withTiming(1, {
        duration: DS_MOTION.duration.fast,
        easing: easeOut,
      });
    }
    onPressIn?.(event);
  };

  const handlePressOut = (event: GestureResponderEvent) => {
    if (disabled || reduceMotion) {
      cancelAnimation(pressed);
      pressed.value = 0;
    } else {
      pressed.value = withTiming(0, {
        duration: DS_MOTION.duration.fast,
        easing: easeOut,
      });
    }
    onPressOut?.(event);
  };

  return (
    <AnimatedPressable
      {...pressableProps}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, feedbackStyle]}
    />
  );
}
