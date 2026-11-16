import { StyleSheet, Text, View } from 'react-native';
import { DsSpace, DsTypography, type DsColorScheme, getDsTheme } from '@/constants/design-system';
import { DsMotionPressable } from '../motion/DsMotionPressable';

type DsSectionHeaderProps = {
  scheme: DsColorScheme;
  label: string;
  /** `eyebrow` is a small uppercase kicker; `screenTitle` is a regular section title. */
  variant?: 'eyebrow' | 'screenTitle';
  /** Optional trailing action, e.g. "See all". The caller passes localized text. */
  action?: {
    label: string;
    onPress: () => void;
    /** Overrides the spoken name when the visible label alone is ambiguous. */
    accessibilityLabel?: string;
    testID?: string;
  };
  testID?: string;
};

/** Label that opens a group of content, with an optional trailing action. */
export function DsSectionHeader({
  scheme,
  label,
  variant = 'eyebrow',
  action,
  testID,
}: DsSectionHeaderProps) {
  const ds = getDsTheme(scheme);
  const labelStyle =
    variant === 'eyebrow'
      ? [DsTypography.eyebrow, { color: ds.color.textTertiary }]
      : [DsTypography.screenTitle, { color: ds.color.textPrimary }];

  return (
    <View style={styles.row} testID={testID}>
      <Text accessibilityRole="header" style={[styles.label, labelStyle]}>
        {label}
      </Text>
      {action ? (
        <DsMotionPressable
          accessibilityLabel={action.accessibilityLabel ?? action.label}
          accessibilityRole="button"
          onPress={action.onPress}
          style={styles.action}
          testID={action.testID}
        >
          <Text style={[DsTypography.button, { color: ds.color.accentText }]}>{action.label}</Text>
        </DsMotionPressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: DsSpace.sm,
    justifyContent: 'space-between',
    paddingBottom: DsSpace.sm,
    paddingTop: DsSpace.xl,
  },
  label: {
    flexShrink: 1,
  },
  action: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: DsSpace.xs,
  },
});
