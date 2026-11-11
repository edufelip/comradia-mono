import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { View } from 'react-native';
import RegisterScreen from '@/app/(auth)/register';
import VerifyPhoneScreen from '@/app/(auth)/verify-phone';
import { useSessionStore } from '@/features/auth/session-store';
import { syncSession } from '@/features/auth/session-sync';
import { enUS } from '@/localization/en-US';
import { fakeBackend } from './mocks/backend';

let mockColorScheme: 'light' | 'dark' = 'light';

jest.mock('@/hooks/use-color-scheme', () => ({ useColorScheme: () => mockColorScheme }));
jest.mock('@/localization/get-device-locale', () => ({ getDeviceLocale: () => 'en-US' }));
jest.mock('expo-apple-authentication', () => ({
  AppleAuthenticationButton: () => null,
  AppleAuthenticationButtonStyle: { BLACK: 2, WHITE: 0, WHITE_OUTLINE: 1 },
  AppleAuthenticationButtonType: { CONTINUE: 1, SIGN_IN: 0, SIGN_UP: 2 },
}));

const PHONE = '+5511987654321';
const VERIFY_URL = `/verify-phone?phone=${encodeURIComponent(PHONE)}`;

/**
 * `renderRouter` is built for RNTL 13's synchronous render (see docs/testing.md); keep a
 * plain handle instead of awaiting the thenable, which would drop the routing helpers.
 */
