import { MaterialIcons } from '@expo/vector-icons';
import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  DsIconSize,
  DsRadius,
  DsSpace,
  DsTypography,
  type DsColorScheme,
  getDsTheme,
} from '@/constants/design-system';
import { DsDivider } from './DsDivider';
import { DsMotionPressable } from '../motion/DsMotionPressable';

type DsListRowProps = {
  scheme: DsColorScheme;
  title: string;
  subtitle?: string;
  /** Usually a `DsAvatar`. */
  leading?: ReactNode;
  /** Meta such as a time. Shown before the chevron. */
  trailing?: ReactNode;
  /** Shows a chevron at the end. */
  chevron?: boolean;
  onPress: () => void;
  /** Adds an accent dot and says `unreadLabel` first in the spoken name. */
  unread?: boolean;
  /** Localized word for unread ("Unread"). Needed when `unread` is set. */
  unreadLabel?: string;
  disabled?: boolean;
  /** Draws a hairline under the row, inset to the text. */
  divider?: boolean;
  /** Overrides the combined spoken name. Defaults to unread, title and subtitle. */
  accessibilityLabel?: string;
  testID?: string;
};

/** One tappable row of a list: leading visual, title, subtitle, trailing meta or chevron. */
export function DsListRow({
  scheme,
  title,
  subtitle,
  leading,
  trailing,
  chevron = false,
  onPress,
  unread = false,
  unreadLabel,
  disabled = false,
  divider = false,
  accessibilityLabel,
  testID,
}: DsListRowProps) {
  const ds = getDsTheme(scheme);
  const [leadingWidth, setLeadingWidth] = useState(0);
  const name =
    accessibilityLabel ??
    [unread ? unreadLabel : undefined, title, subtitle].filter(Boolean).join(', ');

  return (
    <View>
      <DsMotionPressable
        accessibilityLabel={name}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        style={[styles.row, disabled ? styles.disabled : null]}
        testID={testID}
      >
        {leading ? (
          <View onLayout={(event) => setLeadingWidth(event.nativeEvent.layout.width)}>
            {leading}
          </View>
        ) : null}
        <View style={styles.text}>
          <Text
            numberOfLines={2}
            style={[DsTypography.cardTitle, { color: ds.color.textPrimary }]}
            testID={testID ? `${testID}-title` : undefined}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              numberOfLines={2}
              style={[DsTypography.caption, { color: ds.color.textSecondary }]}
              testID={testID ? `${testID}-subtitle` : undefined}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
        {unread ? (
          <View
            aria-hidden
            style={[styles.dot, { backgroundColor: ds.color.accentPrimary }]}
            testID={testID ? `${testID}-unread` : undefined}
          />
        ) : null}
        {trailing}
        {chevron ? (
          <MaterialIcons
            aria-hidden
            color={ds.color.textTertiary}
            name="chevron-right"
            size={DsIconSize.lg}
          />
        ) : null}
      </DsMotionPressable>
      {divider ? (
        <DsDivider
          inset={DsSpace.md + leadingWidth + (leading ? DsSpace.sm : 0)}
          scheme={scheme}
          testID={testID ? `${testID}-divider` : undefined}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    borderRadius: DsRadius.sm,
    flexDirection: 'row',
    gap: DsSpace.sm,
    minHeight: 64,
    paddingHorizontal: DsSpace.md,
    paddingVertical: DsSpace.sm,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    flex: 1,
    gap: DsSpace.xxs,
    minWidth: 0,
  },
  dot: {
    borderRadius: DsRadius.pill,
    height: DsSpace.xs,
    width: DsSpace.xs,
  },
});
