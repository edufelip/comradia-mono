import { Slot } from 'expo-router';
import { renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';
import RootLayout from '@/app/_layout';
import { collectHostTypes } from './support/host-tree';

let mockFontsLoaded = true;

jest.mock('expo-font', () => ({ useFonts: () => [mockFontsLoaded, null] }));
jest.mock('@/localization/get-device-locale', () => ({ getDeviceLocale: () => 'en-US' }));

function renderRoot() {
  return renderRouter(
    {
      _layout: RootLayout,
      '(tabs)/_layout': () => <Slot />,
      '(tabs)/index': () => <Text>Discover route</Text>,
    },
    { initialUrl: '/' },
  );
}

afterEach(() => {
  mockFontsLoaded = true;
});

describe('RootLayout', () => {
  it('renders the navigator once the fonts are loaded', async () => {
    const router = renderRoot();
    await router;

    expect(router.getPathname()).toBe('/');
    expect(screen.getByText('Discover route')).toBeOnTheScreen();
  });

  it('shows a loading spinner until the fonts finish loading', async () => {
    mockFontsLoaded = false;

    const router = renderRoot();
    await router;

    expect(collectHostTypes()).toContain('ActivityIndicator');
    expect(screen.queryByText('Discover route')).not.toBeOnTheScreen();
  });
});
