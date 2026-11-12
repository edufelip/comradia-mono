import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { NotificationSettings } from '@/features/notifications/NotificationSettings';
import { useNotificationSettings } from '@/features/notifications/use-notification-settings';
import { notificationMockApi } from './mocks/notifications';

jest.mock('@/localization/get-device-locale', () => ({ getDeviceLocale: () => 'en-US' }));

function SettingsHarness() {
  return <NotificationSettings {...useNotificationSettings('alice')} />;
}

it('lets the user retry disabling after token revocation fails without enabling again', async () => {
  notificationMockApi.getNotificationSettings.mockResolvedValue('enabled');
  notificationMockApi.disableNotifications.mockRejectedValueOnce(new Error('offline'));
  await render(<SettingsHarness />);
  await fireEvent.press(await screen.findByTestId('notifications-disable'));
  await screen.findByTestId('notifications-status');
  await waitFor(() => expect(notificationMockApi.disableNotifications).toHaveBeenCalledTimes(1));
  expect(screen.queryByTestId('notifications-enable')).toBeNull();
  await fireEvent.press(screen.getByTestId('notifications-disable'));
  await waitFor(() => expect(notificationMockApi.disableNotifications).toHaveBeenCalledTimes(2));
  expect(notificationMockApi.enableNotifications).not.toHaveBeenCalled();
});
