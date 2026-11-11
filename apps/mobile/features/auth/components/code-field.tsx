import { useRef } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { DsFontFamily, DsRadius, getDsTheme, type DsColorScheme } from '@/constants/design-system';

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
  const activeIndex = Math.min(value.length, CODE_LENGTH - 1);

  return (
    <View style={styles.wrap}>
      <View aria-hidden style={styles.boxes}>
        {Array.from({ length: CODE_LENGTH }, (_, index) => {
          const isActive = index === activeIndex && value.length < CODE_LENGTH;
          return (
            <View
              key={index}
              style={[
                styles.box,
                {
                  backgroundColor: ds.color.surface,
                  borderColor: isActive ? ds.color.accentPrimary : ds.color.borderStrong,
                  borderWidth: isActive ? 2 : 1,
                },
              ]}
            >
              <Text style={[styles.digit, { color: ds.color.textPrimary }]}>
                {value[index] ?? ''}
              </Text>
            </View>
          );
        })}
      </View>
      <TextInput
        accessibilityLabel={label}
        autoComplete="sms-otp"
        autoFocus
        caretHidden
        keyboardType="number-pad"
        maxLength={CODE_LENGTH}
        onChangeText={onChangeText}
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
    opacity: 0,
    position: 'absolute',
    right: 0,
    textAlign: 'center',
    top: 0,
  },
});
