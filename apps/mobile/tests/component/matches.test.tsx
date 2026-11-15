import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import MatchesScreen from '@/app/(tabs)/matches';
import { useSessionStore } from '@/features/auth/session-store';
import { enUS } from '@/localization/en-US';
import { matchIdFor } from '@/services/backend/shared';
import { TEST_PROFILE, TEST_USER, fakeBackend } from './mocks/backend';
import type { DiscoveryProfile } from '@/features/profile/profile-schema';
import type { Match } from '@/services/backend/types';

/** The portrait's image and initial are hidden from screen readers; its root carries the name. */
const HIDDEN = { includeHiddenElements: true };

const mockPush = jest.fn();
const mockNavigate = jest.fn();
let mockIsFocused = true;
/** Every focus callback the screen registered, so a test can simulate regaining focus. */
let mockFocusEffects: (() => void)[] = [];
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  return {
    // Stand-in for `useFocusEffect`: runs on mount and whenever the callback changes,
    // which is what the real hook does when the screen regains focus.
    useFocusEffect: (callback: () => void) => {
      mockFocusEffects.push(callback);
      useEffect(callback, [callback]);
    },
    useRouter: () => ({
      back: jest.fn(),
      navigate: mockNavigate,
      push: mockPush,
      replace: jest.fn(),
    }),
  };
});
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => mockIsFocused,
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

function seedProfiles(...people: DiscoveryProfile[]) {
  for (const person of people) fakeBackend.state.profiles.set(person.id, person);
}

beforeEach(() => {
  mockFocusEffects = [];
  mockIsFocused = true;
});

