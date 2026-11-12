import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';
import ProfileScreen from '@/app/(tabs)/profile';
import { useSessionStore } from '@/features/auth/session-store';
import { pickPhoto } from '@/features/profile/pick-photo';
import { enUS } from '@/localization/en-US';
import { TEST_PROFILE, TEST_USER, fakeBackend } from './mocks/backend';
import type { PublicProfile } from '@/features/profile/profile-schema';

/** The portrait's image and initial are hidden from screen readers; its root carries the name. */
const HIDDEN = { includeHiddenElements: true };
let mockIsFocused = true;

jest.mock('@/localization/get-device-locale', () => ({ getDeviceLocale: () => 'en-US' }));
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => mockIsFocused,
}));
jest.mock('@/features/profile/pick-photo', () => ({ pickPhoto: jest.fn() }));
const notificationApi = jest.requireMock('@/features/notifications/notifications');

function signIn(profile: PublicProfile | null = TEST_PROFILE) {
  useSessionStore.setState({ status: 'ready', user: TEST_USER, profile });
}

describe('ProfileScreen', () => {
  beforeEach(() => {
    mockIsFocused = true;
  });

  it('shows the signed-in user own card', async () => {
    signIn();

    await render(<ProfileScreen />);

    expect(screen.getByText(enUS['profile.title'])).toBeOnTheScreen();
    expect(screen.getByText(enUS['profile.subtitle'])).toBeOnTheScreen();
    expect(screen.getByText('Ana, 29')).toBeOnTheScreen();
    expect(screen.getByText('Bookworm')).toBeOnTheScreen();
    expect(screen.getByText('Union Member · APEOESP · Teachers')).toBeOnTheScreen();
    expect(screen.getByText(enUS['discover.values_label'])).toBeOnTheScreen();
    expect(screen.getByText('Bookshops & coffee')).toBeOnTheScreen();
    expect(screen.getByText('Tenant rights')).toBeOnTheScreen();
    expect(screen.getByText('Cycling')).toBeOnTheScreen();
    expect(screen.getByText('My perfect Sunday is…')).toBeOnTheScreen();
    expect(screen.getByText('Feira, then a long lunch.')).toBeOnTheScreen();
  });

  it('signs out through the backend when the button is pressed', async () => {
    signIn();

    await render(<ProfileScreen />);
    await fireEvent.press(screen.getByTestId('profile-sign-out'));

    await waitFor(() => expect(fakeBackend.callsTo('signOut')).toHaveLength(1));
    expect(screen.getByTestId('profile-sign-out')).toHaveAccessibleName(enUS['profile.sign_out']);
  });

  it('stays usable when the sign-out call fails', async () => {
    signIn();
    fakeBackend.state.failNext.set('signOut', 'network');

    await render(<ProfileScreen />);
    await fireEvent.press(screen.getByTestId('profile-sign-out'));

    // While the call is pending the button shows a spinner instead of its label.
    await waitFor(() => expect(screen.getByText(enUS['profile.sign_out'])).toBeOnTheScreen());
    expect(fakeBackend.callsTo('signOut')).toHaveLength(1);
  });

  it('keeps Sign out available while the profile is still missing', async () => {
    signIn(null);

    await render(<ProfileScreen />);

    expect(screen.queryByText('Ana, 29')).not.toBeOnTheScreen();
    expect(screen.getByTestId('profile-sign-out')).toBeOnTheScreen();
  });

  it('does not request notification permission until the Profile opt-in is tapped', async () => {
    signIn();
    notificationApi.getNotificationSettings
      .mockResolvedValueOnce('disabled')
      .mockResolvedValueOnce('enabled');

    await render(<ProfileScreen />);

    expect(await screen.findByText(enUS['notifications.status.disabled'])).toBeOnTheScreen();
    expect(notificationApi.enableNotifications).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('notifications-enable'));

    await waitFor(() =>
      expect(notificationApi.enableNotifications).toHaveBeenCalledWith(TEST_USER.uid),
    );
    expect(await screen.findByText(enUS['notifications.status.enabled'])).toBeOnTheScreen();
  });

  it('hides the union badge when the user is not a member', async () => {
    signIn({ ...TEST_PROFILE, unionMember: false, union: null });

    await render(<ProfileScreen />);

    expect(screen.getByText('Ana, 29')).toBeOnTheScreen();
    expect(screen.queryByText(enUS['discover.union_badge'])).not.toBeOnTheScreen();
  });

  describe('deleting the account', () => {
    async function openPanel() {
      await render(<ProfileScreen />);
      await fireEvent.press(screen.getByTestId('profile-delete-account'));
    }

    async function confirmDelete() {
      await fireEvent.press(await screen.findByTestId('profile-delete-confirm'));
    }

    it('reveals the delete confirmation only after the action', async () => {
      signIn();
      await render(<ProfileScreen />);

      expect(screen.queryByTestId('profile-delete-motion')).not.toBeOnTheScreen();
      await fireEvent.press(screen.getByTestId('profile-delete-account'));

      expect(screen.getByTestId('profile-delete-motion')).toBeOnTheScreen();
      expect(screen.getByTestId('profile-delete-panel')).toBeOnTheScreen();
    });

    it('opens the delete confirmation without motion when reduced motion is enabled', async () => {
      signIn();
      jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true);
      const timing = jest.spyOn(Reanimated, 'withTiming');

      await render(<ProfileScreen />);
      await fireEvent.press(screen.getByTestId('profile-delete-account'));

      expect(screen.getByTestId('profile-delete-motion')).toBeOnTheScreen();
      expect(timing).not.toHaveBeenCalled();
    });

    it('asks first, with the consequences spelled out, and deletes nothing on cancel', async () => {
      signIn();
      await openPanel();

      expect(screen.getByTestId('profile-delete-panel')).toBeOnTheScreen();
      expect(screen.getByText(enUS['profile.delete.title'])).toBeOnTheScreen();
      expect(screen.getByText(enUS['profile.delete.body'])).toBeOnTheScreen();

      await fireEvent.press(screen.getByTestId('profile-delete-cancel'));

      expect(screen.queryByTestId('profile-delete-panel')).not.toBeOnTheScreen();
      expect(screen.getByTestId('profile-delete-account')).toBeOnTheScreen();
      expect(fakeBackend.callsTo('deleteAccount')).toEqual([]);
      expect(fakeBackend.callsTo('lastSignInAt')).toEqual([]);
    });

    it('deletes everything on a fresh sign-in and lets the session end', async () => {
      signIn();
      await openPanel();

      await confirmDelete();

      await waitFor(() =>
        expect(fakeBackend.callsTo('deleteAccount')).toEqual([
          { method: 'deleteAccount', args: [TEST_USER.uid] },
        ]),
      );
      expect(screen.queryByTestId('profile-delete-error')).not.toBeOnTheScreen();
      expect(screen.queryByTestId('profile-delete-reauth')).not.toBeOnTheScreen();
    });

    it('asks for a fresh sign-in instead of deleting with an old one', async () => {
      signIn();
      // Firebase refuses a deletion after five minutes without a sign-in.
      jest.spyOn(fakeBackend.backend, 'lastSignInAt').mockReturnValue(Date.now() - 6 * 60 * 1000);
      await openPanel();

      await confirmDelete();

      expect(await screen.findByTestId('profile-delete-reauth')).toBeOnTheScreen();
      expect(screen.getByText(enUS['profile.delete.reauth'])).toBeOnTheScreen();
      expect(fakeBackend.callsTo('deleteAccount')).toEqual([]);
      // Sign out stays available, which is exactly what the copy asks for.
      expect(screen.getByTestId('profile-sign-out')).toBeEnabled();
    });

    it('asks for a fresh sign-in when the sign-in time is unknown', async () => {
      signIn();
      jest.spyOn(fakeBackend.backend, 'lastSignInAt').mockReturnValue(null);
      await openPanel();

      await confirmDelete();

      expect(await screen.findByTestId('profile-delete-reauth')).toBeOnTheScreen();
      expect(fakeBackend.callsTo('deleteAccount')).toEqual([]);
    });

    it('reports a deletion that did not go through', async () => {
      signIn();
      fakeBackend.state.failNext.set('deleteAccount', 'network');
      await openPanel();

      await confirmDelete();

      expect(await screen.findByTestId('profile-delete-error')).toBeOnTheScreen();
      expect(screen.getByTestId('profile-delete-error-motion')).toBeOnTheScreen();
      expect(screen.getByText(enUS['profile.delete.error'])).toBeOnTheScreen();
      expect(fakeBackend.callsTo('deleteAccount')).toHaveLength(1);
      expect(screen.queryByTestId('profile-delete-reauth')).not.toBeOnTheScreen();
    });

    it('turns a stale session into the re-auth message', async () => {
      signIn();
      fakeBackend.state.failNext.set('deleteAccount', 'requires_recent_login');
      await openPanel();

      await confirmDelete();

      expect(await screen.findByTestId('profile-delete-error')).toBeOnTheScreen();
      expect(screen.getByTestId('profile-delete-reauth')).toBeOnTheScreen();
      expect(fakeBackend.callsTo('deleteAccount')).toHaveLength(1);
    });
  });

  describe('profile photo', () => {
    const PHOTO = 'photos/test-user/mine.jpg';

    // The backend holds the stored profile too: setProfilePhoto needs it to exist.
    function seedMine(photoPath: string | null) {
      const mine = { ...TEST_PROFILE, photoPath };
      fakeBackend.state.profiles.set(TEST_USER.uid, mine);
      signIn(mine);
    }

    beforeEach(() => {
      jest.mocked(pickPhoto).mockReset();
    });

    it('shows my photo when I have one', async () => {
      seedMine(PHOTO);

      await render(<ProfileScreen />);

      expect(await screen.findByTestId('profile-photo-image', HIDDEN)).toHaveProp('source', [
        { uri: `https://photos.test/${PHOTO}` },
      ]);
      expect(screen.getByTestId('profile-photo-change')).toHaveAccessibleName(enUS['photo.change']);
      expect(screen.getByTestId('profile-photo-remove')).toBeOnTheScreen();
    });

    it('shows my initial and an Add photo button when I have none', async () => {
      seedMine(null);

      await render(<ProfileScreen />);

      expect(screen.getByText('A', HIDDEN)).toBeOnTheScreen();
      expect(screen.queryByTestId('profile-photo-image', HIDDEN)).not.toBeOnTheScreen();
      expect(screen.getByTestId('profile-photo-change')).toHaveAccessibleName(enUS['photo.add']);
      expect(screen.queryByTestId('profile-photo-remove')).not.toBeOnTheScreen();
    });

    it('adds a picked photo to my card', async () => {
      seedMine(null);
      jest.mocked(pickPhoto).mockResolvedValueOnce('file:///tmp/me.jpg');

      await render(<ProfileScreen />);
      await fireEvent.press(screen.getByTestId('profile-photo-change'));

      await waitFor(() =>
        expect(fakeBackend.callsTo('setProfilePhoto')).toEqual([
          { method: 'setProfilePhoto', args: [TEST_USER.uid, 'file:///tmp/me.jpg'] },
        ]),
      );
      const saved = useSessionStore.getState().profile?.photoPath;
      expect(saved).toMatch(/^photos\/test-user\//);
      expect(await screen.findByTestId('profile-photo-image', HIDDEN)).toHaveProp('source', [
        { uri: `https://photos.test/${saved}` },
      ]);
      expect(screen.getByTestId('profile-photo-change')).toHaveAccessibleName(enUS['photo.change']);
      expect(screen.queryByTestId('profile-photo-saving')).not.toBeOnTheScreen();
    });

    it('does nothing when the picker is cancelled', async () => {
      seedMine(null);
      jest.mocked(pickPhoto).mockResolvedValueOnce(null);

      await render(<ProfileScreen />);
      await fireEvent.press(screen.getByTestId('profile-photo-change'));

      await waitFor(() => expect(pickPhoto).toHaveBeenCalledTimes(1));
      expect(fakeBackend.callsTo('setProfilePhoto')).toEqual([]);
      expect(useSessionStore.getState().profile?.photoPath).toBeNull();
      expect(screen.getByTestId('profile-photo-change')).toHaveAccessibleName(enUS['photo.add']);
    });

    it('shows a caption and disables both controls while the photo saves', async () => {
      seedMine(PHOTO);
      jest
        .spyOn(fakeBackend.backend, 'setProfilePhoto')
        .mockReturnValue(new Promise(() => undefined));
      jest.mocked(pickPhoto).mockResolvedValueOnce('file:///tmp/me.jpg');

      await render(<ProfileScreen />);
      await fireEvent.press(screen.getByTestId('profile-photo-change'));

      expect(await screen.findByTestId('profile-photo-saving')).toHaveTextContent(
        enUS['photo.saving'],
      );
      expect(screen.getByTestId('profile-photo-change')).toBeDisabled();
      expect(screen.getByTestId('profile-photo-remove')).toBeDisabled();
    });

    it('removes my photo and brings the initial back', async () => {
      seedMine(PHOTO);

      await render(<ProfileScreen />);
      await fireEvent.press(await screen.findByTestId('profile-photo-remove'));

      await waitFor(() =>
        expect(fakeBackend.callsTo('setProfilePhoto')).toEqual([
          { method: 'setProfilePhoto', args: [TEST_USER.uid, null] },
        ]),
      );
      expect(await screen.findByText('A', HIDDEN)).toBeOnTheScreen();
      expect(screen.queryByTestId('profile-photo-image', HIDDEN)).not.toBeOnTheScreen();
      expect(useSessionStore.getState().profile?.photoPath).toBeNull();
      expect(screen.getByTestId('profile-photo-change')).toHaveAccessibleName(enUS['photo.add']);
    });

    it('keeps the old photo and shows an error when the save fails', async () => {
      seedMine(PHOTO);
      fakeBackend.state.failNext.set('setProfilePhoto', 'network');
      jest.mocked(pickPhoto).mockResolvedValueOnce('file:///tmp/me.jpg');

      await render(<ProfileScreen />);
      await fireEvent.press(screen.getByTestId('profile-photo-change'));

      expect(await screen.findByTestId('profile-photo-error')).toHaveTextContent(
        enUS['photo.error'],
      );
      expect(screen.getByTestId('profile-photo-error-motion')).toBeOnTheScreen();
      expect(screen.getByTestId('profile-photo-error')).toHaveProp('accessibilityRole', 'alert');
      expect(screen.getByTestId('profile-photo-image', HIDDEN)).toHaveProp('source', [
        { uri: `https://photos.test/${PHOTO}` },
      ]);
      expect(useSessionStore.getState().profile?.photoPath).toBe(PHOTO);
    });

    it('shows the same error when the picker fails', async () => {
      seedMine(null);
      jest.mocked(pickPhoto).mockRejectedValueOnce(new Error('picker'));

      await render(<ProfileScreen />);
      await fireEvent.press(screen.getByTestId('profile-photo-change'));

      expect(await screen.findByTestId('profile-photo-error')).toBeOnTheScreen();
      expect(fakeBackend.callsTo('setProfilePhoto')).toEqual([]);
    });

    it('clears the error on the next attempt', async () => {
      seedMine(PHOTO);
      fakeBackend.state.failNext.set('setProfilePhoto', 'network');
      jest
        .mocked(pickPhoto)
        .mockResolvedValueOnce('file:///tmp/me.jpg')
        .mockResolvedValueOnce(null);

      await render(<ProfileScreen />);
      await fireEvent.press(screen.getByTestId('profile-photo-change'));
      expect(await screen.findByTestId('profile-photo-error')).toBeOnTheScreen();

      await fireEvent.press(screen.getByTestId('profile-photo-change'));

      await waitFor(() =>
        expect(screen.queryByTestId('profile-photo-error')).not.toBeOnTheScreen(),
      );
    });

    it('keeps a photo error static if the save finishes while Profile is hidden', async () => {
      seedMine(PHOTO);
      jest.mocked(pickPhoto).mockResolvedValueOnce('file:///tmp/me.jpg');
      let rejectSave: (reason: Error) => void = () => undefined;
      const setProfilePhoto = jest.spyOn(fakeBackend.backend, 'setProfilePhoto').mockImplementation(
        () =>
          new Promise((_resolve, reject) => {
            rejectSave = reject;
          }),
      );

      const view = await render(<ProfileScreen />);
      await fireEvent.press(screen.getByTestId('profile-photo-change'));
      await waitFor(() => expect(setProfilePhoto).toHaveBeenCalled());

      mockIsFocused = false;
      await view.rerender(<ProfileScreen />);
      await act(() => rejectSave(new Error('network')));

      expect(await screen.findByTestId('profile-photo-error')).toBeOnTheScreen();
      expect(screen.queryByTestId('profile-photo-error-motion')).not.toBeOnTheScreen();

      mockIsFocused = true;
      await view.rerender(<ProfileScreen />);
      expect(screen.queryByTestId('profile-photo-error-motion')).not.toBeOnTheScreen();
    });
  });
});
