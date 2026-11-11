import { Pressable, StyleSheet, View } from 'react-native';
import { DsRadius, getDsTheme, type DsColorScheme } from '@/constants/design-system';

type OnboardingSwitchProps = {
  scheme: DsColorScheme;
  testID: string;
  accessibilityLabel: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
};

const TRACK_WIDTH = 44;
const TRACK_HEIGHT = 26;
const THUMB = 20;

/**
 * The union badge toggle from the chart (`.sw`). A small switch of our own rather than
 * RN's `Switch`: its web build paints the "on" thumb Material teal (`#009688`), and the
 * thumb colour of a checked switch cannot be themed from React Native. Role, checked
 * state and the spoken name stay the platform ones.
 */
export function OnboardingSwitch({
  scheme,
  testID,
  accessibilityLabel,
  value,
  onValueChange,
}: OnboardingSwitchProps) {
  const ds = getDsTheme(scheme);

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      aria-checked={value}
      onPress={() => onValueChange(!value)}
      style={styles.hitArea}
      testID={testID}
    >
      <View
        style={[
          styles.track,
          { backgroundColor: value ? ds.color.accentPrimary : ds.color.disabledBorder },
        ]}
      >
        <View style={[styles.thumb, { transform: [{ translateX: value ? 18 : 0 }] }]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hitArea: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 44,
  },
  track: {
    borderRadius: DsRadius.pill,
    height: TRACK_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 3,
    width: TRACK_WIDTH,
  },
  thumb: {
    backgroundColor: '#ffffff',
    borderRadius: THUMB / 2,
    height: THUMB,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    width: THUMB,
  },
});
