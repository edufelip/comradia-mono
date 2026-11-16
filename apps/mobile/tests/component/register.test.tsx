import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { StyleSheet, View } from 'react-native';
import RegisterScreen from '@/app/(auth)/register';
import VerifyPhoneScreen from '@/app/(auth)/verify-phone';
import WelcomeScreen from '@/app/(auth)/welcome';
import { enUS } from '@/localization/en-US';
import { fakeBackend } from './mocks/backend';

let mockColorScheme: 'light' | 'dark' = 'light';

jest.mock('@/hooks/use-color-scheme', () => ({ useColorScheme: () => mockColorScheme }));
jest.mock('@/localization/get-device-locale', () => ({ getDeviceLocale: () => 'en-US' }));

/**
 * Apple's real button is a native view; the stand-in keeps the props the screen passes
 * (testID, onPress) so the iPhone-only branch can be exercised off-device.
 */
jest.mock('expo-apple-authentication', () => {
  const { Pressable: MockPressable, Text: MockText } = require('react-native');
  return {
    AppleAuthenticationButton: ({ onPress, testID }: { onPress: () => void; testID?: string }) => (
      <MockPressable accessibilityRole="button" onPress={onPress} testID={testID}>
        <MockText>Continue with Apple</MockText>
      </MockPressable>
    ),
    AppleAuthenticationButtonStyle: { BLACK: 2, WHITE: 0, WHITE_OUTLINE: 1 },
    AppleAuthenticationButtonType: { CONTINUE: 1, SIGN_IN: 0, SIGN_UP: 2 },
  };
});

/**
 * `renderRouter` is built for RNTL 13's synchronous render (see docs/testing.md); keep a
 * plain handle instead of awaiting the thenable, which would drop the routing helpers.
 */
async function renderRegister(initialUrl = '/register') {
  const result = renderRouter(
    {
      '(auth)/welcome': WelcomeScreen,
      '(auth)/register': RegisterScreen,
      '(auth)/verify-phone': VerifyPhoneScreen,
      '(onboarding)/vibe': () => <View testID="vibe-route" />,
    },
    { initialUrl },
  );
  await result;
  return {
    getPathname: () => result.getPathname(),
    getSearchParams: () => result.getSearchParams(),
  };
}

/** expo-router renders under a concurrent root: state changes only land inside `act`. */
async function press(testID: string) {
  await act(async () => {
    fireEvent.press(await screen.findByTestId(testID));
  });
}

async function type(testID: string, text: string) {
  await act(async () => {
    fireEvent.changeText(screen.getByTestId(testID), text);
  });
}

