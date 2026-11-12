import { StyleSheet, Text, View } from 'react-native';

import { DsCard } from '@/components/ds/primitives/DsCard';
import { DsMotionView } from '@/components/ds/motion/DsMotionView';
import { DsPillButton } from '@/components/ds/primitives/DsPillButton';
import { DsSpace, DsTypography, getDsTheme } from '@/constants/design-system';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTranslation } from '@/localization';

type ForegroundNotificationProps = {
  type: 'match' | 'message';
  onView: () => void;
  onDismiss: () => void;
};

/** Generic in-app notice for pushes received while Comradia is open. */
export function ForegroundNotification({ type, onView, onDismiss }: ForegroundNotificationProps) {
  const colorScheme = useColorScheme();
  const scheme = colorScheme === 'dark' ? 'dark' : 'light';
  const theme = getDsTheme(scheme);
  const { t } = useTranslation();

  return (
    <DsMotionView testID="notifications-foreground-motion" variant="reveal">
      <DsCard scheme={scheme} style={styles.card} testID="notifications-foreground">
        <Text
          accessibilityRole="alert"
          style={[DsTypography.cardTitle, { color: theme.color.textPrimary }]}
        >
          {t(
            type === 'match'
              ? 'notifications.foreground.match'
              : 'notifications.foreground.message',
          )}
        </Text>
        <View style={styles.actions}>
          <DsPillButton
            label={t('notifications.view')}
            onPress={onView}
            scheme={scheme}
            size="sm"
            testID="notifications-foreground-view"
            variant="primary"
          />
          <DsPillButton
            label={t('notifications.dismiss')}
            onPress={onDismiss}
            scheme={scheme}
            size="sm"
            testID="notifications-foreground-dismiss"
            variant="ghost"
          />
        </View>
      </DsCard>
    </DsMotionView>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: DsSpace.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: DsSpace.xs,
  },
});
