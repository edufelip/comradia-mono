import { render, screen } from '@testing-library/react-native';
import MatchesScreen from '@/app/(tabs)/matches';
import { useDiscoveryStore } from '@/features/discovery/discovery-store';

jest.mock('@/localization/get-device-locale', () => ({ getDeviceLocale: () => 'en-US' }));

describe('MatchesScreen', () => {
  it('explains how to get a first match when there are none', async () => {
    await render(<MatchesScreen />);

    expect(screen.getByText('Mutual Matches')).toBeOnTheScreen();
    expect(screen.getByText('People who share what matters to you')).toBeOnTheScreen();
    expect(
      screen.getByText('No matches yet — tap Like on Discover to start a conversation.'),
    ).toBeOnTheScreen();
  });

  it('lists every mutual match', async () => {
    useDiscoveryStore.getState().sendSolidarity('comrade-maya');
    useDiscoveryStore.getState().sendSolidarity('comrade-val');

    await render(<MatchesScreen />);

    expect(screen.getByText('Maya, 28 · São Paulo')).toBeOnTheScreen();
    expect(screen.getByText('Eco-Socialist')).toBeOnTheScreen();
    expect(screen.getByText('Val, 26 · Rio de Janeiro')).toBeOnTheScreen();
    expect(screen.getByText('Anarcho-Syndicalist')).toBeOnTheScreen();
    expect(
      screen.queryByText('No matches yet — tap Like on Discover to start a conversation.'),
    ).not.toBeOnTheScreen();
  });
});
