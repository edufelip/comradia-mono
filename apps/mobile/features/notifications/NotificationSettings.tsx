import { StyleSheet, Text, View } from 'react-native';
import { DsMotionView } from '@/components/ds/motion/DsMotionView';
import { DsCard } from '@/components/ds/primitives/DsCard';
import { DsPillButton } from '@/components/ds/primitives/DsPillButton';
import { DsSpace, DsTypography, getDsTheme } from '@/constants/design-system';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTranslation } from '@/localization';

export type NotificationSettingsStatus =
  'loading' | 'enabled' | 'disabled' | 'denied' | 'error' | 'unavailable';

type NotificationSettingsProps = {
  status: NotificationSettingsStatus;
  busy?: boolean;
  errorAction?: 'enable' | 'disable' | 'settings';
  motionActive?: boolean;
  onEnable: () => void;
  onDisable: () => void;
  onOpenSettings: () => void;
};

/** Profile's explicit push opt-in; permission prompts are always behind the enable tap. */
export function NotificationSettings({
  status,
  busy = false,
  errorAction = 'enable',
  motionActive = true,
  onEnable,
  onDisable,
  onOpenSettings,
}: NotificationSettingsProps) {
  const colorScheme = useColorScheme();
  const scheme = colorScheme === 'dark' ? 'dark' : 'light';
  const theme = getDsTheme(scheme);
  const { t } = useTranslation();

  const copyKey =
    status === 'enabled'
      ? 'notifications.status.enabled'
      : status === 'disabled'
        ? 'notifications.status.disabled'
        : status === 'denied'
          ? 'notifications.permission_denied'
          : status === 'error'
            ? 'notifications.error'
            : status === 'loading'
              ? 'notifications.loading'
              : 'notifications.unavailable';

  return (
    <DsMotionView
      active={motionActive}
      key={status}
      testID="notifications-settings-motion"
      variant="scale"
    >
      <DsCard scheme={scheme} style={styles.card} testID="notifications-settings">
        <View style={styles.copy}>
          <Text
            accessibilityRole="header"
            style={[DsTypography.cardTitle, { color: theme.color.textPrimary }]}
          >
            {t('notifications.title')}
          </Text>
          <Text style={[DsTypography.body, { color: theme.color.textSecondary }]}>
            {t('notifications.body')}
          </Text>
          <Text
            accessibilityLiveRegion="polite"
            style={[
              DsTypography.caption,
              { color: status === 'error' ? theme.color.danger : theme.color.textPrimary },
            ]}
            testID="notifications-status"
          >
            {t(copyKey)}
          </Text>
        </View>

        {status === 'disabled' || (status === 'error' && errorAction === 'enable') ? (
          <DsPillButton
            disabled={busy}
            label={t('notifications.enable')}
            loading={busy}
            onPress={onEnable}
            scheme={scheme}
            testID="notifications-enable"
            variant="primary"
          />
        ) : null}
        {status === 'enabled' || (status === 'error' && errorAction === 'disable') ? (
          <DsPillButton
            disabled={busy}
            label={t('notifications.disable')}
            loading={busy}
            onPress={onDisable}
            scheme={scheme}
            testID="notifications-disable"
            variant="secondary"
          />
        ) : null}
        {status === 'denied' || (status === 'error' && errorAction === 'settings') ? (
          <View style={styles.actions}>
            <DsPillButton
              disabled={busy}
              label={t('notifications.open_settings')}
              loading={busy}
              onPress={onOpenSettings}
              scheme={scheme}
              testID="notifications-open-settings"
              variant="secondary"
            />
            <DsPillButton
              disabled={busy}
              label={t('notifications.disable')}
              onPress={onDisable}
              scheme={scheme}
              testID="notifications-disable"
              variant="ghost"
            />
          </View>
        ) : null}
      </DsCard>
    </DsMotionView>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: DsSpace.sm,
  },
  copy: {
    gap: DsSpace.xs,
  },
  actions: {
    gap: DsSpace.xs,
  },
});
