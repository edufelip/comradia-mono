import { useRef } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { DsMotionView } from '@/components/ds/motion/DsMotionView';
import { DsFontFamily, DsRadius, getDsTheme, type DsColorScheme } from '@/constants/design-system';
import { DS_MOTION } from '@/constants/motion';

const CODE_LENGTH = 6;

type CodeFieldProps = {
  scheme: DsColorScheme;
  value: string;
  onChangeText: (digits: string) => void;
  /** Spoken name for the input; the six boxes are decorative. */
  label: string;
  testID?: string;
};

/**
 * Six boxes around one real `TextInput`, so the code is a single accessible field with
 * `textContentType` / `autoComplete` hints rather than six separate inputs. The input
 * sits transparently on top and receives every tap, which also makes it focusable with
 * a mouse on web and drives the keyboard on native.
 */
export function CodeField({ scheme, value, onChangeText, label, testID }: CodeFieldProps) {
  const ds = getDsTheme(scheme);
  const inputRef = useRef<TextInput>(null);
  const reduceMotion = useReducedMotion();
  const focusProgress = useSharedValue(0);
  const focusStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + focusProgress.value * 0.006 }],
  }));
  const activeIndex = Math.min(value.length, CODE_LENGTH - 1);
  const updateFocus = (focused: boolean) => {
    focusProgress.value = reduceMotion
      ? 0
      : withTiming(focused ? 1 : 0, {
          duration: DS_MOTION.duration.fast,
          easing: Easing.bezier(...DS_MOTION.easing.easeOut),
        });
  };

  return (
    <View style={styles.wrap}>
      <Animated.View
        aria-hidden
        style={[styles.boxes, focusStyle]}
        testID={testID ? `${testID}.motion` : undefined}
      >
        {Array.from({ length: CODE_LENGTH }, (_, index) => {
          const isActive = index === activeIndex && value.length < CODE_LENGTH;
          const isFilled = index < value.length;
          const digit = value[index] ?? '';
          const digitContent = (
            <Text style={[styles.digit, { color: ds.color.textPrimary }]}>{digit}</Text>
          );

          return (
            <View
              key={index}
              style={[
                styles.box,
                {
                  backgroundColor: isFilled ? ds.color.surfaceMuted : ds.color.surface,
                  borderColor:
                    isActive || isFilled ? ds.color.accentPrimary : ds.color.borderStrong,
                  borderWidth: isActive ? 2 : 1,
                },
              ]}
            >
              {index === CODE_LENGTH - 1 && value.length === CODE_LENGTH ? (
                <DsMotionView
                  testID={testID ? `${testID}.complete-motion` : undefined}
                  variant="scale"
                >
                  {digitContent}
                </DsMotionView>
              ) : (
                digitContent
              )}
            </View>
          );
        })}
      </Animated.View>
      <TextInput
        accessibilityLabel={label}
        autoComplete="sms-otp"
        autoFocus
        caretHidden
        keyboardType="number-pad"
        maxLength={CODE_LENGTH}
        onBlur={() => updateFocus(false)}
        onChangeText={onChangeText}
        onFocus={() => updateFocus(true)}
        ref={inputRef}
        style={styles.input}
        testID={testID}
        textContentType="oneTimeCode"
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 58,
    justifyContent: 'center',
    position: 'relative',
  },
  boxes: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  box: {
    alignItems: 'center',
    borderRadius: DsRadius.md,
    flex: 1,
    height: 58,
    justifyContent: 'center',
    maxWidth: 56,
  },
  digit: {
    fontFamily: DsFontFamily.semibold,
    fontSize: 24,
    lineHeight: 30,
    fontVariant: ['tabular-nums'],
  },
  input: {
    // Invisible but interactive: it owns the taps, the caret and the keyboard.
    bottom: 0,
    color: 'transparent',
    fontSize: 24,
    left: 0,
    position: 'absolute',
    right: 0,
    textAlign: 'center',
    top: 0,
  },
});
