import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';
import { StyleSheet } from 'react-native';
import MatchScreen from '@/app/match/[id]';
import { useSessionStore } from '@/features/auth/session-store';
import { enUS } from '@/localization/en-US';
import { matchIdFor } from '@/services/backend/shared';
import { TEST_PROFILE, TEST_USER, fakeBackend } from './mocks/backend';
import type { DiscoveryProfile } from '@/features/profile/profile-schema';

/** The portrait's image and initial are hidden from screen readers; its root carries the name. */
const HIDDEN = { includeHiddenElements: true };

function mockMotionInterpolation() {
  return jest
    .spyOn(Reanimated, 'interpolate')
    .mockImplementation((value, _inputRange, outputRange) =>
      value <= 0 ? outputRange[0]! : outputRange[outputRange.length - 1]!,
    );
}

const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockSetParams = jest.fn();
const mockTransitionEndListeners = new Set<(event: { data: { closing: boolean } }) => void>();
const mockNavigation = {
  getState: () => ({ routes: [{ key: 'tabs' }, { key: 'match' }] }),
  addListener: jest.fn(
    (event: string, listener: (event: { data: { closing: boolean } }) => void) => {
      if (event === 'transitionEnd') mockTransitionEndListeners.add(listener);
      return () => mockTransitionEndListeners.delete(listener);
    },
  ),
};
let mockParams: { id?: string; celebrate?: string } = {};
let mockIsFocused = true;
jest.mock('expo-router', () => ({
  useNavigation: () => mockNavigation,
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({
    back: mockBack,
    navigate: jest.fn(),
    push: jest.fn(),
    replace: mockReplace,
    setParams: mockSetParams,
  }),
}));
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => mockIsFocused,
}));
jest.mock('@/localization/get-device-locale', () => ({ getDeviceLocale: () => 'en-US' }));

beforeEach(() => {
  mockTransitionEndListeners.clear();
  mockParams = {};
  mockIsFocused = true;
});

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
  photoPath: null,
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
  photoPath: null,
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

  it('does not replay the hero when a match is opened without the like-action flag', async () => {
    signIn();
    await seedMatch();
    const timing = jest.spyOn(Reanimated, 'withTiming');
    const interpolate = mockMotionInterpolation();

    await render(<MatchScreen />);
    expect(await screen.findByTestId('match-names')).toBeOnTheScreen();

    expect(timing).not.toHaveBeenCalled();
    expect(mockSetParams).not.toHaveBeenCalled();
    expect(
      StyleSheet.flatten(screen.getByTestId('match-celebration-emblem', HIDDEN).props.style),
    ).toMatchObject({
      opacity: 1,
      transform: [{ translateY: 0 }, { scale: 1 }],
    });
    interpolate.mockRestore();
  });

  it('keeps the eligible hero in its opening pose through the first frame after transitionEnd', async () => {
    signIn();
    const matchId = await seedMatch();
    mockParams = { id: matchId, celebrate: '1' };
    const timing = jest.spyOn(Reanimated, 'withTiming');
    const interpolate = mockMotionInterpolation();

    await render(<MatchScreen />);
    expect(await screen.findByTestId('match-names')).toBeOnTheScreen();
    expect(timing).not.toHaveBeenCalled();
    expect(
      StyleSheet.flatten(screen.getByTestId('match-celebration-emblem', HIDDEN).props.style),
    ).toMatchObject({
      opacity: 0,
      transform: [{ translateY: -10 }, { scale: 0.62 }],
    });

    const react = jest.requireActual<typeof import('react')>('react');
    const registerNoopEffect = react.useEffect;
    const passiveEffects = jest.spyOn(react, 'useEffect').mockImplementation((_effect, deps) => {
      registerNoopEffect(() => undefined, deps);
    });
    try {
      await act(async () => {
        mockTransitionEndListeners.forEach((listener) => listener({ data: { closing: false } }));
      });

      // Hold passive effects for this commit and inspect the actual first visible pose.
      expect(
        StyleSheet.flatten(screen.getByTestId('match-celebration-emblem', HIDDEN).props.style),
      ).toMatchObject({
        opacity: 0,
        transform: [{ translateY: -10 }, { scale: 0.62 }],
      });
      expect(timing).not.toHaveBeenCalled();
    } finally {
      passiveEffects.mockRestore();
      interpolate.mockRestore();
    }
  });

  it('consumes the one-shot flag before playing the user-triggered match hero', async () => {
    signIn();
    const matchId = await seedMatch();
    mockParams = { id: matchId, celebrate: '1' };
    const timing = jest.spyOn(Reanimated, 'withTiming');

    await render(<MatchScreen />);
    expect(await screen.findByTestId('match-names')).toBeOnTheScreen();

    expect(timing).not.toHaveBeenCalled();
    expect(mockSetParams).not.toHaveBeenCalled();
    await act(async () => {
      mockTransitionEndListeners.forEach((listener) => listener({ data: { closing: false } }));
    });

    await waitFor(() => expect(mockSetParams).toHaveBeenCalledWith({ celebrate: undefined }));
    expect(mockSetParams).toHaveBeenCalledWith({ celebrate: undefined });
    expect(timing).toHaveBeenCalledWith(1, expect.objectContaining({ duration: 360 }));
  });

  it('does not replay a queued celebration after leaving before the stack transition ends', async () => {
    signIn();
    const matchId = await seedMatch();
    mockParams = { id: matchId, celebrate: '1' };
    const timing = jest.spyOn(Reanimated, 'withTiming');
    const view = await render(<MatchScreen />);
    expect(await screen.findByTestId('match-names')).toBeOnTheScreen();
    expect(timing).not.toHaveBeenCalled();

    mockIsFocused = false;
    await view.rerender(<MatchScreen />);
    mockIsFocused = true;
    await view.rerender(<MatchScreen />);
    await act(async () => {
      mockTransitionEndListeners.forEach((listener) => listener({ data: { closing: false } }));
    });

    expect(timing).not.toHaveBeenCalled();
  });

  it('shows the other person portrait beside mine', async () => {
    signIn();
    await seedMatch({ ...MAYA, photoPath: 'photos/p-maya/a.jpg' });

    await render(<MatchScreen />);

    expect(await screen.findByTestId('match-photo-other-image', HIDDEN)).toHaveProp('source', [
      { uri: 'https://photos.test/photos/p-maya/a.jpg' },
    ]);
    expect(screen.getByTestId('match-photo-me')).toBeOnTheScreen();
  });

  it('shows the initial when the other person has no portrait', async () => {
    signIn();
    await seedMatch();

    await render(<MatchScreen />);

    expect(await screen.findByTestId('match-photo-other')).toBeOnTheScreen();
    expect(screen.queryByTestId('match-photo-other-image', HIDDEN)).not.toBeOnTheScreen();
    expect(
      within(screen.getByTestId('match-photo-other')).getByText('M', HIDDEN),
    ).toBeOnTheScreen();
    expect(within(screen.getByTestId('match-photo-me')).getByText('A', HIDDEN)).toBeOnTheScreen();
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
