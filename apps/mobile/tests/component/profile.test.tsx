import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import ProfileScreen from '@/app/(tabs)/profile';
import { useSessionStore } from '@/features/auth/session-store';
import type { PublicProfile } from '@/features/profile/profile-schema';
import { enUS } from '@/localization/en-US';

import { TEST_PROFILE, TEST_USER, fakeBackend } from './mocks/backend';

jest.mock('@/localization/get-device-locale', () => ({ getDeviceLocale: () => 'en-US' }));

function signIn(profile: PublicProfile | null = TEST_PROFILE) {
  useSessionStore.setState({ status: 'ready', user: TEST_USER, profile });
}

describe('ProfileScreen', () => {
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

  it('hides the union badge when the user is not a member', async () => {
    signIn({ ...TEST_PROFILE, unionMember: false, union: null });

    await render(<ProfileScreen />);

    expect(screen.getByText('Ana, 29')).toBeOnTheScreen();
    expect(screen.queryByText(enUS['discover.union_badge'])).not.toBeOnTheScreen();
  });
});
