import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import DiscoverScreen from '@/app/(tabs)/discover';
import { useSessionStore } from '@/features/auth/session-store';
import { useDiscoveryStore } from '@/features/discovery/discovery-store';
import type { DiscoveryProfile } from '@/features/profile/profile-schema';
import { enUS } from '@/localization/en-US';
import { matchIdFor } from '@/services/backend/shared';

import { TEST_PROFILE, TEST_USER, fakeBackend } from './mocks/backend';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn(), push: mockPush, replace: jest.fn() }),
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
  values: ['climate_outdoors', 'public_transit', 'tenant_rights'],
  promptId: 'perfect_sunday',
  promptAnswer: 'Community garden at sunrise, then a long lunch.',
};

const LUCAS: DiscoveryProfile = {
  id: 'p-lucas',
  displayName: 'Lucas',
  age: 31,
  vibe: 'bookworm',
  lookingFor: 'women',
  unionMember: true,
  union: 'seesp',
  values: ['bookshops_coffee', 'indie_film_music', 'cycling'],
  promptId: 'hill_to_die_on',
  promptAnswer: 'Public libraries are the best thing a city does.',
};

const VAL: DiscoveryProfile = {
  id: 'p-val',
  displayName: 'Val',
  age: 26,
  vibe: 'creative',
  lookingFor: 'everyone',
  unionMember: false,
  union: null,
  values: ['volunteering', 'community_gardens', 'pets_parks', 'food_markets'],
  promptId: 'together_we_could',
  promptAnswer: 'Run a bike-to-work convoy.',
};

function signIn() {
  useSessionStore.setState({ status: 'ready', user: TEST_USER, profile: TEST_PROFILE });
}

function seedDeck(...people: DiscoveryProfile[]) {
  for (const person of people) fakeBackend.state.profiles.set(person.id, person);
}

