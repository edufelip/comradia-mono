import { render, screen, fireEvent } from '@testing-library/react-native';
import DiscoverScreen from '@/app/(tabs)/index';
import MatchesScreen from '@/app/(tabs)/matches';
import { useDiscoveryStore } from '@/features/discovery/discovery-store';

jest.mock('@/localization/get-device-locale', () => ({ getDeviceLocale: () => 'en-US' }));

describe('DiscoverScreen', () => {
  it('shows the first comrade in the deck', async () => {
    await render(<DiscoverScreen />);

    expect(screen.getByText('Comradia')).toBeOnTheScreen();
    expect(screen.getByText('Meet someone who gives a damn.')).toBeOnTheScreen();
    expect(screen.getByText('Maya, 28')).toBeOnTheScreen();
    expect(screen.getByText('she/her · São Paulo')).toBeOnTheScreen();
    expect(screen.getByText('Eco-Socialist')).toBeOnTheScreen();
    expect(screen.getByText('Union Member')).toBeOnTheScreen();
    expect(screen.getByText('SHARED VALUES & FIRST DATE')).toBeOnTheScreen();
    expect(screen.getByText('#Climate Justice')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Pass' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Like' })).toBeOnTheScreen();
  });

  it('moves to the next comrade when the current one is passed', async () => {
    await render(<DiscoverScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Pass' }));

    expect(screen.queryByText('Maya, 28')).not.toBeOnTheScreen();
    expect(screen.getByText('Lucas, 31')).toBeOnTheScreen();
    expect(useDiscoveryStore.getState().candidates).toHaveLength(2);
  });

  it('hides the union badge for comrades who are not union members', async () => {
    await render(<DiscoverScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Pass' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Pass' }));

    expect(screen.getByText('Val, 26')).toBeOnTheScreen();
    expect(screen.queryByText('Union Member')).not.toBeOnTheScreen();
  });

  it('shows the empty state and can reset the deck', async () => {
    await render(<DiscoverScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Pass' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Pass' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Pass' }));

    expect(screen.getByText('You are all caught up')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Pass' })).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Reset Deck' }));

    expect(screen.getByText('Maya, 28')).toBeOnTheScreen();
    expect(useDiscoveryStore.getState().candidates).toHaveLength(3);
  });

  it('adds a liked person to Matches', async () => {
    const discover = await render(<DiscoverScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Like' }));

    expect(screen.getByText('Lucas, 31')).toBeOnTheScreen();
    expect(useDiscoveryStore.getState().matches.map((comrade) => comrade.id)).toEqual([
      'comrade-maya',
    ]);

    await discover.unmount();
    await render(<MatchesScreen />);

    expect(screen.getByText('Maya, 28 · São Paulo')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Ideal first date: solidarity kitchen prep then live samba at a cooperative bar.',
      ),
    ).toBeOnTheScreen();
  });

  it('does not duplicate a match when the same person is liked twice', async () => {
    await render(<DiscoverScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Like' }));
    useDiscoveryStore.getState().sendSolidarity('comrade-maya');

    expect(useDiscoveryStore.getState().matches).toHaveLength(1);
  });
});
