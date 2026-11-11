import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { View } from 'react-native';
import RegisterScreen from '@/app/(auth)/register';
import WelcomeScreen from '@/app/(auth)/welcome';
import TabLayout from '@/app/(tabs)/_layout';
import { enUS } from '@/localization/en-US';
import { LocaleProvider } from '@/localization/locale-context';
import { ptBR } from '@/localization/pt-BR';

let mockColorScheme: 'light' | 'dark' = 'light';
let mockDeviceLocale = 'en-US';

jest.mock('@/hooks/use-color-scheme', () => ({ useColorScheme: () => mockColorScheme }));
jest.mock('@/localization/get-device-locale', () => ({
  getDeviceLocale: () => mockDeviceLocale,
}));
jest.mock('expo-apple-authentication', () => ({
  AppleAuthenticationButton: () => null,
  AppleAuthenticationButtonStyle: { BLACK: 2, WHITE: 0, WHITE_OUTLINE: 1 },
  AppleAuthenticationButtonType: { CONTINUE: 1, SIGN_IN: 0, SIGN_UP: 2 },
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
      '(auth)/register': RegisterScreen,
      '(tabs)/_layout': TabLayout,
      '(tabs)/index': () => <View testID="discover-route" />,
      '(tabs)/matches': () => <View testID="matches-route" />,
      '(tabs)/profile': () => <View testID="profile-route" />,
    },
    { initialUrl: '/welcome', ...options },
  );
  await result;
  return {
    getPathname: () => result.getPathname(),
    getSearchParams: () => result.getSearchParams(),
  };
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

  it('opens registration in sign-up mode from the start CTA', async () => {
    const router = await renderWelcome();

    await fireEvent.press(screen.getByTestId('welcome-cta-start'));

    expect(router.getPathname()).toBe('/register');
    expect(router.getSearchParams()).not.toMatchObject({ mode: 'login' });
    expect(screen.getByRole('header')).toHaveTextContent(enUS['auth.title']);
  });

  it('opens registration in log-in mode from the login CTA', async () => {
    const router = await renderWelcome();

    await fireEvent.press(screen.getByTestId('welcome-cta-login'));

    expect(router.getPathname()).toBe('/register');
    expect(router.getSearchParams()).toMatchObject({ mode: 'login' });
    expect(screen.getByRole('header')).toHaveTextContent(enUS['auth.title_login']);
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
