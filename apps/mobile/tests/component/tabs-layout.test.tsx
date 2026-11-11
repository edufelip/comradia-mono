import { isHiddenFromAccessibility } from '@testing-library/react-native';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';

import TabLayout from '@/app/(tabs)/_layout';
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

    await fireEvent.press(screen.getByRole('button', { name: /Matches/ }));

    expect(router.getPathname()).toBe('/matches');
    expect(screen.getByText('Matches screen')).toBeOnTheScreen();
  });

  it('moves to Profile when its tab is pressed', async () => {
    const router = renderTabs();
    await router;

    await fireEvent.press(screen.getByRole('button', { name: /Profile/ }));

    expect(router.getPathname()).toBe('/profile');
    expect(screen.getByText('Profile screen')).toBeOnTheScreen();
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
