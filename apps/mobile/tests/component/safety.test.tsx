import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import SafetyScreen from '@/app/safety/[uid]';
import { useSessionStore } from '@/features/auth/session-store';
import { useDiscoveryStore } from '@/features/discovery/discovery-store';
import type { DiscoveryProfile } from '@/features/profile/profile-schema';
import { enUS } from '@/localization/en-US';
import { REPORT_REASONS } from '@/services/backend/types';

import { TEST_PROFILE, TEST_USER, fakeBackend } from './mocks/backend';

const mockBack = jest.fn();
const mockDismissTo = jest.fn();
const mockPush = jest.fn();
let mockParams: { uid?: string; context?: string } = {};
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({
    back: mockBack,
    navigate: jest.fn(),
    push: mockPush,
    dismissTo: mockDismissTo,
  }),
}));
jest.mock('@/localization/get-device-locale', () => ({ getDeviceLocale: () => 'en-US' }));

const MAYA: DiscoveryProfile = {
  id: 'p-maya',
  displayName: 'Maya',
  age: 28,
  vibe: 'outdoorsy',
  lookingFor: 'everyone',
  unionMember: true,
  union: 'apeoesp',
  values: ['bookshops_coffee', 'tenant_rights', 'cycling'],
  promptId: 'perfect_sunday',
  promptAnswer: 'Community garden at sunrise, then a long lunch.',
};

const LUCAS: DiscoveryProfile = {
  id: 'p-lucas',
  displayName: 'Lucas',
  age: 31,
  vibe: 'bookworm',
  lookingFor: 'women',
  unionMember: false,
  union: null,
  values: ['bookshops_coffee', 'indie_film_music', 'cycling'],
  promptId: 'hill_to_die_on',
  promptAnswer: 'Public libraries are the best thing a city does.',
};

function signIn() {
  useSessionStore.setState({ status: 'ready', user: TEST_USER, profile: TEST_PROFILE });
}

/** Opens the sheet for `person`, with them already on top of the deck (the Discover path). */
function openFromProfile(person: DiscoveryProfile = MAYA, ...rest: DiscoveryProfile[]) {
  mockParams = { uid: person.id, context: 'profile' };
  useDiscoveryStore.setState({ status: 'ready', candidates: [person, ...rest] });
}