/** Flushes the fake backend's promises and the routing update they trigger. */
async function flush() {
  await act(async () => {});
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const ERROR_CODES = [
  'invalid_phone',
  'invalid_code',
  'code_expired',
  'no_pending_code',
  'too_many_requests',
  'network',
  'unknown',
] as const;

afterEach(() => {
  mockColorScheme = 'light';
});

describe('RegisterScreen', () => {
  it('renders the sign-up copy with every entry point', async () => {
    await renderRegister();

    expect(screen.getByRole('header')).toHaveTextContent(enUS['auth.title']);
    expect(screen.getByText(enUS['auth.step'])).toBeOnTheScreen();
    expect(screen.getByText(enUS['auth.lede'])).toBeOnTheScreen();
    expect(screen.getByText(enUS['auth.or_phone'])).toBeOnTheScreen();
    expect(screen.getByText(enUS['auth.privacy'])).toBeOnTheScreen();
    expect(screen.getByText(enUS['auth.terms'])).toBeOnTheScreen();

    expect(screen.getByTestId('register-google')).toHaveAccessibleName(enUS['auth.google']);
    expect(screen.getByTestId('register-send-code')).toHaveAccessibleName(enUS['auth.send_code']);
    expect(screen.getByTestId('register-switch-mode')).toHaveAccessibleName(
      enUS['auth.switch_to_login'],
    );
    expect(screen.getByTestId('register-phone-input')).toBeOnTheScreen();
  });

  it('switches to the log-in copy when the route carries mode=login', async () => {
    await renderRegister('/register?mode=login');

    expect(screen.getByRole('header')).toHaveTextContent(enUS['auth.title_login']);
    expect(screen.getByText(enUS['auth.step_login'])).toBeOnTheScreen();
    expect(screen.getByText(enUS['auth.lede_login'])).toBeOnTheScreen();
    expect(screen.getByTestId('register-switch-mode')).toHaveAccessibleName(
      enUS['auth.switch_to_signup'],
    );
  });

  it('toggles the mode without leaving the screen', async () => {
    const router = await renderRegister();

    await press('register-switch-mode');

    expect(router.getPathname()).toBe('/register');
    expect(router.getSearchParams()).toMatchObject({ mode: 'login' });
    expect(await screen.findByText(enUS['auth.title_login'])).toBeOnTheScreen();
  });

  it('keeps the send button disabled until the number is a valid Brazilian phone', async () => {
    await renderRegister();

    expect(screen.getByTestId('register-send-code')).toBeDisabled();

    await type('register-phone-input', '1198765');
    expect(screen.getByTestId('register-send-code')).toBeDisabled();

    await type('register-phone-input', '11987654321');
    expect(screen.getByTestId('register-send-code')).toBeEnabled();
    expect(fakeBackend.callsTo('startPhoneSignIn')).toHaveLength(0);
  });

  it('marks the phone row as focused while the input has focus', async () => {
    await renderRegister();
    const row = () => screen.getByTestId('register-phone-input.row');
    const border = () => StyleSheet.flatten(row().props.style).borderColor;

    const resting = border();

    await act(async () => {
      fireEvent(screen.getByTestId('register-phone-input'), 'focus');
    });
    expect(border()).not.toBe(resting);

    await act(async () => {
      fireEvent(screen.getByTestId('register-phone-input'), 'blur');
    });
    expect(border()).toBe(resting);
  });

  it('formats the number as the user types', async () => {
    await renderRegister();

    await type('register-phone-input', '11987654321');
    expect(screen.getByTestId('register-phone-input')).toHaveDisplayValue('(11) 98765-4321');

    await type('register-phone-input', '1134567890');
    expect(screen.getByTestId('register-phone-input')).toHaveDisplayValue('(11) 3456-7890');
  });

  it('sends the code in E.164 and pushes the verification screen', async () => {
    const router = await renderRegister();

    await type('register-phone-input', '11987654321');
    await press('register-send-code');

    await flush();
    expect(router.getPathname()).toBe('/verify-phone');
    expect(fakeBackend.callsTo('startPhoneSignIn')).toEqual([
      { method: 'startPhoneSignIn', args: ['+5511987654321'] },
    ]);
    expect(router.getSearchParams()).toMatchObject({ phone: '+5511987654321' });
    expect(screen.queryByTestId('register-error')).not.toBeOnTheScreen();
  });

  for (const code of ERROR_CODES) {
    it(`maps ${code} to its translated message`, async () => {
      fakeBackend.state.failNext.set('startPhoneSignIn', code);
      await renderRegister();

      await type('register-phone-input', '11987654321');
      await press('register-send-code');

      const error = await screen.findByTestId('register-error');
      expect(error).toHaveTextContent(enUS[`auth.error.${code}`]);
      expect(error).toHaveProp('accessibilityRole', 'alert');
    });
  }

  it('stays quiet when the user cancels', async () => {
    fakeBackend.state.failNext.set('startPhoneSignIn', 'cancelled');
    await renderRegister();

    await type('register-phone-input', '11987654321');
    await press('register-send-code');

    await flush();
    expect(fakeBackend.callsTo('startPhoneSignIn')).toHaveLength(1);
    expect(screen.queryByTestId('register-error')).not.toBeOnTheScreen();
  });

  it('hides the Apple button when the platform does not offer it', async () => {
    await renderRegister();

    expect(screen.queryByTestId('register-apple')).not.toBeOnTheScreen();
  });

  it('hides the Apple button when the platform check fails', async () => {
    const original = fakeBackend.backend.isAppleSignInAvailable;
    fakeBackend.backend.isAppleSignInAvailable = () => Promise.reject(new Error('offline'));

    await renderRegister();
    await flush();

    fakeBackend.backend.isAppleSignInAvailable = original;
    expect(screen.queryByTestId('register-apple')).not.toBeOnTheScreen();
    expect(screen.getByTestId('register-google')).toBeOnTheScreen();
  });

  it('signs in with Apple where it is available', async () => {
    fakeBackend.state.appleAvailable = true;
    await renderRegister();

    await press('register-apple');

    expect(fakeBackend.callsTo('signInWithApple')).toHaveLength(1);
    expect(screen.queryByTestId('register-error')).not.toBeOnTheScreen();
  });

  it('shows the pressed button loading and blocks the others while Apple works', async () => {
    fakeBackend.state.appleAvailable = true;
    const pending = deferred();
    const original = fakeBackend.backend.signInWithApple;
    fakeBackend.backend.signInWithApple = () => pending.promise;
    await renderRegister();

    await act(async () => {
      fireEvent.press(await screen.findByTestId('register-apple'));
    });

    expect(screen.getByTestId('register-apple-loading')).toBeOnTheScreen();
    expect(screen.getByTestId('register-google')).toBeDisabled();
    expect(screen.getByTestId('register-send-code')).toBeDisabled();

    await act(async () => {
      pending.resolve();
      await pending.promise;
    });
    fakeBackend.backend.signInWithApple = original;
    expect(screen.queryByTestId('register-apple-loading')).not.toBeOnTheScreen();
  });

  it('signs in with Google and lets routing take over', async () => {
    const router = await renderRegister();

    await press('register-google');

    expect(fakeBackend.callsTo('signInWithGoogle')).toHaveLength(1);
    expect(router.getPathname()).toBe('/register');
    expect(screen.queryByTestId('register-error')).not.toBeOnTheScreen();
  });

  it('shows the Apple cancellation as nothing and other failures as an error', async () => {
    fakeBackend.state.appleAvailable = true;
    fakeBackend.state.failNext.set('signInWithApple', 'cancelled');
    await renderRegister();

    await press('register-apple');
    expect(screen.queryByTestId('register-error')).not.toBeOnTheScreen();

    fakeBackend.state.failNext.set('signInWithGoogle', 'network');
    await press('register-google');
    expect(await screen.findByTestId('register-error')).toHaveTextContent(
      enUS['auth.error.network'],
    );
  });

  it('goes back to welcome when there is no history', async () => {
    const router = await renderRegister();

    await press('register-back');

    expect(router.getPathname()).toBe('/welcome');
  });

  it('returns to the previous screen when there is history', async () => {
    const router = await renderRegister('/welcome');

    await press('welcome-cta-start');
    expect(router.getPathname()).toBe('/register');

    await press('register-back');
    expect(router.getPathname()).toBe('/welcome');
  });

  it('renders in dark scheme', async () => {
    mockColorScheme = 'dark';
    await renderRegister();

    expect(screen.getByRole('header')).toHaveTextContent(enUS['auth.title']);
    expect(screen.getByTestId('register-send-code')).toBeOnTheScreen();
  });
});
