import { useState } from 'react';
import { render } from '@testing-library/react-native';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import * as Reanimated from 'react-native-reanimated';
import { StyleSheet, View } from 'react-native';
import RegisterScreen from '@/app/(auth)/register';
import VerifyPhoneScreen from '@/app/(auth)/verify-phone';
import WelcomeScreen from '@/app/(auth)/welcome';
import StarterScreen from '@/app/(onboarding)/starter';
import ValuesScreen from '@/app/(onboarding)/values';
import VibeScreen from '@/app/(onboarding)/vibe';
import { CodeField } from '@/features/auth/components/code-field';
import { useSessionStore } from '@/features/auth/session-store';
import { createEmptyDraft, useOnboardingStore } from '@/features/onboarding/onboarding-store';
import { OnboardingStepper } from '@/features/onboarding/components/OnboardingStepper';
import { DsSwitch } from '@/components/ds/primitives/DsSwitch';
import { enUS } from '@/localization/en-US';
import { fakeBackend, TEST_USER } from './mocks/backend';

let mockColorScheme: 'light' | 'dark' = 'light';

jest.mock('@/hooks/use-color-scheme', () => ({ useColorScheme: () => mockColorScheme }));
jest.mock('@/localization/get-device-locale', () => ({ getDeviceLocale: () => 'en-US' }));
jest.mock('expo-apple-authentication', () => ({
  AppleAuthenticationButton: () => null,
  AppleAuthenticationButtonStyle: { BLACK: 2, WHITE: 0, WHITE_OUTLINE: 1 },
  AppleAuthenticationButtonType: { CONTINUE: 1, SIGN_IN: 0, SIGN_UP: 2 },
}));

const PHONE = '+5511987654321';
const HIDDEN = { includeHiddenElements: true };

beforeEach(() => {
  mockColorScheme = 'light';
  useOnboardingStore.setState(createEmptyDraft());
});

async function press(testID: string) {
  await act(async () => {
    fireEvent.press(screen.getByTestId(testID));
  });
}

async function type(testID: string, text: string) {
  await act(async () => {
    fireEvent.changeText(screen.getByTestId(testID), text);
  });
}

