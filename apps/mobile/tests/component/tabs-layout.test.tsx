import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Text, View } from 'react-native';
import TabLayout from '@/app/(tabs)/_layout';
import { useSessionStore } from '@/features/auth/session-store';

jest.mock('@/localization/get-device-locale', () => ({ getDeviceLocale: () => 'en-US' }));

function renderApp(initialUrl = '/') {
  const result = renderRouter(
    {
      '(auth)/welcome': () => <View testID="welcome-route" />,
      '(tabs)/_layout': TabLayout,
      '(tabs)/index': () => <Text>Discover screen</Text>,
      '(tabs)/matches': () => <Text>Matches screen</Text>,
      '(tabs)/profile': () => <Text>Profile screen</Text>,
    },
    { initialUrl },
  );
  return result;
}

describe('TabLayout', () => {
  it('redirects to /welcome when signed out', async () => {
    const router = renderApp();
    await router;

    expect(router.getPathname()).toBe('/welcome');
    expect(screen.getByTestId('welcome-route')).toBeOnTheScreen();
    expect(screen.queryByText('Matches')).not.toBeOnTheScreen();
  });

  it('renders the three tabs when signed in', async () => {
    useSessionStore.setState({ signedIn: true });
    const router = renderApp();
    await router;

    expect(router.getPathname()).toBe('/');
    expect(screen.getByText('Discover')).toBeOnTheScreen();
    expect(screen.getByText('Matches')).toBeOnTheScreen();
    expect(screen.getByText('Profile')).toBeOnTheScreen();
    expect(screen.getByText('Discover screen')).toBeOnTheScreen();
  });

  it('switches tabs when a tab button is pressed', async () => {
    useSessionStore.setState({ signedIn: true });
    const router = renderApp();
    await router;

    await fireEvent.press(screen.getByRole('button', { name: /Matches/ }));

    expect(router.getPathname()).toBe('/matches');
    expect(screen.getByText('Matches screen')).toBeOnTheScreen();
  });

  it('switches to the profile tab', async () => {
    useSessionStore.setState({ signedIn: true });
    const router = renderApp();
    await router;

    await fireEvent.press(screen.getByRole('button', { name: /Profile/ }));

    expect(router.getPathname()).toBe('/profile');
    expect(screen.getByText('Profile screen')).toBeOnTheScreen();
  });

  it('sends the user back to /welcome when the session ends', async () => {
    useSessionStore.setState({ signedIn: true });
    const router = renderApp();
    await router;

    expect(router.getPathname()).toBe('/');

    await act(async () => {
      useSessionStore.getState().signOut();
      await Promise.resolve();
    });

    await waitFor(() => expect(router.getPathname()).toBe('/welcome'));
  });
});
