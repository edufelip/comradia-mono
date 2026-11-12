import { act, renderRouter, screen, waitFor } from 'expo-router/testing-library';

jest.mock('expo-font', () => ({
  ...jest.requireActual('expo-font'),
  useFonts: () => [false, null],
}));
jest.mock('@/localization/get-device-locale', () => ({ getDeviceLocale: () => 'en-US' }));

it('keeps the welcome journey available when custom fonts never finish loading', async () => {
  const router = renderRouter('app', { initialUrl: '/' });
  await router;
  expect(screen.getByTestId('session-loading')).toBeOnTheScreen();
  await act(async () => jest.advanceTimersByTime(4000));
  await waitFor(() => expect(router.getPathname()).toBe('/welcome'));
  expect(screen.getByTestId('welcome-cta-start')).toBeEnabled();
  expect(screen.queryByTestId('session-loading')).toBeNull();
});