describe('auth and onboarding motion', () => {
  it('shows the welcome story immediately and keeps its start action usable with reduced motion', async () => {
    jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true);
    const router = renderRouter(
      {
        '(auth)/welcome': WelcomeScreen,
        '(auth)/register': RegisterScreen,
      },
      { initialUrl: '/welcome' },
    );
    await router;

    expect(screen.getByTestId('welcome-story-motion')).toBeOnTheScreen();
    await press('welcome-cta-start');

    expect(router.getPathname()).toBe('/register');
    expect(screen.getByTestId('register-phone-input')).toBeOnTheScreen();
  });

  it('keeps the auth panel usable as its heading changes when motion is reduced', async () => {
    jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true);
    const router = renderRouter({ '(auth)/register': RegisterScreen }, { initialUrl: '/register' });
    await router;

    expect(screen.queryByTestId('register-heading-motion')).not.toBeOnTheScreen();
    expect(
      StyleSheet.flatten(screen.getByTestId('register-phone-input.motion').props.style),
    ).toMatchObject({ transform: [{ scale: 1 }] });
    await type('register-phone-input', '11987654321');
    expect(screen.getByTestId('register-send-code-motion')).toBeOnTheScreen();
    await press('register-switch-mode');

    await waitFor(() =>
      expect(screen.getByRole('header')).toHaveTextContent(enUS['auth.title_login']),
    );
    expect(screen.getByTestId('register-heading-motion')).toBeOnTheScreen();
    expect(screen.getByTestId('register-phone-input')).toHaveDisplayValue('(11) 98765-4321');
    expect(screen.getByTestId('register-send-code')).toBeEnabled();
  });

  it('keeps OTP entry ready while an invalid-code acknowledgement appears', async () => {
    jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true);
    fakeBackend.state.failNext.set('confirmPhoneCode', 'invalid_code');
    const router = renderRouter(
      {
        '(auth)/register': RegisterScreen,
        '(auth)/verify-phone': VerifyPhoneScreen,
      },
      { initialUrl: `/verify-phone?phone=${encodeURIComponent(PHONE)}` },
    );
    await router;

    expect(screen.getByTestId('verify-code-input')).toHaveAccessibleName(enUS['verify.code_label']);
    expect(screen.getByTestId('verify-code-input')).toHaveProp('autoFocus', true);
    expect(screen.getByTestId('verify-code-input')).toHaveProp('keyboardType', 'number-pad');
    await act(async () => {
      fireEvent(screen.getByTestId('verify-code-input'), 'focus');
    });
    expect(
      StyleSheet.flatten(screen.getByTestId('verify-code-input.motion', HIDDEN).props.style),
    ).toMatchObject({ transform: [{ scale: 1 }] });
    await type('verify-code-input', '000000');

    expect(await screen.findByTestId('verify-error-motion')).toBeOnTheScreen();
    expect(screen.getByTestId('verify-error')).toHaveTextContent(enUS['auth.error.invalid_code']);
    expect(screen.getByTestId('verify-code-input')).toHaveDisplayValue('');
    expect(screen.getByTestId('verify-submit')).toBeDisabled();
  });

  it('marks a completed code cell without replacing the accessible OTP input', async () => {
    jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true);
    await render(
      <CodeField
        label="SMS code"
        onChangeText={jest.fn()}
        scheme="light"
        testID="motion-code-input"
        value="123456"
      />,
    );

    expect(screen.getByTestId('motion-code-input.complete-motion', HIDDEN)).toBeOnTheScreen();
    expect(screen.getByTestId('motion-code-input')).toHaveAccessibleName('SMS code');
    expect(screen.getByTestId('motion-code-input')).toHaveProp('autoFocus', true);
    expect(screen.getByTestId('motion-code-input')).toHaveProp('maxLength', 6);
  });

  it('acknowledges an onboarding choice and updates progress without delaying continue', async () => {
    jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true);
    const router = renderRouter(
      { '(onboarding)/values': ValuesScreen, '(onboarding)/starter': () => <View /> },
      { initialUrl: '/values' },
    );
    await router;

    expect(screen.getByTestId('onboarding-progress-motion', HIDDEN)).toBeOnTheScreen();
    expect(
      StyleSheet.flatten(screen.getByTestId('onboarding-progress-motion', HIDDEN).props.style),
    ).toMatchObject({ transform: [{ scaleX: 1 }], transformOrigin: 'left center' });
    await press('value-bookshops_coffee');
    await press('value-tenant_rights');
    await press('value-cycling');

    expect(screen.getByTestId('value-cycling-selected-motion')).toBeOnTheScreen();
    expect(screen.getByTestId('values-count')).toHaveTextContent('3/5');
    expect(screen.getByTestId('onboarding-continue')).toBeEnabled();
  });

  it('animates the selected vibe without changing its radio behavior', async () => {
    jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true);
    const router = renderRouter({ '(onboarding)/vibe': VibeScreen }, { initialUrl: '/vibe' });
    await router;

    await press('vibe-bookworm');

    expect(screen.getByTestId('vibe-bookworm')).toBeChecked();
    expect(screen.getByTestId('vibe-bookworm-selected-motion')).toBeOnTheScreen();
    expect(screen.getByTestId('onboarding-continue')).toBeDisabled();
  });

  it('keeps the union switch and passion stepper immediate with reduced motion', async () => {
    jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true);

    function ControlsHarness() {
      const [unionMember, setUnionMember] = useState(false);
      const [weight, setWeight] = useState(60);

      return (
        <View>
          <DsSwitch
            accessibilityLabel="Union member"
            onValueChange={setUnionMember}
            scheme="light"
            testID="motion-union-toggle"
            value={unionMember}
          />
          <OnboardingStepper
            decreaseLabel="Lower weight"
            hint="How much shared passions matter"
            increaseLabel="Raise weight"
            label="Shared-passion weight"
            onChange={setWeight}
            scheme="light"
            value={weight}
            valueText={`${weight}%`}
          />
        </View>
      );
    }

    await render(<ControlsHarness />);
    expect(screen.getByRole('switch', { name: 'Union member' })).not.toBeChecked();
    await press('motion-union-toggle');

    expect(screen.getByRole('switch', { name: 'Union member' })).toBeChecked();
    expect(
      StyleSheet.flatten(screen.getByTestId('motion-union-toggle.thumb').props.style),
    ).toMatchObject({ transform: [{ translateX: 16 }] });

    await press('weight-increase');

    expect(screen.getByTestId('weight-value')).toHaveAccessibilityValue({
      max: 100,
      min: 0,
      now: 70,
      text: '70%',
    });
    expect(screen.getByTestId('weight-value-motion')).toBeOnTheScreen();
    expect(screen.getByText('70%')).toBeOnTheScreen();
  });

  it('acknowledges a failed final save and keeps the draft available for retry', async () => {
    jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true);
    useSessionStore.getState().setSignedIn(TEST_USER, null);
    useOnboardingStore.setState({
      ...createEmptyDraft(),
      displayName: 'Rosa',
      birthDateInput: '14/03/1994',
      vibe: 'bookworm',
      lookingFor: 'everyone',
      values: ['bookshops_coffee', 'tenant_rights', 'cycling'],
      promptAnswer: '',
      sensitiveDataConsent: true,
    });
    fakeBackend.state.failNext.set('saveOnboarding', 'network');

    const router = renderRouter(
      { '(onboarding)/starter': StarterScreen },
      { initialUrl: '/starter' },
    );
    await router;
    await type('starter-answer', 'A long lunch with friends.');
    await press('starter-finish');

    expect(await screen.findByTestId('onboarding-error-motion')).toBeOnTheScreen();
    expect(screen.getByRole('alert')).toHaveTextContent(enUS['onboarding.error.save']);
    expect(screen.getByTestId('starter-answer')).toHaveDisplayValue('A long lunch with friends.');
    await waitFor(() => expect(screen.getByTestId('starter-finish')).toBeEnabled());
  });
});
