import { fireEvent, render, screen } from '@testing-library/react-native';

import MatchScreen from '@/app/match/[id]';
import { useSessionStore } from '@/features/auth/session-store';
import type { DiscoveryProfile } from '@/features/profile/profile-schema';
import { enUS } from '@/localization/en-US';
import { matchIdFor } from '@/services/backend/shared';

import { TEST_PROFILE, TEST_USER, fakeBackend } from './mocks/backend';

const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockParams: { id?: string } = {};
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({
    back: mockBack,
    navigate: jest.fn(),
    push: jest.fn(),
    replace: mockReplace,
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

const VAL: DiscoveryProfile = {
  id: 'p-val',
  displayName: 'Val',
  age: 26,
  vibe: 'creative',
  lookingFor: 'everyone',
  unionMember: false,
  union: null,
  values: ['volunteering', 'community_gardens', 'pets_parks'],
  promptId: 'together_we_could',
  promptAnswer: 'Run a bike-to-work convoy.',
};

function signIn() {
  useSessionStore.setState({ status: 'ready', user: TEST_USER, profile: TEST_PROFILE });
}

/** Creates a real match through the fake and points the route at it. */
async function seedMatch(other: DiscoveryProfile = MAYA) {
  fakeBackend.state.profiles.set(other.id, other);
  fakeBackend.likeFrom(other.id, TEST_USER.uid);
  const result = await fakeBackend.backend.like(TEST_USER.uid, other.id);
  const id = result.matched ? result.matchId : matchIdFor(TEST_USER.uid, other.id);
  mockParams = { id };
  return id;
}

describe('MatchScreen', () => {
  it('shows a loading line while the match travels from Firestore', async () => {
    signIn();
    jest.spyOn(fakeBackend.backend, 'getMatch').mockReturnValue(new Promise(() => undefined));

    await render(<MatchScreen />);

    expect(screen.getByTestId('match-screen')).toBeOnTheScreen();
    expect(screen.getByText(enUS['match.loading'])).toBeOnTheScreen();
    expect(screen.queryByTestId('match-send-message')).not.toBeOnTheScreen();
  });

  it('celebrates the match with both names and the values they share', async () => {
    signIn();
    const matchId = await seedMatch();

    await render(<MatchScreen />);

    expect(await screen.findByText(enUS['match.title'])).toBeOnTheScreen();
    expect(screen.getByText('You and Maya like each other.')).toBeOnTheScreen();
    expect(screen.getByTestId('match-names')).toHaveTextContent('Ana & Maya');
    expect(screen.getByText(enUS['match.shared_label'])).toBeOnTheScreen();
    expect(screen.getByText('Bookshops & coffee')).toBeOnTheScreen();
    expect(screen.getByText('Tenant rights')).toBeOnTheScreen();
    expect(screen.getByText('Cycling')).toBeOnTheScreen();
    expect(screen.getByTestId('match-send-message')).toHaveAccessibleName('Send a message');
    expect(screen.getByTestId('match-keep-swiping')).toHaveAccessibleName('Keep swiping');
    expect(fakeBackend.callsTo('getMatch')).toEqual([
      { method: 'getMatch', args: [TEST_USER.uid, matchId] },
    ]);
  });

  it('says so when the pair shares no value', async () => {
    signIn();
    await seedMatch(VAL);

    await render(<MatchScreen />);

    expect(await screen.findByText(enUS['match.shared_none'])).toBeOnTheScreen();
    expect(screen.queryByText('Bookshops & coffee')).not.toBeOnTheScreen();
  });

  it('swaps the modal for the chat when writing now', async () => {
    signIn();
    const matchId = await seedMatch();

    await render(<MatchScreen />);
    await fireEvent.press(await screen.findByTestId('match-send-message'));

    expect(mockReplace).toHaveBeenCalledWith(`/chat/${matchId}`);
  });

  it('goes back to the deck when keep swiping', async () => {
    signIn();
    await seedMatch();

    await render(<MatchScreen />);
    await fireEvent.press(await screen.findByTestId('match-keep-swiping'));

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('explains a match it cannot find and lets the person leave', async () => {
    signIn();
    mockParams = { id: 'missing' };

    await render(<MatchScreen />);

    expect(await screen.findByTestId('match-not-found')).toBeOnTheScreen();
    expect(screen.getByText(enUS['match.not_found'])).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('match-keep-swiping'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('reports a failed read and recovers through Try again', async () => {
    signIn();
    await seedMatch();
    fakeBackend.state.failNext.set('getMatch', 'network');

    await render(<MatchScreen />);

    expect(await screen.findByTestId('match-error')).toBeOnTheScreen();
    expect(screen.getByText(enUS['match.error'])).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('match-retry'));

    expect(await screen.findByText('You and Maya like each other.')).toBeOnTheScreen();
    expect(fakeBackend.callsTo('getMatch')).toHaveLength(2);
  });
});
