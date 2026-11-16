import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { DsBorder, type DsColorScheme, getDsTheme } from '@/constants/design-system';

type DsDividerProps = {
  scheme: DsColorScheme;
  /** Use on a `surfaceMuted` background, where `border` is too faint. */
  onMuted?: boolean;
  /** Space kept clear on the leading edge, e.g. to start at the text of a list row. */
  inset?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** A 1 pt line. Decorative: hidden from assistive technology. */
export function DsDivider({ scheme, onMuted = false, inset = 0, style, testID }: DsDividerProps) {
  const ds = getDsTheme(scheme);

  return (
    <View
      accessibilityElementsHidden
      aria-hidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.line,
        { backgroundColor: onMuted ? ds.color.borderStrong : ds.color.border, marginLeft: inset },
        style,
      ]}
      testID={testID}
    />
  );
}

const styles = StyleSheet.create({
  line: {
    height: DsBorder.hairline,
    alignSelf: 'stretch',
  },
});
