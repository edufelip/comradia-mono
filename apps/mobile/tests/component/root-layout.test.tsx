import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import { useSessionStore } from '@/features/auth/session-store';
import type { PublicProfile } from '@/features/profile/profile-schema';
import { enUS } from '@/localization/en-US';

import { TEST_PROFILE, TEST_USER, fakeBackend } from './mocks/backend';

jest.mock('expo-font', () => ({
  ...jest.requireActual('expo-font'),
  useFonts: () => [true, null],
}));
jest.mock('@/localization/get-device-locale', () => ({ getDeviceLocale: () => 'en-US' }));

/** A signed-in user, with or without a profile, as Firebase would restore them. */
function restoreUser(profile: PublicProfile | null = null) {
  if (profile) fakeBackend.state.profiles.set(TEST_USER.uid, profile);
  fakeBackend.emit(TEST_USER);
}

function renderRoot(initialUrl = '/') {
  const router = renderRouter('app', { initialUrl });
  return router;
}

async function expectPathname(router: ReturnType<typeof renderRoot>, pathname: string) {
  await waitFor(() => expect(router.getPathname()).toBe(pathname));
}

describe('RootLayout session routing', () => {
  it('sends a visitor with no session to /welcome', async () => {
    const router = renderRoot();
    await router;

    await expectPathname(router, '/welcome');
    expect(screen.getByTestId('welcome-cta-start')).toBeOnTheScreen();
  });

  it('sends a signed-in user without a profile to /vibe', async () => {
    restoreUser(null);

    const router = renderRoot();
    await router;

    await expectPathname(router, '/vibe');
  });

  it('sends a signed-in user with a profile to /discover', async () => {
    restoreUser(TEST_PROFILE);

    const router = renderRoot();
    await router;

    await expectPathname(router, '/discover');
    expect(screen.getByTestId('discover-screen')).toBeOnTheScreen();
  });

  it('shows the session error view when the profile read fails', async () => {
    fakeBackend.state.failNext.set('getProfile', 'network');
    restoreUser(TEST_PROFILE);

    const router = renderRoot();
    await router;

    expect(await screen.findByTestId('session-error')).toBeOnTheScreen();
    expect(screen.getByText(enUS['session.error.title'])).toBeOnTheScreen();
  });

  it('recovers from a failed profile read through Retry', async () => {
    fakeBackend.state.failNext.set('getProfile', 'network');
    restoreUser(TEST_PROFILE);

    const router = renderRoot();
    await router;
    await screen.findByTestId('session-error');

    await fireEvent.press(screen.getByTestId('session-error-retry'));

    await expectPathname(router, '/discover');
    expect(screen.getByTestId('discover-screen')).toBeOnTheScreen();
  });

  it('leaves for /welcome when the user signs out from the error view', async () => {
    fakeBackend.state.failNext.set('getProfile', 'network');
    restoreUser(TEST_PROFILE);

    const router = renderRoot();
    await router;
    await screen.findByTestId('session-error');

    await fireEvent.press(screen.getByTestId('session-error-sign-out'));

    await expectPathname(router, '/welcome');
  });

  it('leaves for /welcome when the user signs out from the tabs', async () => {
    restoreUser(TEST_PROFILE);

    const router = renderRoot();
    await router;
    await expectPathname(router, '/discover');

    await fireEvent.press(screen.getByRole('button', { name: /Profile/ }));
    await expectPathname(router, '/profile');

    await fireEvent.press(screen.getByTestId('profile-sign-out'));

    await expectPathname(router, '/welcome');
  });

  it('moves from /vibe to /discover when onboarding completes', async () => {
    restoreUser(null);

    const router = renderRoot();
    await router;
    await expectPathname(router, '/vibe');

    await act(async () => {
      useSessionStore.getState().completeOnboarding(TEST_PROFILE);
      await Promise.resolve();
    });

    await expectPathname(router, '/discover');
  });

  it('sends a signed-out visitor deep-linking to /discover back to /welcome', async () => {
    useSessionStore.setState({ status: 'signedOut', user: null, profile: null });

    const router = renderRoot('/discover');
    await router;

    await expectPathname(router, '/welcome');
  });

  it('sends a ready user deep-linking to /register on to /discover', async () => {
    useSessionStore.setState({ status: 'ready', user: TEST_USER, profile: TEST_PROFILE });
    fakeBackend.state.profiles.set(TEST_USER.uid, TEST_PROFILE);
    fakeBackend.emit(TEST_USER);

    const router = renderRoot('/register');
    await router;

    await expectPathname(router, '/discover');
  });
});