describe('DiscoverScreen', () => {
  it('shows a loading line while the deck is on its way', async () => {
    signIn();
    jest.spyOn(fakeBackend.backend, 'listDiscovery').mockReturnValue(new Promise(() => undefined));

    await render(<DiscoverScreen />);

    expect(screen.getByText(enUS['discover.loading'])).toBeOnTheScreen();
    expect(screen.queryByTestId('discover-like')).not.toBeOnTheScreen();
  });

  it('reports a failed load and recovers through Retry', async () => {
    signIn();
    seedDeck(MAYA);
    fakeBackend.state.failNext.set('listDiscovery', 'network');

    await render(<DiscoverScreen />);

    expect(await screen.findByText(enUS['discover.error'])).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('discover-retry'));

    expect(await screen.findByText('Maya, 28')).toBeOnTheScreen();
    expect(fakeBackend.callsTo('listDiscovery')).toHaveLength(2);
    expect(fakeBackend.callsTo('listDiscovery')[1].args).toEqual([TEST_USER.uid]);
  });

  it('explains an empty deck and reloads it with Refresh', async () => {
    signIn();

    await render(<DiscoverScreen />);

    expect(await screen.findByText(enUS['discover.empty.title'])).toBeOnTheScreen();
    expect(screen.getByText(enUS['discover.empty.body'])).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('discover-refresh'));

    await waitFor(() => expect(fakeBackend.callsTo('listDiscovery')).toHaveLength(2));
    expect(screen.getByText(enUS['discover.empty.title'])).toBeOnTheScreen();
    expect(screen.queryByTestId('discover-like')).not.toBeOnTheScreen();
  });

  it('draws the top card with name, age, vibe, union, values and prompt', async () => {
    signIn();
    seedDeck(MAYA, LUCAS);

    await render(<DiscoverScreen />);

    expect(await screen.findByText('Maya, 28')).toBeOnTheScreen();
    expect(screen.getByText('Outdoorsy')).toBeOnTheScreen();
    expect(screen.getByText('Union Member · APEOESP · Teachers')).toBeOnTheScreen();
    expect(screen.getByText(enUS['discover.values_label'])).toBeOnTheScreen();
    expect(screen.getByText('Climate & outdoors')).toBeOnTheScreen();
    expect(screen.getByText('Public transit')).toBeOnTheScreen();
    expect(screen.getByText('Tenant rights')).toBeOnTheScreen();
    expect(screen.getByText('My perfect Sunday is…')).toBeOnTheScreen();
    expect(screen.getByText('Community garden at sunrise, then a long lunch.')).toBeOnTheScreen();
    expect(screen.getByTestId('discover-pass')).toHaveAccessibleName('Pass');
    expect(screen.getByTestId('discover-like')).toHaveAccessibleName('Like');
  });

  it('hides the union badge for someone who is not a union member', async () => {
    signIn();
    seedDeck(VAL);

    await render(<DiscoverScreen />);

    expect(await screen.findByText('Val, 26')).toBeOnTheScreen();
    expect(screen.queryByText(enUS['discover.union_badge'])).not.toBeOnTheScreen();
  });

  it('records a like, advances the deck and opens no modal without a like back', async () => {
    signIn();
    seedDeck(MAYA, LUCAS);

    await render(<DiscoverScreen />);
    await fireEvent.press(await screen.findByTestId('discover-like'));

    expect(await screen.findByText('Lucas, 31')).toBeOnTheScreen();
    expect(screen.queryByText('Maya, 28')).not.toBeOnTheScreen();
    expect(mockPush).not.toHaveBeenCalled();
    expect(fakeBackend.callsTo('recordSwipe')).toEqual([]);
    expect(fakeBackend.callsTo('like')).toEqual([
      { method: 'like', args: [TEST_USER.uid, 'p-maya'] },
    ]);
  });

  it('opens the match modal when the like is mutual', async () => {
    signIn();
    seedDeck(MAYA, LUCAS);
    // The other person liked first, so this like is the second half of a match.
    fakeBackend.likeFrom(MAYA.id, TEST_USER.uid);

    await render(<DiscoverScreen />);
    await fireEvent.press(await screen.findByTestId('discover-like'));

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(`/match/${matchIdFor(TEST_USER.uid, MAYA.id)}`),
    );
    expect(await screen.findByText('Lucas, 31')).toBeOnTheScreen();
  });

  it('records a pass without creating a match', async () => {
    signIn();
    seedDeck(MAYA, LUCAS);

    await render(<DiscoverScreen />);
    await fireEvent.press(await screen.findByTestId('discover-pass'));

    expect(await screen.findByText('Lucas, 31')).toBeOnTheScreen();
    expect(mockPush).not.toHaveBeenCalled();
    expect(fakeBackend.callsTo('recordSwipe')).toEqual([
      { method: 'recordSwipe', args: [TEST_USER.uid, 'p-maya', 'pass'] },
    ]);
    expect(fakeBackend.callsTo('like')).toEqual([]);
  });

  it('puts the card back on top when the like cannot be saved', async () => {
    signIn();
    seedDeck(MAYA, LUCAS);
    fakeBackend.state.failNext.set('like', 'network');

    await render(<DiscoverScreen />);
    await fireEvent.press(await screen.findByTestId('discover-like'));

    await waitFor(() => expect(screen.getByText('Maya, 28')).toBeOnTheScreen());
    expect(screen.getByText('Maya, 28')).toBeOnTheScreen();
    expect(useDiscoveryStore.getState().candidates[0].id).toBe('p-maya');
    expect(mockPush).not.toHaveBeenCalled();
    expect(fakeBackend.callsTo('like')).toHaveLength(1);
  });

  it('puts the card back on top when the pass cannot be saved', async () => {
    signIn();
    seedDeck(MAYA, LUCAS);
    fakeBackend.state.failNext.set('recordSwipe', 'network');

    await render(<DiscoverScreen />);
    await fireEvent.press(await screen.findByTestId('discover-pass'));

    await waitFor(() => expect(screen.getByText('Maya, 28')).toBeOnTheScreen());
    expect(screen.getByText('Maya, 28')).toBeOnTheScreen();
    expect(fakeBackend.callsTo('recordSwipe')).toHaveLength(1);
  });

  it('never shows the signed-in user in their own deck', async () => {
    signIn();
    seedDeck(MAYA);
    fakeBackend.state.profiles.set(TEST_USER.uid, TEST_PROFILE);

    await render(<DiscoverScreen />);

    expect(await screen.findByText('Maya, 28')).toBeOnTheScreen();
    expect(screen.queryByText('Ana, 29')).not.toBeOnTheScreen();
  });

  it('leaves out everyone I blocked or who blocked me', async () => {
    signIn();
    seedDeck(MAYA, LUCAS);
    fakeBackend.state.blocked.add(MAYA.id);

    await render(<DiscoverScreen />);

    expect(await screen.findByText('Lucas, 31')).toBeOnTheScreen();
    expect(screen.queryByText('Maya, 28')).not.toBeOnTheScreen();
    expect(fakeBackend.callsTo('listBlockedUids')).toEqual([
      { method: 'listBlockedUids', args: [TEST_USER.uid] },
    ]);
  });

  it('opens the safety sheet to report the person on the card', async () => {
    signIn();
    seedDeck(MAYA);

    await render(<DiscoverScreen />);

    const report = await screen.findByTestId('discover-report');
    expect(report).toHaveAccessibleName('Report Maya');

    await fireEvent.press(report);

    expect(mockPush).toHaveBeenCalledWith('/safety/p-maya?context=profile');
  });
});
