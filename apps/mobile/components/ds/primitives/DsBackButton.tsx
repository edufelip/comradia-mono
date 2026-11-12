import { MaterialIcons } from '@expo/vector-icons';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { DsRadius, type DsColorScheme, getDsTheme } from '@/constants/design-system';
import { DsMotionPressable } from '../motion/DsMotionPressable';

type DsBackButtonProps = {
  scheme: DsColorScheme;
  onPress: () => void;
  testID?: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export function DsBackButton({
  scheme,
  onPress,
  testID,
  accessibilityLabel,
  style,
}: DsBackButtonProps) {
  const theme = getDsTheme(scheme);

  return (
    <DsMotionPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      feedbackScale={0.95}
      hitSlop={4}
      onPress={onPress}
      style={[
        styles.button,
        {
          backgroundColor: theme.color.surface,
        },
        style,
      ]}
      testID={testID}
    >
      <MaterialIcons color={theme.color.textPrimary} name="arrow-back" size={20} />
    </DsMotionPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: DsRadius.pill,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
});
