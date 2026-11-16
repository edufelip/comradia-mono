import { PlatformPressable } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { DS_MOTION } from '@/constants/motion';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';

const AnimatedPlatformPressable = Animated.createAnimatedComponent(PlatformPressable);
const easeOut = Easing.bezier(...DS_MOTION.easing.easeOut);

export function HapticTab(props: BottomTabBarButtonProps) {
  const reduceMotion = useReducedMotion();
  const disabled = Boolean(props.disabled || props.accessibilityState?.disabled);
  const scale = useSharedValue(1);
  const motionStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  useEffect(() => {
    if (reduceMotion || disabled) {
      cancelAnimation(scale);
      scale.value = 1;
    }
    return () => cancelAnimation(scale);
  }, [disabled, reduceMotion, scale]);

  const animateScale = (value: number) => {
    if (reduceMotion || disabled) {
      cancelAnimation(scale);
      scale.value = 1;
      return;
    }
    scale.value = withTiming(value, {
      duration: DS_MOTION.duration.fast,
      easing: easeOut,
    });
  };

  return (
    <AnimatedPlatformPressable
      {...props}
      disabled={disabled}
      style={[props.style, motionStyle]}
      onPressIn={(ev) => {
        if (!disabled && process.env.EXPO_OS === 'ios') {
          // Add a soft haptic feedback when pressing down on the tabs.
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        animateScale(0.96);
        props.onPressIn?.(ev);
      }}
      onPressOut={(ev) => {
        animateScale(1);
        props.onPressOut?.(ev);
      }}
    />
  );
}
