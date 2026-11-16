import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import BlockedScreen from '@/app/blocked';
import { useSessionStore } from '@/features/auth/session-store';
import { enUS } from '@/localization/en-US';
import { TEST_PROFILE, TEST_USER, fakeBackend } from './mocks/backend';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, navigate: jest.fn(), push: jest.fn() }),
}));
jest.mock('@/localization/get-device-locale', () => ({ getDeviceLocale: () => 'en-US' }));

function signIn() {
  useSessionStore.setState({ status: 'ready', user: TEST_USER, profile: TEST_PROFILE });
}

/** Seeds one person I blocked; their public card is there unless `card` is false. */
function block(id: string, name: string | null, card = true) {
  fakeBackend.state.blocked.add(id);
  if (card && name) {
    fakeBackend.state.profiles.set(id, { ...TEST_PROFILE, displayName: name });
  }
}

describe('BlockedScreen', () => {
  beforeEach(() => {
    signIn();
  });

  it('shows the empty state when nobody is blocked', async () => {
    await render(<BlockedScreen />);

    expect(await screen.findByTestId('blocked-empty')).toBeOnTheScreen();
    expect(screen.getByText(enUS['blocked.empty.title'])).toBeOnTheScreen();
    expect(fakeBackend.callsTo('listBlocked')).toEqual([
      { method: 'listBlocked', args: [TEST_USER.uid] },
    ]);
  });

  it('lists each blocked person with their name and an avatar', async () => {
    block('maya', 'Maya');
    block('lucas', 'Lucas');

    await render(<BlockedScreen />);

    expect(await screen.findByTestId('blocked-row-maya')).toBeOnTheScreen();
    expect(screen.getByText('Maya')).toBeOnTheScreen();
    expect(screen.getByText('Lucas')).toBeOnTheScreen();
    expect(screen.getByTestId('blocked-photo-maya')).toBeOnTheScreen();
    expect(screen.queryByTestId('blocked-empty')).toBeNull();
  });

  it('falls back to a neutral name when the person deleted their account', async () => {
    block('ghost', null, false);

    await render(<BlockedScreen />);

    expect(await screen.findByTestId('blocked-row-ghost')).toBeOnTheScreen();
    expect(screen.getByText(enUS['blocked.unknown_name'])).toBeOnTheScreen();
  });

  it('asks for confirmation, and cancel leaves the block in place', async () => {
    block('maya', 'Maya');
    await render(<BlockedScreen />);

    await fireEvent.press(await screen.findByTestId('blocked-unblock-maya'));
    expect(screen.getByTestId('blocked-unblock-confirm-maya')).toBeOnTheScreen();
    expect(screen.getByText(enUS['blocked.unblock.title'])).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('blocked-unblock-cancel-maya'));

    expect(screen.queryByTestId('blocked-unblock-confirm-maya')).toBeNull();
    expect(fakeBackend.callsTo('unblockUser')).toEqual([]);
    expect(fakeBackend.state.blocked.has('maya')).toBe(true);
  });

  it('unblocks on confirm: the backend call runs and the row goes away', async () => {
    block('maya', 'Maya');
    block('lucas', 'Lucas');
    await render(<BlockedScreen />);

    await fireEvent.press(await screen.findByTestId('blocked-unblock-maya'));
    await fireEvent.press(screen.getByTestId('blocked-unblock-confirm-maya'));

    await waitFor(() => expect(screen.queryByTestId('blocked-row-maya')).toBeNull());
    expect(fakeBackend.callsTo('unblockUser')).toEqual([
      { method: 'unblockUser', args: [TEST_USER.uid, 'maya'] },
    ]);
    expect(fakeBackend.state.blocked.has('maya')).toBe(false);
    expect(screen.getByTestId('blocked-row-lucas')).toBeOnTheScreen();
  });

  it('shows the empty state once the last person is unblocked', async () => {
    block('maya', 'Maya');
    await render(<BlockedScreen />);

    await fireEvent.press(await screen.findByTestId('blocked-unblock-maya'));
    await fireEvent.press(screen.getByTestId('blocked-unblock-confirm-maya'));

    expect(await screen.findByTestId('blocked-empty')).toBeOnTheScreen();
  });

  it('keeps the row and shows the error when unblocking fails', async () => {
    block('maya', 'Maya');
    fakeBackend.state.failNext.set('unblockUser', 'network');
    await render(<BlockedScreen />);

    await fireEvent.press(await screen.findByTestId('blocked-unblock-maya'));
    await fireEvent.press(screen.getByTestId('blocked-unblock-confirm-maya'));

    expect(await screen.findByTestId('blocked-error')).toHaveTextContent(
      enUS['safety.error.network'],
    );
    expect(screen.getByTestId('blocked-row-maya')).toBeOnTheScreen();
    expect(fakeBackend.state.blocked.has('maya')).toBe(true);
  });

  it('shows a load error when the list cannot be read', async () => {
    fakeBackend.state.failNext.set('listBlocked', 'network');

    await render(<BlockedScreen />);

    expect(await screen.findByTestId('blocked-load-error')).toHaveTextContent(
      enUS['blocked.error'],
    );
    expect(screen.queryByTestId('blocked-empty')).toBeNull();
  });
});
