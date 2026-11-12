import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { useSessionStore } from '@/features/auth/session-store';
import { enUS } from '@/localization/en-US';
import { matchIdFor } from '@/services/backend/shared';
import { TEST_PROFILE, TEST_USER, fakeBackend } from './mocks/backend';
import type { PublicProfile } from '@/features/profile/profile-schema';

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

const MAYA: PublicProfile = {
  displayName: 'Maya',
  age: 28,
  vibe: 'outdoorsy',
  lookingFor: 'everyone',
  unionMember: false,
  union: null,
  values: ['bookshops_coffee', 'tenant_rights', 'cycling'],
  promptId: 'perfect_sunday',
  promptAnswer: 'Community garden at sunrise.',
  photoPath: null,
};

/** A ready user with a real match against Maya; returns its id. */
async function seedMatch() {
  fakeBackend.state.profiles.set('p-maya', MAYA);
  fakeBackend.likeFrom('p-maya', TEST_USER.uid);
  const result = await fakeBackend.backend.like(TEST_USER.uid, 'p-maya');
  return result.matched ? result.matchId : matchIdFor(TEST_USER.uid, 'p-maya');
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

  it('opens the match modal for a ready user', async () => {
    const matchId = await seedMatch();
    restoreUser(TEST_PROFILE);

    const router = renderRoot(`/match/${matchId}`);
    await router;

    await expectPathname(router, `/match/${matchId}`);
    expect(await screen.findByTestId('match-screen')).toBeOnTheScreen();
    expect(screen.getByText(enUS['match.title'])).toBeOnTheScreen();
  });

  it('opens the chat for a ready user', async () => {
    const matchId = await seedMatch();
    restoreUser(TEST_PROFILE);

    const router = renderRoot(`/chat/${matchId}`);
    await router;

    await expectPathname(router, `/chat/${matchId}`);
    expect(await screen.findByTestId('chat-screen')).toBeOnTheScreen();
    expect(await screen.findByText('Maya')).toBeOnTheScreen();
  });

  it('sends a signed-out visitor deep-linking to a match back to /welcome', async () => {
    useSessionStore.setState({ status: 'signedOut', user: null, profile: null });

    const router = renderRoot('/match/any');
    await router;

    await expectPathname(router, '/welcome');
  });

  it('sends a signed-out visitor deep-linking to a chat back to /welcome', async () => {
    useSessionStore.setState({ status: 'signedOut', user: null, profile: null });

    const router = renderRoot('/chat/any');
    await router;

    await expectPathname(router, '/welcome');
  });

  it('opens the safety sheet for a ready user', async () => {
    fakeBackend.state.profiles.set('p-maya', MAYA);
    restoreUser(TEST_PROFILE);

    const router = renderRoot('/safety/p-maya?context=profile');
    await router;

    expect(await screen.findByTestId('safety-screen')).toBeOnTheScreen();
    expect(await screen.findByTestId('safety-name')).toHaveTextContent('Maya');
    expect(screen.getByTestId('report-reason-harassment')).toBeOnTheScreen();
  });

  it('sends a signed-out visitor deep-linking to the safety sheet back to /welcome', async () => {
    useSessionStore.setState({ status: 'signedOut', user: null, profile: null });

    const router = renderRoot('/safety/p-maya?context=profile');
    await router;

    await expectPathname(router, '/welcome');
  });
});
