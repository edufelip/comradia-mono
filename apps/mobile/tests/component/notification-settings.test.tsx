import { fireEvent, render, screen } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';

import { enUS } from '@/localization/en-US';
import { NotificationSettings } from '@/features/notifications/NotificationSettings';

jest.mock('@/localization/get-device-locale', () => ({ getDeviceLocale: () => 'en-US' }));

describe('NotificationSettings', () => {
  it('explains the opt-in and asks for permission only after the user taps enable', async () => {
    const onEnable = jest.fn();

    await render(
      <NotificationSettings
        status="disabled"
        onEnable={onEnable}
        onDisable={jest.fn()}
        onOpenSettings={jest.fn()}
      />,
    );

    expect(screen.getByText(enUS['notifications.title'])).toBeOnTheScreen();
    expect(screen.getByText(enUS['notifications.body'])).toBeOnTheScreen();
    expect(screen.getByText(enUS['notifications.status.disabled'])).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('notifications-enable'));
    expect(onEnable).toHaveBeenCalledTimes(1);
  });

  it('animates a finite state transition without delaying the card', async () => {
    const withTiming = jest.spyOn(Reanimated, 'withTiming');
    const withDelay = jest.spyOn(Reanimated, 'withDelay');
    const view = await render(
      <NotificationSettings
        status="loading"
        onEnable={jest.fn()}
        onDisable={jest.fn()}
        onOpenSettings={jest.fn()}
      />,
    );

    expect(screen.getByTestId('notifications-settings-motion')).toBeOnTheScreen();
    expect(withTiming).toHaveBeenCalledTimes(1);

    await view.rerender(
      <NotificationSettings
        status="disabled"
        onEnable={jest.fn()}
        onDisable={jest.fn()}
        onOpenSettings={jest.fn()}
      />,
    );

    expect(withTiming).toHaveBeenCalledTimes(2);
    expect(withDelay).not.toHaveBeenCalled();
  });

  it('shows an enabled setting with an accessible opt-out action', async () => {
    const onDisable = jest.fn();

    await render(
      <NotificationSettings
        status="enabled"
        onEnable={jest.fn()}
        onDisable={onDisable}
        onOpenSettings={jest.fn()}
      />,
    );

    expect(screen.getByText(enUS['notifications.status.enabled'])).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('notifications-disable'));
    expect(onDisable).toHaveBeenCalledTimes(1);
  });

  it('directs a denied permission to system settings', async () => {
    const onOpenSettings = jest.fn();

    await render(
      <NotificationSettings
        status="denied"
        onEnable={jest.fn()}
        onDisable={jest.fn()}
        onOpenSettings={onOpenSettings}
      />,
    );

    expect(screen.getByText(enUS['notifications.permission_denied'])).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('notifications-open-settings'));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('shows an explicit web-unavailable state without an enable button', async () => {
    await render(
      <NotificationSettings
        status="unavailable"
        onEnable={jest.fn()}
        onDisable={jest.fn()}
        onOpenSettings={jest.fn()}
      />,
    );

    expect(screen.getByText(enUS['notifications.unavailable'])).toBeOnTheScreen();
    expect(screen.queryByTestId('notifications-enable')).toBeNull();
  });
});
