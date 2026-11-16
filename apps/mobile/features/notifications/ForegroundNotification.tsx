import { DsNotice } from '@/components/ds/primitives/DsNotice';
import { DsPillButton } from '@/components/ds/primitives/DsPillButton';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTranslation } from '@/localization';

type ForegroundNotificationProps = {
  type: 'match' | 'message';
  onView: () => void;
  onDismiss: () => void;
  closing?: boolean;
  noticeId?: number;
  onExitComplete?: (noticeId: number) => void;
};

/** Generic in-app notice for pushes received while Comradia is open. */
export function ForegroundNotification({
  type,
  onView,
  onDismiss,
  closing = false,
  noticeId = 0,
  onExitComplete,
}: ForegroundNotificationProps) {
  const colorScheme = useColorScheme();
  const scheme = colorScheme === 'dark' ? 'dark' : 'light';
  const { t } = useTranslation();

  return (
    <DsNotice
      actions={
        <>
          <DsPillButton
            disabled={closing}
            label={t('notifications.view')}
            onPress={onView}
            scheme={scheme}
            size="sm"
            testID="notifications-foreground-view"
            variant="primary"
          />
          <DsPillButton
            disabled={closing}
            label={t('notifications.dismiss')}
            onPress={onDismiss}
            scheme={scheme}
            size="sm"
            testID="notifications-foreground-dismiss"
            variant="ghost"
          />
        </>
      }
      closing={closing}
      onExitComplete={onExitComplete ? () => onExitComplete(noticeId) : undefined}
      overlay
      scheme={scheme}
      testID="notifications-foreground"
      title={t(
        type === 'match' ? 'notifications.foreground.match' : 'notifications.foreground.message',
      )}
      tone="info"
      urgency="alert"
    />
  );
}
