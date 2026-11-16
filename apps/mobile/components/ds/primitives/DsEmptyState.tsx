import { StyleSheet, Text } from 'react-native';
import { DsSpace, DsTypography, type DsColorScheme, getDsTheme } from '@/constants/design-system';
import { DsCard } from './DsCard';
import { DsPillButton } from './DsPillButton';

type DsEmptyStateProps = {
  scheme: DsColorScheme;
  /** What is empty. */
  title: string;
  /** Why, in one warm line. */
  body: string;
  /** What the one action does, e.g. "Go to Discover". Omit when there is nothing to do. */
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
  actionTestID?: string;
};

/** One card for an empty list: a header, one line of why, and at most one action. */
export function DsEmptyState({
  scheme,
  title,
  body,
  actionLabel,
  onAction,
  testID,
  actionTestID,
}: DsEmptyStateProps) {
  const ds = getDsTheme(scheme);

  return (
    <DsCard scheme={scheme} style={styles.card} testID={testID}>
      <Text
        accessibilityRole="header"
        style={[DsTypography.cardTitle, { color: ds.color.textPrimary }]}
      >
        {title}
      </Text>
      <Text style={[DsTypography.body, { color: ds.color.textSecondary }]}>{body}</Text>
      {actionLabel && onAction ? (
        <DsPillButton
          label={actionLabel}
          onPress={onAction}
          scheme={scheme}
          testID={actionTestID}
          variant="primary"
        />
      ) : null}
    </DsCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: DsSpace.sm,
  },
});
