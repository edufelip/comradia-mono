import { act, render, screen } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';
import { ForegroundNotification } from '@/features/notifications/ForegroundNotification';

jest.mock('@/localization/get-device-locale', () => ({ getDeviceLocale: () => 'en-US' }));
const HIDDEN = { includeHiddenElements: true };

it('keeps a closing notice mounted but noninteractive until its finite exit finishes', async () => {
  let finish: (() => void) | undefined;
  jest.spyOn(Reanimated, 'withTiming').mockImplementation((value, _config, callback) => {
    if (callback) finish = () => callback(true);
    return value;
  });
  const complete = jest.fn();
  const props = {
    type: 'message' as const,
    onView: jest.fn(),
    onDismiss: jest.fn(),
    noticeId: 12,
    onExitComplete: complete,
  };
  const view = await render(<ForegroundNotification {...props} closing={false} />);
  await view.rerender(<ForegroundNotification {...props} closing />);
  expect(screen.getByTestId('notifications-foreground', HIDDEN)).toBeOnTheScreen();
  expect(screen.getByTestId('notifications-foreground-view', HIDDEN)).toBeDisabled();
  expect(complete).not.toHaveBeenCalled();
  expect(finish).toBeDefined();
  await act(async () => finish?.());
  expect(complete).toHaveBeenCalledWith(12);
});

it('completes dismissal immediately with reduced motion', async () => {
  jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true);
  const timing = jest.spyOn(Reanimated, 'withTiming');
  const complete = jest.fn();
  await render(
    <ForegroundNotification
      type="match"
      onView={jest.fn()}
      onDismiss={jest.fn()}
      noticeId={8}
      onExitComplete={complete}
      closing
    />,
  );
  expect(complete).toHaveBeenCalledWith(8);
  expect(timing).not.toHaveBeenCalled();
});
