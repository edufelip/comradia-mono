import { MaterialIcons } from '@expo/vector-icons';
import { StyleSheet } from 'react-native';
import { DsRadius, type DsColorScheme, getDsTheme } from '@/constants/design-system';
import { DsMotionPressable } from '../motion/DsMotionPressable';

type IconName = keyof typeof MaterialIcons.glyphMap;

type DsIconButtonProps = {
  scheme: DsColorScheme;
  icon: IconName;
  onPress: () => void;
  accessibilityLabel: string;
  testID?: string;
  size?: number;
};

export function DsIconButton({
  scheme,
  icon,
  onPress,
  accessibilityLabel,
  testID,
  size = 42,
}: DsIconButtonProps) {
  const theme = getDsTheme(scheme);

  return (
    <DsMotionPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      feedbackScale={0.95}
      hitSlop={1}
      onPress={onPress}
      style={[
        styles.button,
        {
          width: size,
          height: size,
          borderRadius: DsRadius.pill,
          backgroundColor: theme.color.surface,
        },
      ]}
      testID={testID}
    >
      <MaterialIcons color={theme.color.textPrimary} name={icon} size={20} />
    </DsMotionPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
