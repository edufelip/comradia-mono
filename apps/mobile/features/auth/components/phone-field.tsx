import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  DsFontFamily,
  DsRadius,
  DsTypography,
  getDsTheme,
  type DsColorScheme,
} from '@/constants/design-system';
import { DS_MOTION } from '@/constants/motion';

type PhoneFieldProps = {
  scheme: DsColorScheme;
  value: string;
  onChangeText: (value: string) => void;
  /** Spoken name for the non-editable `🇧🇷 +55` prefix. */
  countryLabel: string;
  /** Spoken name and placeholder for the input itself. */
  phoneLabel: string;
  placeholder: string;
  testID?: string;
};

/**
 * The phone row for S1B: a fixed `🇧🇷 +55` prefix (Brazil only) next to the national
 * number, which the screen keeps formatted with `formatBR`.
 *
 * The row is the focus indicator: the input draws no ring of its own, so the visible
 * target is the whole control instead of a rectangle inside it (web).
 */
export function PhoneField({
  scheme,
  value,
  onChangeText,
  countryLabel,
  phoneLabel,
  placeholder,
  testID,
}: PhoneFieldProps) {
  const ds = getDsTheme(scheme);
  const [focused, setFocused] = useState(false);
  const reduceMotion = useReducedMotion();
  const focusProgress = useSharedValue(0);
  const focusStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + focusProgress.value * 0.006 }],
  }));
  const setFocus = (nextFocused: boolean) => {
    setFocused(nextFocused);
    focusProgress.value = reduceMotion
      ? 0
      : withTiming(nextFocused ? 1 : 0, {
          duration: DS_MOTION.duration.fast,
          easing: Easing.bezier(...DS_MOTION.easing.easeOut),
        });
  };

  return (
    <Animated.View
      style={[styles.motion, focusStyle]}
      testID={testID ? `${testID}.motion` : undefined}
    >
      <View
        style={[
          styles.row,
          {
            backgroundColor: ds.color.surface,
            borderColor: focused ? ds.color.accentPrimary : ds.color.borderStrong,
          },
        ]}
        testID={testID ? `${testID}.row` : undefined}
      >
        <View accessible accessibilityLabel={countryLabel} style={styles.prefix}>
          <Text style={[styles.prefixText, { color: ds.color.textSecondary }]}>🇧🇷 +55</Text>
        </View>
        <View style={[styles.separator, { backgroundColor: ds.color.border }]} />
        <TextInput
          accessibilityLabel={phoneLabel}
          autoComplete="tel"
          keyboardType="phone-pad"
          onBlur={() => setFocus(false)}
          onChangeText={onChangeText}
          onFocus={() => setFocus(true)}
          placeholder={placeholder}
          placeholderTextColor={ds.color.textTertiary}
          style={[styles.input, { color: ds.color.textPrimary }]}
          testID={testID}
          textContentType="telephoneNumber"
          value={value}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  motion: {
    width: '100%',
  },
  row: {
    alignItems: 'center',
    borderRadius: DsRadius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 52,
  },
  prefix: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 14,
  },
  prefixText: {
    ...DsTypography.button,
    fontFamily: DsFontFamily.semibold,
    fontSize: 14,
  },
  separator: {
    height: 24,
    width: 1,
  },
  input: {
    ...DsTypography.body,
    flex: 1,
    fontSize: 15,
    minHeight: 50,
    // The row owns the focus ring (see above); RN Web would otherwise draw a rectangle.
    outlineWidth: 0,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
});
