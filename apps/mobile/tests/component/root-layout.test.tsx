import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { AppState } from 'react-native';
import * as Reanimated from 'react-native-reanimated';
import { useSessionStore } from '@/features/auth/session-store';
import { enUS } from '@/localization/en-US';
import { matchIdFor } from '@/services/backend/shared';
import { TEST_PROFILE, TEST_USER, fakeBackend } from './mocks/backend';
import type { PublicProfile } from '@/features/profile/profile-schema';

const notificationApi = jest.requireMock('@/features/notifications/notifications') as {
  subscribeToPushEvents: jest.Mock;
  refreshNotificationSession: jest.Mock;
  initializePushNotifications: jest.Mock;
  emitPushEvent(event: { kind: 'foreground' | 'tap'; data: Record<string, unknown> }): void;
};

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

  it('routes a verified notification tap to its match after checking membership and blocks', async () => {
    const matchId = await seedMatch();
    restoreUser(TEST_PROFILE);

    const router = renderRoot();
    await router;
    await expectPathname(router, '/discover');
    await waitFor(() => expect(notificationApi.subscribeToPushEvents).toHaveBeenCalled());

    await act(async () => {
      notificationApi.emitPushEvent({
        kind: 'tap',
        data: { type: 'message', matchId, recipientUid: TEST_USER.uid, text: 'private text' },
      });
    });

    await expectPathname(router, `/chat/${matchId}`);
    expect(fakeBackend.state.calls).toContainEqual({
      method: 'getMatch',
      args: [TEST_USER.uid, matchId],
    });
    expect(fakeBackend.state.calls).toContainEqual({
      method: 'listBlockedUids',
      args: [TEST_USER.uid],
    });
  });

  it('discards a notification tap when the account is not its recipient', async () => {
    const matchId = await seedMatch();
    restoreUser(TEST_PROFILE);

    const router = renderRoot();
    await router;
    await expectPathname(router, '/discover');
    await waitFor(() => expect(notificationApi.subscribeToPushEvents).toHaveBeenCalled());

    await act(async () => {
      notificationApi.emitPushEvent({
        kind: 'tap',
        data: { type: 'message', matchId, recipientUid: 'someone-else' },
      });
    });

    expect(router.getPathname()).toBe('/discover');
    expect(fakeBackend.state.calls).not.toContainEqual({
      method: 'getMatch',
      args: ['someone-else', matchId],
    });
  });

  it('does not route a notification for a blocked match', async () => {
    const matchId = await seedMatch();
    fakeBackend.state.blocked.add('p-maya');
    restoreUser(TEST_PROFILE);

    const router = renderRoot();
    await router;
    await expectPathname(router, '/discover');
    await waitFor(() => expect(notificationApi.subscribeToPushEvents).toHaveBeenCalled());

    await act(async () => {
      notificationApi.emitPushEvent({
        kind: 'tap',
        data: { type: 'match', matchId, recipientUid: TEST_USER.uid },
      });
    });

    await waitFor(() =>
      expect(fakeBackend.state.calls).toContainEqual({
        method: 'listBlockedUids',
        args: [TEST_USER.uid],
      }),
    );
    expect(router.getPathname()).toBe('/discover');
  });

  it('shows generic foreground copy and clears it when the session signs out', async () => {
    const matchId = await seedMatch();
    restoreUser(TEST_PROFILE);

    const router = renderRoot();
    await router;
    await expectPathname(router, '/discover');
    await waitFor(() => expect(notificationApi.subscribeToPushEvents).toHaveBeenCalled());

    await act(async () => {
      notificationApi.emitPushEvent({
        kind: 'foreground',
        data: {
          type: 'message',
          matchId,
          recipientUid: TEST_USER.uid,
          text: 'this private message must never appear',
        },
      });
    });

    expect(await screen.findByTestId('notifications-foreground')).toBeOnTheScreen();
    expect(screen.getByText(enUS['notifications.foreground.message'])).toBeOnTheScreen();
    expect(screen.queryByText('this private message must never appear')).toBeNull();

    await act(async () => {
      fakeBackend.emit(null);
    });

    await expectPathname(router, '/welcome');
    expect(screen.queryByTestId('notifications-foreground')).toBeNull();
  });

  it('dismisses a foreground notice and validates access again when opening the next one', async () => {
    const matchId = await seedMatch();
    restoreUser(TEST_PROFILE);
    const router = renderRoot();
    await router;
    await expectPathname(router, '/discover');
    await waitFor(() => expect(notificationApi.subscribeToPushEvents).toHaveBeenCalled());
    const emitNotice = () =>
      notificationApi.emitPushEvent({
        kind: 'foreground',
        data: { type: 'message', matchId, recipientUid: TEST_USER.uid },
      });

    await act(async () => emitNotice());
    await fireEvent.press(await screen.findByTestId('notifications-foreground-dismiss'));
    expect(screen.queryByTestId('notifications-foreground')).toBeNull();
    expect(router.getPathname()).toBe('/discover');

    await act(async () => emitNotice());
    await fireEvent.press(await screen.findByTestId('notifications-foreground-view'));
    await expectPathname(router, `/chat/${matchId}`);
    expect(screen.queryByTestId('notifications-foreground')).toBeNull();
    expect(fakeBackend.state.calls).toContainEqual({
      method: 'listBlockedUids',
      args: [TEST_USER.uid],
    });
  });

  it('discards a notification when match verification fails', async () => {
    const matchId = await seedMatch();
    restoreUser(TEST_PROFILE);
    const router = renderRoot();
    await router;
    await expectPathname(router, '/discover');
    await waitFor(() => expect(notificationApi.subscribeToPushEvents).toHaveBeenCalled());
    fakeBackend.state.failNext.set('getMatch', 'network');

    await act(async () => {
      notificationApi.emitPushEvent({
        kind: 'tap',
        data: { type: 'message', matchId, recipientUid: TEST_USER.uid },
      });
    });

    expect(fakeBackend.state.calls).toContainEqual({
      method: 'getMatch',
      args: [TEST_USER.uid, matchId],
    });
    expect(router.getPathname()).toBe('/discover');
  });

  it('rejects malformed notification data at the SDK-to-router boundary', async () => {
    const matchId = await seedMatch();
    restoreUser(TEST_PROFILE);
    const router = renderRoot();
    await router;
    await expectPathname(router, '/discover');
    await waitFor(() => expect(notificationApi.subscribeToPushEvents).toHaveBeenCalled());
    const invalid = [
      {},
      { type: 'message' },
      { type: 'unsupported', matchId, recipientUid: TEST_USER.uid },
      { type: 'message', matchId: '/external/path', recipientUid: TEST_USER.uid },
      { type: 'message', matchId, recipientUid: '' },
    ];
    for (const data of invalid) {
      await act(async () => notificationApi.emitPushEvent({ kind: 'tap', data }));
    }
    expect(router.getPathname()).toBe('/discover');
    expect(fakeBackend.state.calls.filter((call) => call.method === 'getMatch')).toHaveLength(0);
  });

  it('opens the match modal for a verified match notification', async () => {
    const matchId = await seedMatch();
    restoreUser(TEST_PROFILE);
    const router = renderRoot();
    await router;
    await expectPathname(router, '/discover');
    await waitFor(() => expect(notificationApi.subscribeToPushEvents).toHaveBeenCalled());
    await act(async () =>
      notificationApi.emitPushEvent({
        kind: 'tap',
        data: { type: 'match', matchId, recipientUid: TEST_USER.uid },
      }),
    );
    await expectPathname(router, `/match/${matchId}`);
  });

  it('refreshes registration on foreground only while the current session is ready', async () => {
    const subscribe = jest
      .spyOn(AppState, 'addEventListener')
      .mockReturnValue({ remove: jest.fn() });
    restoreUser(TEST_PROFILE);
    const router = renderRoot();
    await router;
    await expectPathname(router, '/discover');
    const stateListeners = subscribe.mock.calls
      .filter(([event]) => event === 'change')
      .map(([, listener]) => listener);
    expect(stateListeners.length).toBeGreaterThan(0);
    await act(async () => stateListeners.forEach((listener) => listener('background')));
    expect(notificationApi.refreshNotificationSession).not.toHaveBeenCalled();
    notificationApi.refreshNotificationSession.mockRejectedValueOnce(
      new Error('temporarily unavailable'),
    );
    await act(async () => stateListeners.forEach((listener) => listener('active')));
    expect(notificationApi.refreshNotificationSession).toHaveBeenCalledWith(TEST_USER.uid);
    expect(router.getPathname()).toBe('/discover');
    notificationApi.refreshNotificationSession.mockClear();
    await act(async () => fakeBackend.emit(null));
    await expectPathname(router, '/welcome');
    await act(async () => stateListeners.forEach((listener) => listener('active')));
    expect(notificationApi.refreshNotificationSession).not.toHaveBeenCalled();
  });

  it('ignores an in-flight old-account push after sign-out', async () => {
    const router = renderRoot();
    await router;
    await expectPathname(router, '/welcome');
    await waitFor(() => expect(notificationApi.subscribeToPushEvents).toHaveBeenCalled());
    await act(async () =>
      notificationApi.emitPushEvent({
        kind: 'tap',
        data: { type: 'message', matchId: 'p-maya_test-user', recipientUid: TEST_USER.uid },
      }),
    );
    expect(router.getPathname()).toBe('/welcome');
    expect(fakeBackend.state.calls.filter((call) => call.method === 'getMatch')).toHaveLength(0);
  });

  it('does not let an older exit completion erase a newer foreground notice', async () => {
    const completions: Array<() => void> = [];
    jest.spyOn(Reanimated, 'withTiming').mockImplementation((value, _config, callback) => {
      if (callback) completions.push(() => callback(true));
      return value;
    });
    const matchId = await seedMatch();
    restoreUser(TEST_PROFILE);
    const router = renderRoot();
    await router;
    await expectPathname(router, '/discover');
    await waitFor(() => expect(notificationApi.subscribeToPushEvents).toHaveBeenCalled());
    await act(async () =>
      notificationApi.emitPushEvent({
        kind: 'foreground',
        data: { type: 'message', matchId, recipientUid: TEST_USER.uid },
      }),
    );
    await fireEvent.press(await screen.findByTestId('notifications-foreground-dismiss'));
    expect(completions).toHaveLength(1);
    await act(async () =>
      notificationApi.emitPushEvent({
        kind: 'foreground',
        data: { type: 'match', matchId, recipientUid: TEST_USER.uid },
      }),
    );
    await act(async () => completions[0]());
    expect(screen.getByText(enUS['notifications.foreground.match'])).toBeOnTheScreen();
    expect(screen.getByTestId('notifications-foreground-view')).toBeEnabled();
    await fireEvent.press(screen.getByTestId('notifications-foreground-view'));
    await expectPathname(router, `/match/${matchId}`);
    await act(async () => completions[1]?.());
    expect(screen.queryByTestId('notifications-foreground')).toBeNull();
  });

  it('keeps the dating app usable if the optional notification SDK cannot initialize', async () => {
    notificationApi.initializePushNotifications.mockRejectedValueOnce(new Error('unavailable'));
    fakeBackend.state.profiles.set('p-maya', MAYA);
    restoreUser(TEST_PROFILE);
    const router = renderRoot();
    await router;
    await expectPathname(router, '/discover');
    expect(await screen.findByTestId('discover-like')).toBeEnabled();
    expect(screen.getByTestId('discover-pass')).toBeEnabled();
  });
});
