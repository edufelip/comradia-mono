import { fireEvent, render, screen } from '@testing-library/react-native';

import { enUS } from '@/localization/en-US';
import { ForegroundNotification } from '@/features/notifications/ForegroundNotification';

jest.mock('@/localization/get-device-locale', () => ({ getDeviceLocale: () => 'en-US' }));

describe('ForegroundNotification', () => {
  it('shows a generic match notice with view and dismiss actions', async () => {
    const onView = jest.fn();
    const onDismiss = jest.fn();

    await render(<ForegroundNotification type="match" onView={onView} onDismiss={onDismiss} />);

    expect(screen.getByTestId('notifications-foreground-motion')).toBeOnTheScreen();
    expect(screen.getByRole('alert')).toBeOnTheScreen();
    expect(screen.getByText(enUS['notifications.foreground.match'])).toBeOnTheScreen();
    expect(screen.queryByText(/sent you/i)).toBeNull();
    await fireEvent.press(screen.getByTestId('notifications-foreground-view'));
    expect(onView).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByTestId('notifications-foreground-dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('uses generic message copy without exposing message content', async () => {
    await render(
      <ForegroundNotification type="message" onView={jest.fn()} onDismiss={jest.fn()} />,
    );

    expect(screen.getByText(enUS['notifications.foreground.message'])).toBeOnTheScreen();
    expect(screen.queryByText(/hello|text of the message/i)).toBeNull();
  });
});
