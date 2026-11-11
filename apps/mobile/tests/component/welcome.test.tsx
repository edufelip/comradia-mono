import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { View } from 'react-native';
import WelcomeScreen from '@/app/(auth)/welcome';
import TabLayout from '@/app/(tabs)/_layout';
import { useSessionStore } from '@/features/auth/session-store';
import { enUS } from '@/localization/en-US';
import { LocaleProvider } from '@/localization/locale-context';
import { ptBR } from '@/localization/pt-BR';

let mockColorScheme: 'light' | 'dark' = 'light';
let mockDeviceLocale = 'en-US';

jest.mock('@/hooks/use-color-scheme', () => ({ useColorScheme: () => mockColorScheme }));
jest.mock('@/localization/get-device-locale', () => ({
  getDeviceLocale: () => mockDeviceLocale,
}));

/**
 * `renderRouter` is built for RNTL 13's synchronous render: it returns the render
 * promise with the routing helpers attached. Awaiting that thenable would drop the
 * helpers, so keep a plain-object handle instead.
 */
async function renderWelcome(options: Parameters<typeof renderRouter>[1] = {}) {
  const result = renderRouter(
    {
      '(auth)/welcome': WelcomeScreen,
      '(tabs)/_layout': TabLayout,
      '(tabs)/index': () => <View testID="discover-route" />,
      '(tabs)/matches': () => <View testID="matches-route" />,
      '(tabs)/profile': () => <View testID="profile-route" />,
    },
    { initialUrl: '/welcome', ...options },
  );
  await result;
  return { getPathname: () => result.getPathname() };
}

afterEach(() => {
  mockColorScheme = 'light';
  mockDeviceLocale = 'en-US';
});

describe('WelcomeScreen', () => {
  it('renders the English pitch: headline, lede, map caption and social proof', async () => {
    await renderWelcome();

    expect(screen.getByRole('header')).toHaveTextContent('Meet someone who gives a damn.');
    expect(screen.getByText(enUS['welcome.lede'])).toBeOnTheScreen();
    expect(screen.getByText(enUS['welcome.map_caption'])).toBeOnTheScreen();
    expect(screen.getByText(enUS['welcome.map_places'])).toBeOnTheScreen();
    expect(screen.getByText(/nearby are already here/)).toHaveTextContent(
      '12.4k people nearby are already here',
    );
    expect(screen.getByText(/SÃO PAULO/)).toBeOnTheScreen();
  });

  it('renders both calls to action', async () => {
    await renderWelcome();

    expect(screen.getByTestId('welcome-cta-start')).toHaveAccessibleName(
      `${enUS['welcome.cta_start']} →`,
    );
    expect(screen.getByTestId('welcome-cta-login')).toHaveAccessibleName(enUS['welcome.cta_login']);
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('signs in and goes to Discover when the start CTA is tapped', async () => {
    const router = await renderWelcome();

    await fireEvent.press(screen.getByTestId('welcome-cta-start'));

    expect(useSessionStore.getState().signedIn).toBe(true);
    expect(router.getPathname()).toBe('/');
  });

  it('signs in and goes to Discover when the login CTA is tapped', async () => {
    const router = await renderWelcome();

    await fireEvent.press(screen.getByTestId('welcome-cta-login'));

    expect(useSessionStore.getState().signedIn).toBe(true);
    expect(router.getPathname()).toBe('/');
  });

  it('renders in dark scheme without crashing', async () => {
    mockColorScheme = 'dark';

    await renderWelcome();

    expect(screen.getByRole('header')).toHaveTextContent('Meet someone who gives a damn.');
    expect(screen.getByTestId('welcome-cta-start')).toBeOnTheScreen();
  });

  it('renders the Portuguese copy when the locale is pt-BR', async () => {
    mockDeviceLocale = 'pt-BR';

    await renderWelcome({ wrapper: LocaleProvider });

    expect(screen.getByRole('header')).toHaveTextContent(
      `${ptBR['welcome.title_lead']}${ptBR['welcome.title_accent']}`,
    );
    expect(screen.getByText(ptBR['welcome.lede'])).toBeOnTheScreen();
    expect(screen.getByText(ptBR['welcome.map_caption'])).toBeOnTheScreen();
    expect(screen.getByTestId('welcome-cta-start')).toHaveAccessibleName(
      `${ptBR['welcome.cta_start']} →`,
    );
    expect(screen.getByTestId('welcome-cta-login')).toHaveAccessibleName(ptBR['welcome.cta_login']);
  });
});
