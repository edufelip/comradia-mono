/* Minimal react-native-reanimated stand-in for component tests. */
import { Animated, Easing } from 'react-native';

const identity = <T>(value: T): T => value;

const mock = {
  __esModule: true,
  default: { View: Animated.View, Text: Animated.Text, ScrollView: Animated.ScrollView },
  Easing,
  useReducedMotion: () => false,
  useSharedValue: (initial: unknown) => ({ value: initial }),
  useAnimatedStyle: (factory: () => object) => factory(),
  useAnimatedProps: (factory: () => object) => factory(),
  withTiming: identity,
  withRepeat: identity,
  withSpring: identity,
  withSequence: identity,
  withDelay: (_d: number, value: unknown) => value,
  cancelAnimation: () => undefined,
  runOnJS: (fn: unknown) => fn,
  runOnUI: (fn: unknown) => fn,
  useDerivedValue: (factory: () => unknown) => ({ value: factory() }),
  useAnimatedRef: () => ({ current: null }),
  useScrollViewOffset: () => ({ value: 0 }),
  interpolate: identity,
  interpolateColor: identity,
  Extrapolation: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
  ReduceMotion: { System: 'system', Always: 'always', Never: 'never' },
  SharedValue: undefined,
  makeMutable: (value: unknown) => ({ value }),
};

module.exports = mock;