async function renderVerify(initialUrl = VERIFY_URL) {
  const result = renderRouter(
    {
      '(auth)/welcome': () => <View testID="welcome-route" />,
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

async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

afterEach(() => {
  mockColorScheme = 'light';
});

describe('VerifyPhoneScreen', () => {
  it('shows the step, title and the number the code went to', async () => {
    await renderVerify();

    expect(screen.getByRole('header')).toHaveTextContent(enUS['verify.title']);
    expect(screen.getByText(enUS['verify.step'])).toBeOnTheScreen();
    expect(screen.getByText('Sent by SMS to (11) 98765-4321')).toBeOnTheScreen();
    expect(screen.getByTestId('verify-code-input')).toHaveAccessibleName(enUS['verify.code_label']);
    expect(screen.getByTestId('verify-submit')).toBeDisabled();
  });

  it('keeps the submit button disabled below six digits', async () => {
    await renderVerify();

    await type('verify-code-input', '123');
    expect(screen.getByTestId('verify-submit')).toBeDisabled();
    expect(fakeBackend.callsTo('confirmPhoneCode')).toHaveLength(0);
  });

  it('only keeps digits and caps the code at six characters', async () => {
    await renderVerify();

    await type('verify-code-input', '1a2b3c4d');
    expect(screen.getByTestId('verify-code-input')).toHaveDisplayValue('1234');
    expect(fakeBackend.callsTo('confirmPhoneCode')).toHaveLength(0);

    fakeBackend.state.failNext.set('confirmPhoneCode', 'cancelled');
    await type('verify-code-input', 'x1y2z3w4v5u6t7');
    expect(fakeBackend.callsTo('confirmPhoneCode')).toEqual([
      { method: 'confirmPhoneCode', args: ['123456'] },
    ]);
  });

  it('auto-submits and lets the session store take over on a correct code', async () => {
    fakeBackend.state.pendingPhone = PHONE;
    const unsubscribe = syncSession(fakeBackend.backend);
    await renderVerify();

    await type('verify-code-input', '123456');

    await waitFor(() => expect(fakeBackend.callsTo('confirmPhoneCode')).toHaveLength(1));
    await waitFor(() => expect(useSessionStore.getState().status).toBe('needsOnboarding'));
    expect(useSessionStore.getState().user?.phoneNumber).toBe(PHONE);
    expect(screen.queryByTestId('verify-error')).not.toBeOnTheScreen();
    unsubscribe();
  });

  it('shows the mapped error and clears the code on a wrong one', async () => {
    fakeBackend.state.failNext.set('confirmPhoneCode', 'invalid_code');
    await renderVerify();

    await type('verify-code-input', '000000');

    const error = await screen.findByTestId('verify-error');
    expect(error).toHaveTextContent(enUS['auth.error.invalid_code']);
    expect(screen.getByTestId('verify-code-input')).toHaveDisplayValue('');
  });

  it('maps an expired code and a missing pending code', async () => {
    fakeBackend.state.failNext.set('confirmPhoneCode', 'code_expired');
    await renderVerify();

    await type('verify-code-input', '111111');
    expect(await screen.findByTestId('verify-error')).toHaveTextContent(
      enUS['auth.error.code_expired'],
    );

    fakeBackend.state.failNext.set('confirmPhoneCode', 'no_pending_code');
    await type('verify-code-input', '222222');
    expect(await screen.findByTestId('verify-error')).toHaveTextContent(
      enUS['auth.error.no_pending_code'],
    );
  });

  it('stays quiet when the code confirmation is cancelled', async () => {
    fakeBackend.state.failNext.set('confirmPhoneCode', 'cancelled');
    await renderVerify();

    await type('verify-code-input', '333333');

    await waitFor(() => expect(fakeBackend.callsTo('confirmPhoneCode')).toHaveLength(1));
    expect(screen.queryByTestId('verify-error')).not.toBeOnTheScreen();
  });

  it('counts down 30 seconds before offering a resend', async () => {
    const countdown = (seconds: number) =>
      enUS['verify.resend_in'].replace('{seconds}', String(seconds));

    await renderVerify();

    expect(screen.getByTestId('verify-resend-countdown')).toHaveTextContent(countdown(30));
    expect(screen.queryByTestId('verify-resend')).not.toBeOnTheScreen();

    await advance(10_000);
    expect(screen.getByTestId('verify-resend-countdown')).toHaveTextContent(countdown(20));

    await advance(20_000);
    expect(screen.queryByTestId('verify-resend-countdown')).not.toBeOnTheScreen();
    expect(screen.getByTestId('verify-resend')).toHaveTextContent(enUS['verify.resend']);
  });

  it('resends the code and restarts the countdown', async () => {
    await renderVerify();
    await advance(30_000);

    await press('verify-resend');

    expect(fakeBackend.callsTo('startPhoneSignIn')).toEqual([
      { method: 'startPhoneSignIn', args: [PHONE] },
    ]);
    expect(screen.getByTestId('verify-resend-countdown')).toHaveTextContent(
      enUS['verify.resend_in'].replace('{seconds}', '30'),
    );
    expect(screen.queryByTestId('verify-error')).not.toBeOnTheScreen();
  });

  it('shows a resend failure and keeps the resend available', async () => {
    fakeBackend.state.failNext.set('startPhoneSignIn', 'too_many_requests');
    await renderVerify();
    await advance(30_000);

    await press('verify-resend');

    expect(await screen.findByTestId('verify-error')).toHaveTextContent(
      enUS['auth.error.too_many_requests'],
    );
    expect(screen.getByTestId('verify-resend')).toBeOnTheScreen();
  });

  it('goes back to registration from the back button', async () => {
    const router = await renderVerify('/register');

    await type('register-phone-input', '11987654321');
    await press('register-send-code');
    await flush();
    expect(router.getPathname()).toBe('/verify-phone');

    await press('verify-back');
    expect(router.getPathname()).toBe('/register');
  });

  it('goes back to registration from the edit link', async () => {
    const router = await renderVerify('/register');

    await type('register-phone-input', '11987654321');
    await press('register-send-code');
    await flush();
    expect(router.getPathname()).toBe('/verify-phone');

    await press('verify-edit');
    expect(router.getPathname()).toBe('/register');
  });

  it('replaces to registration when there is no screen to go back to', async () => {
    const router = await renderVerify();

    await press('verify-edit');

    expect(router.getPathname()).toBe('/register');
  });

  it('does not confirm twice while a code is already in flight', async () => {
    fakeBackend.state.pendingPhone = PHONE;
    let resolve!: () => void;
    const pending = new Promise<void>((res) => {
      resolve = res;
    });
    const original = fakeBackend.backend.confirmPhoneCode;
    let confirmations = 0;
    fakeBackend.backend.confirmPhoneCode = () => {
      confirmations += 1;
      return pending;
    };
    await renderVerify();

    await type('verify-code-input', '123456');
    await press('verify-submit');

    expect(screen.getByTestId('verify-submit')).toBeDisabled();
    expect(confirmations).toBe(1);

    await act(async () => {
      resolve();
      await pending;
    });
    fakeBackend.backend.confirmPhoneCode = original;
  });

  it('replaces to registration when opened without a usable number', async () => {
    const missing = await renderVerify('/verify-phone');
    expect(missing.getPathname()).toBe('/register');
  });

  it('replaces to registration when the number is not a Brazilian phone', async () => {
    const invalid = await renderVerify('/verify-phone?phone=123');
    expect(invalid.getPathname()).toBe('/register');
  });

  it('renders in dark scheme', async () => {
    mockColorScheme = 'dark';
    await renderVerify();

    expect(screen.getByRole('header')).toHaveTextContent(enUS['verify.title']);
    expect(screen.getByTestId('verify-submit')).toBeOnTheScreen();
  });
  // Last in the file: unmounting the router's root leaves no tree for a later render.
  it('cancels the countdown timer when the screen goes away', async () => {
    await renderVerify();
    // `renderRouter` installs the fake timers, so the spy goes in afterwards.
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

    await act(async () => {
      screen.unmount();
    });

    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
  });
});
