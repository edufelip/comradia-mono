import { act, fireEvent, render, screen } from '@testing-library/react-native';

import MatchesScreen from '@/app/(tabs)/matches';
import { useSessionStore } from '@/features/auth/session-store';
import type { DiscoveryProfile } from '@/features/profile/profile-schema';
import { enUS } from '@/localization/en-US';
import { matchIdFor } from '@/services/backend/shared';
import type { Match } from '@/services/backend/types';

import { TEST_PROFILE, TEST_USER, fakeBackend } from './mocks/backend';

const mockPush = jest.fn();
const mockNavigate = jest.fn();
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

function seedProfiles(...people: DiscoveryProfile[]) {
  for (const person of people) fakeBackend.state.profiles.set(person.id, person);
}

beforeEach(() => {
  mockFocusEffects = [];
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
    expect(row).toHaveAccessibleName('Open chat with Maya');
    expect(screen.getByText('Maya, 28')).toBeOnTheScreen();
    expect(screen.getByText('Outdoorsy')).toBeOnTheScreen();
    expect(screen.getByText('You both care about Bookshops & coffee')).toBeOnTheScreen();
    expect(screen.queryByTestId('matches-empty')).not.toBeOnTheScreen();
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

  it('shows a failed reconciliation and recovers through Retry', async () => {
    signIn();
    seedProfiles(MAYA);
    fakeBackend.likeFrom(MAYA.id, TEST_USER.uid);
    fakeBackend.likeFrom(TEST_USER.uid, MAYA.id);
    fakeBackend.state.failNext.set('reconcileMatches', 'network');

    await render(<MatchesScreen />);

    expect(await screen.findByTestId('matches-error')).toBeOnTheScreen();
    expect(screen.getByText(enUS['matches.error'])).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('matches-retry'));

    expect(
      await screen.findByTestId(`match-row-${matchIdFor(TEST_USER.uid, MAYA.id)}`),
    ).toBeOnTheScreen();
    expect(fakeBackend.callsTo('reconcileMatches')).toHaveLength(2);
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
