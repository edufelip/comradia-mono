import { isHiddenFromAccessibility } from '@testing-library/react-native';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Animated, Text } from 'react-native';
import * as Reanimated from 'react-native-reanimated';
import TabLayout from '@/app/(tabs)/_layout';
import { DS_MOTION } from '@/constants/motion';
import { enUS } from '@/localization/en-US';

jest.mock('@/localization/get-device-locale', () => ({ getDeviceLocale: () => 'en-US' }));

function renderTabs(initialUrl = '/discover') {
  const router = renderRouter(
    {
      '(tabs)/_layout': TabLayout,
      '(tabs)/discover': () => <Text>Discover screen</Text>,
      '(tabs)/matches': () => <Text>Matches screen</Text>,
      '(tabs)/profile': () => <Text>Profile screen</Text>,
    },
    { initialUrl },
  );
  return router;
}

describe('TabLayout', () => {
  it('renders the three tabs with their labels', async () => {
    const router = renderTabs();
    await router;

    expect(router.getPathname()).toBe('/discover');
    expect(screen.getByText(enUS['tabs.discover'])).toBeOnTheScreen();
    expect(screen.getByText(enUS['tabs.matches'])).toBeOnTheScreen();
    expect(screen.getByText(enUS['tabs.profile'])).toBeOnTheScreen();
    expect(screen.getByText('Discover screen')).toBeOnTheScreen();
  });

  it('moves to Matches when its tab is pressed', async () => {
    const router = renderTabs();
    await router;
    const transition = jest.spyOn(Animated, 'timing');

    await fireEvent.press(screen.getByRole('button', { name: /Matches/ }));

    expect(router.getPathname()).toBe('/matches');
    expect(transition).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ duration: DS_MOTION.duration.standard }),
    );
    expect(screen.getByText('Matches screen')).toBeOnTheScreen();
  });

  it('moves to Profile when its tab is pressed', async () => {
    const router = renderTabs();
    await router;

    await fireEvent.press(screen.getByRole('button', { name: /Profile/ }));

    expect(router.getPathname()).toBe('/profile');
    expect(screen.getByText('Profile screen')).toBeOnTheScreen();
  });

  it('gives tab presses a short visual acknowledgement and still switches screens', async () => {
    const timing = jest.spyOn(Reanimated, 'withTiming');
    const router = renderTabs();
    await router;
    const matchesTab = screen.getByRole('button', { name: /Matches/ });

    await fireEvent(matchesTab, 'pressIn');
    expect(timing).toHaveBeenCalledWith(0.96, expect.objectContaining({ duration: 120 }));

    await fireEvent(matchesTab, 'pressOut');
    expect(timing).toHaveBeenCalledWith(1, expect.objectContaining({ duration: 120 }));

    await fireEvent.press(matchesTab);
    expect(router.getPathname()).toBe('/matches');
  });

  it('skips tab press movement when reduced motion is enabled', async () => {
    const timing = jest.spyOn(Reanimated, 'withTiming');
    const transition = jest.spyOn(Animated, 'timing');
    jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true);
    const router = renderTabs();
    await router;
    const profileTab = screen.getByRole('button', { name: /Profile/ });

    await fireEvent(profileTab, 'pressIn');
    await fireEvent(profileTab, 'pressOut');

    expect(timing).not.toHaveBeenCalled();
    await fireEvent.press(profileTab);
    expect(router.getPathname()).toBe('/profile');
    expect(transition).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ duration: 0 }),
    );
  });

  it('keeps the tab icons out of the accessibility tree', async () => {
    const router = renderTabs();
    await router;

    for (const name of ['discover', 'matches', 'profile']) {
      // Hidden from the accessibility tree, so the default queries cannot see them.
      expect(screen.queryAllByTestId(`tab-icon-${name}`)).toHaveLength(0);

      const icons = screen.getAllByTestId(`tab-icon-${name}`, { includeHiddenElements: true });
      expect(icons.length).toBeGreaterThan(0);
      for (const icon of icons) expect(isHiddenFromAccessibility(icon)).toBe(true);
    }
  });
});
