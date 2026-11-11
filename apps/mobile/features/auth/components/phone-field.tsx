import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import {
  DsFontFamily,
  DsRadius,
  DsTypography,
  getDsTheme,
  type DsColorScheme,
} from '@/constants/design-system';

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

  return (
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
        onBlur={() => setFocused(false)}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        placeholder={placeholder}
        placeholderTextColor={ds.color.textTertiary}
        style={[styles.input, { color: ds.color.textPrimary }]}
        testID={testID}
        textContentType="telephoneNumber"
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
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
