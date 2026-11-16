import { MaterialIcons } from '@expo/vector-icons';
import { useState, type ReactNode } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  DsBorder,
  DsIconSize,
  DsLayout,
  DsRadius,
  DsSpace,
  DsTypography,
  getDsTheme,
  type DsColorScheme,
} from '@/constants/design-system';
import { DS_MOTION } from '@/constants/motion';

type DsTextFieldProps = Omit<
  TextInputProps,
  | 'style'
  | 'value'
  | 'onChangeText'
  | 'editable'
  | 'readOnly'
  | 'placeholderTextColor'
  | 'accessibilityLabel'
  | 'testID'
> & {
  scheme: DsColorScheme;
  value: string;
  onChangeText: (value: string) => void;
  /** Visible label above the field; also its accessible name unless `accessibilityLabel` is set. */
  label?: string;
  /** Spoken name when there is no visible label, or when it needs to say more. */
  accessibilityLabel?: string;
  /** Guidance under the field. Replaced by `errorText` while there is an error. */
  helperText?: string;
  /** Error under the field, with an icon, announced as an alert. Turns the border red. */
  errorText?: string;
  /** Content before the input inside the row, e.g. a country code. */
  prefix?: ReactNode;
  /** Content after the input inside the row, e.g. a clear button or a unit. */
  suffix?: ReactNode;
  disabled?: boolean;
  readOnly?: boolean;
  /** Test id of the input. Also `.row`, `.motion`, `-label`, `-helper` and `-error`. */
  testID?: string;
  /** Style of the outer wrapper (label, row and message). */
  style?: StyleProp<ViewStyle>;
};

const MULTILINE_MIN_HEIGHT = 96;

/**
 * A text field: optional label, a row with optional prefix and suffix, and a helper or error
 * line. The row, not the input, draws the focus border (the input has no outline of its own),
 * so the visible target is the whole control. States: default, focused, error, disabled,
 * read-only. Focus nudges the row by a hair unless Reduce Motion is on.
 */
export function DsTextField({
  scheme,
  value,
  onChangeText,
  label,
  accessibilityLabel,
  helperText,
  errorText,
  prefix,
  suffix,
  disabled = false,
  readOnly = false,
  multiline = false,
  testID,
  style,
  onFocus,
  onBlur,
  ...inputProps
}: DsTextFieldProps) {
  const ds = getDsTheme(scheme);
  const [focused, setFocused] = useState(false);
  const reduceMotion = useReducedMotion();
  const focusProgress = useSharedValue(0);
  const focusStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + focusProgress.value * 0.006 }],
  }));
  const setFocus = (next: boolean) => {
    setFocused(next);
    focusProgress.value = reduceMotion
      ? 0
      : withTiming(next ? 1 : 0, {
          duration: DS_MOTION.duration.fast,
          easing: Easing.bezier(...DS_MOTION.easing.easeOut),
        });
  };

  const hasError = Boolean(errorText);
  const editable = !disabled && !readOnly;
  const backgroundColor = disabled
    ? ds.color.disabledSurface
    : readOnly
      ? ds.color.surfaceMuted
      : ds.color.surface;
  const borderColor = hasError
    ? ds.color.danger
    : disabled
      ? ds.color.disabledBorder
      : focused
        ? ds.color.accentPrimary
        : ds.color.borderStrong;
  const textColor = disabled
    ? ds.color.disabledText
    : readOnly
      ? ds.color.readOnlyText
      : ds.color.textPrimary;
  const name = accessibilityLabel ?? label;

  return (
    <View style={[styles.wrapper, style]}>
      {label ? (
        <Text
          style={[DsTypography.caption, { color: ds.color.textSecondary }]}
          testID={testID ? `${testID}-label` : undefined}
        >
          {label}
        </Text>
      ) : null}

      <Animated.View
        style={[styles.motion, focusStyle]}
        testID={testID ? `${testID}.motion` : undefined}
      >
        <View
          style={[
            styles.row,
            multiline ? styles.rowMultiline : null,
            {
              backgroundColor,
              borderColor,
              borderWidth: focused || hasError ? DsBorder.strong : DsBorder.hairline,
            },
          ]}
          testID={testID ? `${testID}.row` : undefined}
        >
          {prefix ? <View style={styles.prefix}>{prefix}</View> : null}
          <TextInput
            {...inputProps}
            accessibilityLabel={name}
            accessibilityState={{ disabled }}
            editable={editable}
            multiline={multiline}
            onBlur={(event) => {
              setFocus(false);
              onBlur?.(event);
            }}
            onChangeText={onChangeText}
            onFocus={(event) => {
              setFocus(true);
              onFocus?.(event);
            }}
            placeholderTextColor={ds.color.textTertiary}
            readOnly={readOnly}
            style={[
              DsTypography.input,
              styles.input,
              multiline ? styles.inputMultiline : null,
              { color: textColor },
            ]}
            testID={testID}
            textAlignVertical={multiline ? 'top' : undefined}
            value={value}
          />
          {suffix ? <View style={styles.suffix}>{suffix}</View> : null}
        </View>
      </Animated.View>

      {hasError ? (
        <View
          accessible
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          style={styles.message}
          testID={testID ? `${testID}-error` : undefined}
        >
          <MaterialIcons
            aria-hidden
            color={ds.color.danger}
            name="error-outline"
            size={DsIconSize.sm}
          />
          <Text style={[DsTypography.caption, styles.messageText, { color: ds.color.danger }]}>
            {errorText}
          </Text>
        </View>
      ) : helperText ? (
        <Text
          style={[DsTypography.caption, { color: ds.color.textSecondary }]}
          testID={testID ? `${testID}-helper` : undefined}
        >
          {helperText}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: DsSpace.xs,
    width: '100%',
  },
  motion: {
    width: '100%',
  },
  row: {
    alignItems: 'center',
    borderRadius: DsRadius.lg,
    flexDirection: 'row',
    minHeight: DsLayout.fieldHeight,
  },
  rowMultiline: {
    alignItems: 'flex-start',
    minHeight: MULTILINE_MIN_HEIGHT,
  },
  prefix: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingLeft: DsSpace.md,
  },
  suffix: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingRight: DsSpace.md,
  },
  input: {
    flex: 1,
    minHeight: DsLayout.fieldHeight - DsBorder.strong * 2,
    // The row owns the focus ring (see above); RN Web would otherwise draw a rectangle.
    outlineWidth: 0,
    paddingHorizontal: DsSpace.md,
    paddingVertical: DsSpace.sm,
  },
  inputMultiline: {
    minHeight: MULTILINE_MIN_HEIGHT - DsBorder.strong * 2,
  },
  message: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: DsSpace.xxs,
  },
  messageText: {
    flex: 1,
  },
});