describe('SafetyScreen', () => {
  it('offers every reason as a single-select radio group', async () => {
    signIn();
    openFromProfile();

    await render(<SafetyScreen />);

    for (const reason of REPORT_REASONS) {
      expect(screen.getByTestId(`report-reason-${reason}`)).toHaveAccessibleName(
        enUS[`safety.reason.${reason}`],
      );
    }

    await fireEvent.press(screen.getByTestId('report-reason-harassment'));
    expect(screen.getByTestId('report-reason-harassment')).toBeChecked();

    await fireEvent.press(screen.getByTestId('report-reason-hate'));
    expect(screen.getByTestId('report-reason-hate')).toBeChecked();
    expect(screen.getByTestId('report-reason-harassment')).not.toBeChecked();
  });

  it('requires a reason before the report can be sent', async () => {
    signIn();
    openFromProfile();

    await render(<SafetyScreen />);
    expect(screen.getByTestId('report-submit')).toBeDisabled();

    await fireEvent.press(screen.getByTestId('report-reason-spam'));

    expect(screen.getByTestId('report-submit')).toBeEnabled();
  });

  it('caps the details at 500 characters and counts them', async () => {
    signIn();
    openFromProfile();

    await render(<SafetyScreen />);
    expect(screen.getByTestId('report-details').props.maxLength).toBe(500);

    await fireEvent.changeText(screen.getByTestId('report-details'), 'Kept going');

    expect(screen.getByText('10/500')).toBeOnTheScreen();
  });

  it('reports from the profile context and drops the person from the deck', async () => {
    signIn();
    openFromProfile(MAYA, LUCAS);

    await render(<SafetyScreen />);
    expect(screen.getByTestId('safety-name')).toHaveTextContent('Maya');

    await fireEvent.press(screen.getByTestId('report-reason-spam'));
    await fireEvent.changeText(screen.getByTestId('report-details'), '  Sent the same link  ');
    await fireEvent.press(screen.getByTestId('report-submit'));

    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
    expect(fakeBackend.callsTo('reportUser')).toEqual([
      {
        method: 'reportUser',
        args: [
          TEST_USER.uid,
          {
            targetId: MAYA.id,
            reason: 'spam',
            details: 'Sent the same link',
            context: 'profile',
          },
        ],
      },
    ]);
    expect(useDiscoveryStore.getState().candidates.map((person) => person.id)).toEqual([LUCAS.id]);
  });

  it('reports from a chat with that context and goes back to Matches', async () => {
    signIn();
    // From a chat the person is not in the deck: the sheet reads the name from their card.
    mockParams = { uid: LUCAS.id, context: 'chat' };
    fakeBackend.state.profiles.set(LUCAS.id, LUCAS);

    await render(<SafetyScreen />);
    await waitFor(() => expect(screen.getByTestId('safety-name')).toHaveTextContent('Lucas'));

    await fireEvent.press(screen.getByTestId('report-reason-harassment'));
    await fireEvent.press(screen.getByTestId('report-submit'));

    await waitFor(() => expect(mockDismissTo).toHaveBeenCalledWith('/matches'));
    expect(fakeBackend.callsTo('reportUser')).toEqual([
      {
        method: 'reportUser',
        args: [
          TEST_USER.uid,
          { targetId: LUCAS.id, reason: 'harassment', details: '', context: 'chat' },
        ],
      },
    ]);
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('blocks only after the confirmation', async () => {
    signIn();
    openFromProfile();

    await render(<SafetyScreen />);
    await fireEvent.press(screen.getByTestId('safety-block'));

    expect(screen.getByTestId('safety-block-confirm')).toBeOnTheScreen();
    expect(fakeBackend.callsTo('blockUser')).toEqual([]);

    await fireEvent.press(screen.getByTestId('safety-block-cancel'));
    expect(screen.queryByTestId('safety-block-confirm')).not.toBeOnTheScreen();
    expect(fakeBackend.callsTo('blockUser')).toEqual([]);

    await fireEvent.press(screen.getByTestId('safety-block'));
    await fireEvent.press(screen.getByTestId('safety-block-confirm'));

    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
    expect(fakeBackend.callsTo('blockUser')).toEqual([
      { method: 'blockUser', args: [TEST_USER.uid, MAYA.id] },
    ]);
    expect(useDiscoveryStore.getState().candidates).toEqual([]);
  });

  it('closes without writing anything when Close is pressed', async () => {
    signIn();
    openFromProfile();

    await render(<SafetyScreen />);
    await fireEvent.press(screen.getByTestId('safety-close'));

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(fakeBackend.callsTo('blockUser')).toEqual([]);
    expect(fakeBackend.callsTo('reportUser')).toEqual([]);
  });

  it('keeps the sheet open and explains a block that did not go through', async () => {
    signIn();
    openFromProfile();
    fakeBackend.state.failNext.set('blockUser', 'network');

    await render(<SafetyScreen />);
    await fireEvent.press(screen.getByTestId('safety-block'));
    await fireEvent.press(screen.getByTestId('safety-block-confirm'));

    expect(await screen.findByTestId('safety-error')).toBeOnTheScreen();
    expect(screen.getByText(enUS['safety.error.network'])).toBeOnTheScreen();
    expect(mockBack).not.toHaveBeenCalled();
    // Usable again, so a second attempt is one press away.
    expect(screen.getByTestId('safety-block-confirm')).toBeEnabled();
  });

  it('explains an unexpected report failure in plain words', async () => {
    signIn();
    openFromProfile();
    fakeBackend.state.failNext.set('reportUser', 'unknown');

    await render(<SafetyScreen />);
    await fireEvent.press(screen.getByTestId('report-reason-fake'));
    await fireEvent.press(screen.getByTestId('report-submit'));

    expect(await screen.findByTestId('safety-error')).toBeOnTheScreen();
    expect(screen.getByText(enUS['safety.error.generic'])).toBeOnTheScreen();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('asks the person to wait after too many attempts', async () => {
    signIn();
    openFromProfile();
    fakeBackend.state.failNext.set('reportUser', 'too_many_requests');

    await render(<SafetyScreen />);
    await fireEvent.press(screen.getByTestId('report-reason-spam'));
    await fireEvent.press(screen.getByTestId('report-submit'));

    expect(await screen.findByTestId('safety-error')).toBeOnTheScreen();
    expect(screen.getByText(enUS['safety.error.too_many_requests'])).toBeOnTheScreen();
  });

  it('asks for a fresh sign-in when Firebase says the session is stale', async () => {
    signIn();
    openFromProfile();
    fakeBackend.state.failNext.set('blockUser', 'requires_recent_login');

    await render(<SafetyScreen />);
    await fireEvent.press(screen.getByTestId('safety-block'));
    await fireEvent.press(screen.getByTestId('safety-block-confirm'));

    expect(await screen.findByTestId('safety-error')).toBeOnTheScreen();
    expect(screen.getByText(enUS['safety.error.requires_recent_login'])).toBeOnTheScreen();
  });

  it('cannot send the same block twice', async () => {
    signIn();
    openFromProfile();
    const blockUser = jest
      .spyOn(fakeBackend.backend, 'blockUser')
      .mockReturnValue(new Promise(() => undefined));

    await render(<SafetyScreen />);
    await fireEvent.press(screen.getByTestId('safety-block'));
    await fireEvent.press(screen.getByTestId('safety-block-confirm'));
    await fireEvent.press(screen.getByTestId('safety-block-confirm'));

    expect(blockUser).toHaveBeenCalledTimes(1);
    expect(blockUser).toHaveBeenCalledWith(TEST_USER.uid, MAYA.id);
  });
});