describe('MatchesScreen', () => {
  it('explains how a first match happens when there is none', async () => {
    signIn();

    await render(<MatchesScreen />);

    expect(await screen.findByTestId('matches-empty')).toBeOnTheScreen();
    expect(screen.getByText(enUS['matches.title'])).toBeOnTheScreen();
    expect(screen.getByText(enUS['matches.subtitle'])).toBeOnTheScreen();
    expect(screen.getByText(enUS['matches.empty.title'])).toBeOnTheScreen();
    expect(screen.getByText(enUS['matches.empty.body'])).toBeOnTheScreen();
    expect(fakeBackend.callsTo('reconcileMatches')).toEqual([
      { method: 'reconcileMatches', args: [TEST_USER.uid] },
    ]);
  });

  it('points an empty Matches tab back at Discover', async () => {
    signIn();

    await render(<MatchesScreen />);
    await fireEvent.press(await screen.findByTestId('matches-empty-discover'));

    expect(mockNavigate).toHaveBeenCalledWith('/discover');
  });

  it('fills a match both people wrote at the same moment when the tab opens', async () => {
    signIn();
    seedProfiles(MAYA);
    // Both likes exist, but no match document was created (decision #8's race).
    fakeBackend.likeFrom(MAYA.id, TEST_USER.uid);
    fakeBackend.likeFrom(TEST_USER.uid, MAYA.id);
    const matchId = matchIdFor(TEST_USER.uid, MAYA.id);

    await render(<MatchesScreen />);

    const row = await screen.findByTestId(`match-row-${matchId}`);
    expect(screen.queryByTestId(`match-row-motion-${matchId}`)).not.toBeOnTheScreen();
    expect(row).toHaveAccessibleName('Open chat with Maya');
    expect(screen.getByText('Maya, 28')).toBeOnTheScreen();
    expect(screen.getByText('Outdoorsy')).toBeOnTheScreen();
    expect(screen.getByText('You both care about Bookshops & coffee')).toBeOnTheScreen();
    expect(screen.queryByTestId('matches-empty')).not.toBeOnTheScreen();
  });

  it('animates a new match after the initial live snapshot', async () => {
    signIn();
    seedProfiles(MAYA);
    await render(<MatchesScreen />);
    await screen.findByTestId('matches-empty');

    fakeBackend.likeFrom(MAYA.id, TEST_USER.uid);
    await act(async () => fakeBackend.backend.like(TEST_USER.uid, MAYA.id));
    const matchId = matchIdFor(TEST_USER.uid, MAYA.id);

    expect(await screen.findByTestId(`match-row-${matchId}`)).toBeOnTheScreen();
    expect(screen.getByTestId(`match-row-motion-${matchId}`)).toBeOnTheScreen();
  });

  it('does not replay a match that arrived while Matches was hidden', async () => {
    signIn();
    seedProfiles(MAYA);
    mockIsFocused = false;
    const view = await render(<MatchesScreen />);
    await screen.findByTestId('matches-empty');

    fakeBackend.likeFrom(MAYA.id, TEST_USER.uid);
    await act(async () => fakeBackend.backend.like(TEST_USER.uid, MAYA.id));
    const matchId = matchIdFor(TEST_USER.uid, MAYA.id);

    expect(await screen.findByTestId(`match-row-${matchId}`)).toBeOnTheScreen();
    expect(screen.queryByTestId(`match-row-motion-${matchId}`)).not.toBeOnTheScreen();

    mockIsFocused = true;
    await view.rerender(<MatchesScreen />);

    expect(screen.queryByTestId(`match-row-motion-${matchId}`)).not.toBeOnTheScreen();
  });

  it('does not replay a live match entrance after leaving and returning to Matches', async () => {
    signIn();
    seedProfiles(MAYA);
    const view = await render(<MatchesScreen />);
    await screen.findByTestId('matches-empty');

    fakeBackend.likeFrom(MAYA.id, TEST_USER.uid);
    await act(async () => fakeBackend.backend.like(TEST_USER.uid, MAYA.id));
    const matchId = matchIdFor(TEST_USER.uid, MAYA.id);
    expect(screen.getByTestId(`match-row-motion-${matchId}`)).toBeOnTheScreen();

    mockIsFocused = false;
    await view.rerender(<MatchesScreen />);
    expect(screen.queryByTestId(`match-row-motion-${matchId}`)).not.toBeOnTheScreen();

    mockIsFocused = true;
    await view.rerender(<MatchesScreen />);
    expect(screen.getByTestId(`match-row-${matchId}`)).toBeOnTheScreen();
    expect(screen.queryByTestId(`match-row-motion-${matchId}`)).not.toBeOnTheScreen();
  });

  it('lists matches newest first and opens the chat of the tapped row', async () => {
    signIn();
    seedProfiles(MAYA, VAL);
    fakeBackend.likeFrom(MAYA.id, TEST_USER.uid);
    fakeBackend.likeFrom(TEST_USER.uid, MAYA.id);
    fakeBackend.likeFrom(VAL.id, TEST_USER.uid);
    fakeBackend.likeFrom(TEST_USER.uid, VAL.id);

    await render(<MatchesScreen />);

    const maya = matchIdFor(TEST_USER.uid, MAYA.id);
    const val = matchIdFor(TEST_USER.uid, VAL.id);
    await screen.findByTestId(`match-row-${maya}`);

    expect(await screen.findAllByText(/, \d+$/)).toHaveLength(2);
    // Val's match was created last, so it is listed first.
    const rows = screen.getAllByLabelText(/^Open chat with /);
    expect(rows.map((row) => row.props.testID)).toEqual([`match-row-${val}`, `match-row-${maya}`]);

    await fireEvent.press(screen.getByTestId(`match-row-${val}`));
    expect(mockPush).toHaveBeenCalledWith(`/chat/${val}`);
  });

  it('shows each match portrait in its row', async () => {
    signIn();
    seedProfiles({ ...MAYA, photoPath: 'photos/p-maya/a.jpg' }, VAL);
    fakeBackend.likeFrom(MAYA.id, TEST_USER.uid);
    fakeBackend.likeFrom(TEST_USER.uid, MAYA.id);
    fakeBackend.likeFrom(VAL.id, TEST_USER.uid);
    fakeBackend.likeFrom(TEST_USER.uid, VAL.id);
    const maya = matchIdFor(TEST_USER.uid, MAYA.id);
    const val = matchIdFor(TEST_USER.uid, VAL.id);

    await render(<MatchesScreen />);

    expect(await screen.findByTestId(`match-row-photo-${maya}-image`, HIDDEN)).toHaveProp(
      'source',
      [{ uri: 'https://photos.test/photos/p-maya/a.jpg' }],
    );
    expect(screen.queryByTestId(`match-row-photo-${val}-image`, HIDDEN)).not.toBeOnTheScreen();
    expect(
      within(screen.getByTestId(`match-row-photo-${val}`)).getByText('V', HIDDEN),
    ).toBeOnTheScreen();
  });

  it('keeps the live match list when reconciliation fails', async () => {
    const sessionUser = { ...TEST_USER, uid: 'reconcile-failure-user' };
    useSessionStore.setState({ status: 'ready', user: sessionUser, profile: TEST_PROFILE });
    seedProfiles(MAYA);
    const matchId = matchIdFor(sessionUser.uid, MAYA.id);
    fakeBackend.state.matches.set(matchId, 1);
    fakeBackend.state.failNext.set('reconcileMatches', 'network');

    await render(<MatchesScreen />);

    expect(await screen.findByTestId(`match-row-${matchId}`)).toBeOnTheScreen();
    expect(screen.queryByTestId('matches-error')).not.toBeOnTheScreen();
    expect(fakeBackend.callsTo('reconcileMatches')).toHaveLength(1);

    // A failed repair runs again the next time Matches opens.
    await screen.unmount();
    await render(<MatchesScreen />);
    expect(await screen.findByTestId(`match-row-${matchId}`)).toBeOnTheScreen();
    expect(fakeBackend.callsTo('reconcileMatches')).toHaveLength(2);
  });

  it('shows an error when the live list fails and recovers on retry', async () => {
    signIn();
    seedProfiles(MAYA);
    const matchId = matchIdFor(TEST_USER.uid, MAYA.id);
    fakeBackend.state.matches.set(matchId, 1);
    fakeBackend.state.failNext.set('onMatches', 'network');

    await render(<MatchesScreen />);

    await fireEvent.press(await screen.findByTestId('matches-retry'));
    expect(await screen.findByTestId(`match-row-${matchId}`)).toBeOnTheScreen();
  });

  it('stops following the matches when the screen unmounts', async () => {
    signIn();
    seedProfiles(MAYA);
    const unsubscribe = jest.fn();
    jest.spyOn(fakeBackend.backend, 'onMatches').mockImplementation((uid, listener) => {
      listener([
        {
          id: matchIdFor(TEST_USER.uid, MAYA.id),
          other: MAYA,
          createdAt: 1,
        },
      ]);
      return unsubscribe;
    });

    const view = await render(<MatchesScreen />);
    await screen.findByTestId(`match-row-${matchIdFor(TEST_USER.uid, MAYA.id)}`);

    await view.unmount();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('waits for the session before asking for matches', async () => {
    useSessionStore.setState({ status: 'signedOut', user: null, profile: null });

    await render(<MatchesScreen />);

    expect(screen.getByText(enUS['matches.loading'])).toBeOnTheScreen();
    expect(fakeBackend.callsTo('reconcileMatches')).toEqual([]);
  });

  it('drops a match that arrives after unmount', async () => {
    signIn();
    seedProfiles(MAYA);
    let spill: ((matches: Match[]) => void) | undefined;
    jest.spyOn(fakeBackend.backend, 'onMatches').mockImplementation((uid, listener) => {
      spill = listener;
      listener([]);
      return () => {};
    });

    const view = await render(<MatchesScreen />);
    await screen.findByTestId('matches-empty');
    await view.unmount();

    await act(() => spill?.([]));
  });

  it('hides the matches of people I blocked or who blocked me', async () => {
    signIn();
    seedProfiles(MAYA, VAL);
    fakeBackend.likeFrom(MAYA.id, TEST_USER.uid);
    fakeBackend.likeFrom(TEST_USER.uid, MAYA.id);
    fakeBackend.likeFrom(VAL.id, TEST_USER.uid);
    fakeBackend.likeFrom(TEST_USER.uid, VAL.id);
    fakeBackend.state.blocked.add(MAYA.id);

    await render(<MatchesScreen />);

    expect(
      await screen.findByTestId(`match-row-${matchIdFor(TEST_USER.uid, VAL.id)}`),
    ).toBeOnTheScreen();
    expect(
      screen.queryByTestId(`match-row-${matchIdFor(TEST_USER.uid, MAYA.id)}`),
    ).not.toBeOnTheScreen();
    expect(fakeBackend.callsTo('listBlockedUids')).toEqual([
      { method: 'listBlockedUids', args: [TEST_USER.uid] },
    ]);
  });

  it('shows the empty state when my only match is blocked', async () => {
    signIn();
    seedProfiles(MAYA);
    fakeBackend.likeFrom(MAYA.id, TEST_USER.uid);
    fakeBackend.likeFrom(TEST_USER.uid, MAYA.id);
    fakeBackend.state.blocked.add(MAYA.id);

    await render(<MatchesScreen />);

    expect(await screen.findByTestId('matches-empty')).toBeOnTheScreen();
  });

  it('reads the blocked list again when the tab regains focus', async () => {
    signIn();
    seedProfiles(MAYA);
    fakeBackend.likeFrom(MAYA.id, TEST_USER.uid);
    fakeBackend.likeFrom(TEST_USER.uid, MAYA.id);
    const maya = matchIdFor(TEST_USER.uid, MAYA.id);

    await render(<MatchesScreen />);
    expect(await screen.findByTestId(`match-row-${maya}`)).toBeOnTheScreen();

    // Blocked while the screen was in the background (e.g. from the safety sheet).
    fakeBackend.state.blocked.add(MAYA.id);
    await act(async () => {
      mockFocusEffects.forEach((effect) => effect());
    });

    expect(screen.queryByTestId(`match-row-${maya}`)).not.toBeOnTheScreen();
    expect(fakeBackend.callsTo('listBlockedUids')).toHaveLength(2);
  });
});
