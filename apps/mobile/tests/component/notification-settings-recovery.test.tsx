import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { NotificationSettings } from '@/features/notifications/NotificationSettings';
import { useNotificationSettings } from '@/features/notifications/use-notification-settings';
import { notificationMockApi } from './mocks/notifications';
import { enUS } from '@/localization/en-US';

jest.mock('@/localization/get-device-locale', () => ({ getDeviceLocale: () => 'en-US' }));

function SettingsHarness({ uid }: { uid?: string }) {
  return <NotificationSettings {...useNotificationSettings(uid)} />;
}

beforeEach(() => {
  notificationMockApi.getNotificationSettings.mockReset().mockResolvedValue('disabled');
  notificationMockApi.enableNotifications.mockReset().mockResolvedValue('authorized');
  notificationMockApi.disableNotifications.mockReset().mockResolvedValue(undefined);
  notificationMockApi.openNotificationSettings.mockReset().mockResolvedValue(undefined);
});

it('lets the user retry disabling after token revocation fails without enabling again', async () => {
  notificationMockApi.getNotificationSettings.mockResolvedValue('enabled');
  notificationMockApi.disableNotifications.mockRejectedValueOnce(new Error('offline'));
  await render(<SettingsHarness uid="alice" />);
  await fireEvent.press(await screen.findByTestId('notifications-disable'));
  await screen.findByTestId('notifications-status');
  await waitFor(() => expect(notificationMockApi.disableNotifications).toHaveBeenCalledTimes(1));
  expect(screen.queryByTestId('notifications-enable')).toBeNull();
  await fireEvent.press(screen.getByTestId('notifications-disable'));
  await waitFor(() => expect(notificationMockApi.disableNotifications).toHaveBeenCalledTimes(2));
  expect(notificationMockApi.enableNotifications).not.toHaveBeenCalled();
});

it('shows an unavailable setting without querying another account when signed out', async () => {
  await render(<SettingsHarness />);
  expect(await screen.findByText(enUS['notifications.unavailable'])).toBeOnTheScreen();
  expect(notificationMockApi.getNotificationSettings).not.toHaveBeenCalled();
});

it('lets the user retry a failed enable operation', async () => {
  notificationMockApi.enableNotifications.mockRejectedValueOnce(new Error('offline'));
  await render(<SettingsHarness uid="alice" />);
  await fireEvent.press(await screen.findByTestId('notifications-enable'));
  expect(await screen.findByText(enUS['notifications.error'])).toBeOnTheScreen();
  notificationMockApi.getNotificationSettings.mockResolvedValue('enabled');
  await fireEvent.press(screen.getByTestId('notifications-enable'));
  expect(await screen.findByText(enUS['notifications.status.enabled'])).toBeOnTheScreen();
  expect(notificationMockApi.enableNotifications).toHaveBeenCalledTimes(2);
});

it('refreshes system permission status after returning from Settings and removes the listener', async () => {
  const remove = jest.fn();
  const subscribe = jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove });
  const view = await render(<SettingsHarness uid="alice" />);
  await screen.findByText(enUS['notifications.status.disabled']);
  notificationMockApi.getNotificationSettings.mockResolvedValue('enabled');
  await act(async () => subscribe.mock.calls[0][1]('active'));
  expect(await screen.findByText(enUS['notifications.status.enabled'])).toBeOnTheScreen();
  await view.unmount();
  expect(remove).toHaveBeenCalledTimes(1);
});

it('retains the system-settings action when opening Settings fails', async () => {
  notificationMockApi.getNotificationSettings.mockResolvedValue('denied');
  notificationMockApi.openNotificationSettings.mockRejectedValueOnce(new Error('unavailable'));
  await render(<SettingsHarness uid="alice" />);
  await fireEvent.press(await screen.findByTestId('notifications-open-settings'));
  expect(await screen.findByText(enUS['notifications.error'])).toBeOnTheScreen();
  expect(screen.queryByTestId('notifications-enable')).toBeNull();
  await fireEvent.press(screen.getByTestId('notifications-open-settings'));
  expect(notificationMockApi.openNotificationSettings).toHaveBeenCalledTimes(2);
  expect(notificationMockApi.enableNotifications).not.toHaveBeenCalled();
});
