import { StyleSheet, Text, View } from 'react-native';
import { DsTextField } from '@/components/ds/primitives/DsTextField';
import { DsSpace, DsTypography, getDsTheme, type DsColorScheme } from '@/constants/design-system';

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
 * number, which the screen keeps formatted with `formatBR`. A `DsTextField` with the
 * prefix and the right keyboard hints; the row draws the focus border.
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

  return (
    <DsTextField
      accessibilityLabel={phoneLabel}
      autoComplete="tel"
      keyboardType="phone-pad"
      onChangeText={onChangeText}
      placeholder={placeholder}
      prefix={
        <>
          <View accessible accessibilityLabel={countryLabel} style={styles.prefix}>
            <Text style={[DsTypography.button, { color: ds.color.textSecondary }]}>🇧🇷 +55</Text>
          </View>
          <View style={[styles.separator, { backgroundColor: ds.color.border }]} />
        </>
      }
      scheme={scheme}
      testID={testID}
      textContentType="telephoneNumber"
      value={value}
    />
  );
}

const styles = StyleSheet.create({
  prefix: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingRight: DsSpace.md,
  },
  separator: {
    height: DsSpace.xl,
    width: 1,
  },
});
