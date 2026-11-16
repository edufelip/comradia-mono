import {
  ActivityIndicator,
  StyleSheet,
  Text,
  type ColorValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  DsBorder,
  DsLayout,
  DsRadius,
  DsSpace,
  DsTypography,
  type DsColorScheme,
  getDsTheme,
} from '@/constants/design-system';
import { DsMotionPressable } from '../motion/DsMotionPressable';
import type { ReactNode } from 'react';

type DsPillButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
type DsPillButtonSize = 'xs' | 'sm' | 'md';

type DsPillButtonProps = {
  scheme: DsColorScheme;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: DsPillButtonVariant;
  size?: DsPillButtonSize;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  testID?: string;
  style?: StyleProp<ViewStyle>;
  fullWidth?: boolean;
  contentColor?: ColorValue;
  /** Overrides the spoken name when the visible label alone is ambiguous. */
  accessibilityLabel?: string;
  /** Marks a selectable pill as active. */
  selected?: boolean;
};

export function DsPillButton({
  scheme,
  label,
  onPress,
  disabled = false,
  loading = false,
  variant = 'primary',
  size = 'md',
  leftIcon,
  rightIcon,
  testID,
  style,
  fullWidth = true,
  contentColor,
  accessibilityLabel,
  selected,
}: DsPillButtonProps) {
  const theme = getDsTheme(scheme);
  const isPrimary = variant === 'primary';
  const isOutline = variant === 'outline';
  const isGhost = variant === 'ghost';
  const isSmall = size === 'sm';
  const isExtraSmall = size === 'xs';

  const resolvedContentColor = disabled
    ? theme.color.disabledText
    : (contentColor ??
      (selected
        ? isPrimary
          ? theme.color.onActionPrimary
          : theme.color.accentText
        : isPrimary
          ? theme.color.onActionPrimary
          : theme.color.textPrimary));

  const getVariantStyles = () => {
    if (disabled) {
      if (isOutline || isGhost) {
        return {
          backgroundColor: 'transparent',
          borderColor: theme.color.disabledBorder,
          borderWidth: isOutline ? DsBorder.strong : 0,
        };
      }

      return {
        backgroundColor: theme.color.disabledSurface,
        borderColor: theme.color.disabledBorder,
        borderWidth: DsBorder.hairline,
      };
    }

    if (selected) {
      return isPrimary
        ? {
            backgroundColor: theme.color.accentPrimary,
            borderColor: theme.color.accentPrimary,
          }
        : {
            backgroundColor: theme.color.accentPrimarySoft,
            borderColor: theme.color.accentPrimary,
            borderWidth: DsBorder.strong,
          };
    }

    if (isPrimary) {
      return {
        backgroundColor: theme.color.actionPrimary,
        borderColor: theme.color.actionPrimary,
      };
    }
    if (isOutline) {
      return {
        backgroundColor: 'transparent',
        borderColor: theme.color.borderStrong,
        borderWidth: DsBorder.strong,
      };
    }
    if (isGhost) {
      return {
        backgroundColor: 'transparent',
        borderColor: 'transparent',
      };
    }
    return {
      backgroundColor: theme.color.surfaceMuted,
      borderColor: theme.color.surfaceMuted,
      borderWidth: DsBorder.hairline,
    };
  };

  const getSizeStyles = () => {
    if (isExtraSmall) return styles.buttonXs;
    if (isSmall) return styles.buttonSm;
    return styles.buttonMd;
  };

  const getTextSizeStyles = () => {
    if (isExtraSmall) return styles.textXs;
    return styles.text;
  };

  return (
    <DsMotionPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{
        busy: loading,
        disabled: disabled || loading,
        ...(selected === undefined ? {} : { selected }),
      }}
      disabled={disabled || loading}
      hitSlop={1}
      onPress={onPress}
      style={[
        styles.button,
        getSizeStyles(),
        getVariantStyles(),
        { width: fullWidth ? '100%' : undefined },
        style,
      ]}
      testID={testID}
    >
      {loading ? (
        <ActivityIndicator color={resolvedContentColor} size="small" />
      ) : (
        <>
          {leftIcon}
          <Text
            style={[styles.text, getTextSizeStyles(), { color: resolvedContentColor }]}
            testID={testID ? `${testID}.label` : undefined}
          >
            {label}
          </Text>
          {rightIcon}
        </>
      )}
    </DsMotionPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: DsRadius.pill,
    flexDirection: 'row',
    gap: DsSpace.xs,
    justifyContent: 'center',
    paddingHorizontal: DsSpace.md,
  },
  buttonMd: {
    minHeight: DsLayout.controlHeight,
  },
  buttonSm: {
    minHeight: DsLayout.minTouchTarget,
  },
  buttonXs: {
    minHeight: DsLayout.minTouchTarget,
    paddingHorizontal: DsSpace.sm,
  },
  text: {
    ...DsTypography.button,
    // A long label (German, French, 200% text) wraps inside the pill instead of pushing it wider than its row.
    flexShrink: 1,
    textAlign: 'center',
  },
  textXs: DsTypography.chip,
});
