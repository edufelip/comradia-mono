import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { View } from 'react-native';
import ValuesScreen from '@/app/(onboarding)/values';
import VibeScreen from '@/app/(onboarding)/vibe';
import { createEmptyDraft, useOnboardingStore } from '@/features/onboarding/onboarding-store';
import { VALUE_ICONS } from '@/features/onboarding/visuals';
import { VALUE_IDS } from '@/features/profile/profile-schema';
import { enUS } from '@/localization/en-US';

let mockColorScheme: 'light' | 'dark' = 'light';

jest.mock('@/hooks/use-color-scheme', () => ({ useColorScheme: () => mockColorScheme }));
jest.mock('@/localization/get-device-locale', () => ({ getDeviceLocale: () => 'en-US' }));

const store = () => useOnboardingStore.getState();

beforeEach(() => {
  mockColorScheme = 'light';
  useOnboardingStore.setState(createEmptyDraft());
});

async function renderValues(initialUrl = '/values') {
  const result = renderRouter(
    {
      '(onboarding)/vibe': VibeScreen,
      '(onboarding)/values': ValuesScreen,
      '(onboarding)/starter': () => <View testID="starter-route" />,
    },
    { initialUrl },
  );
  await result;
  return { getPathname: () => result.getPathname() };
}

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

async function chooseThree() {
  await press('value-bookshops_coffee');
  await press('value-tenant_rights');
  await press('value-cycling');
}

describe('ValuesScreen (S3)', () => {
  it('shows step 2 of 3 with back, the ten value chips and the weight', async () => {
    await renderValues();

    expect(screen.getByTestId('onboarding-progress')).toHaveTextContent('Step 2 of 3');
    expect(screen.getByTestId('onboarding-back')).toBeOnTheScreen();
    expect(screen.getByRole('header')).toHaveTextContent(enUS['onboarding.values.title']);
    expect(screen.getByText(enUS['onboarding.values.lede'])).toBeOnTheScreen();
    expect(screen.getByTestId('values-count')).toHaveTextContent('0/5');

    for (const id of VALUE_IDS) {
      const chip = screen.getByTestId(`value-${id}`);
      expect(chip).toHaveProp('accessibilityRole', 'checkbox');
      expect(
        screen.getByText(`${VALUE_ICONS[id]} ${enUS[`onboarding.values.${id}`]}`),
      ).toBeOnTheScreen();
    }

    expect(screen.getByText(enUS['onboarding.values.weight'])).toBeOnTheScreen();
    expect(screen.getByText(enUS['onboarding.values.weight_hint'])).toBeOnTheScreen();
    expect(screen.getByTestId('weight-value')).toHaveTextContent('60%');
  });

  it('keeps Continue disabled until three values are chosen', async () => {
    await renderValues();
    expect(screen.getByTestId('onboarding-continue')).toBeDisabled();

    await press('value-bookshops_coffee');
    await press('value-tenant_rights');
    expect(screen.getByTestId('onboarding-continue')).toBeDisabled();

    await press('value-cycling');
    expect(screen.getByTestId('onboarding-continue')).toBeEnabled();
    expect(screen.getByTestId('values-count')).toHaveTextContent('3/5');
  });

  it('stops at five and disables the chips that are still off', async () => {
    await renderValues();
    for (const id of VALUE_IDS.slice(0, 5)) {
      await press(`value-${id}`);
    }

    expect(screen.getByTestId('values-count')).toHaveTextContent('5/5');
    expect(screen.getByTestId('value-volunteering')).toBeDisabled();
    expect(screen.getByTestId('value-bookshops_coffee')).toBeEnabled();

    await press('value-volunteering');
    expect(store().values).toHaveLength(5);
  });

  it('frees a slot when a chosen value is tapped again', async () => {
    await renderValues();
    await chooseThree();
    expect(screen.getByTestId('value-cycling')).toBeChecked();

    await press('value-cycling');

    expect(screen.getByTestId('value-cycling')).not.toBeChecked();
    expect(screen.getByTestId('values-count')).toHaveTextContent('2/5');
    expect(screen.getByTestId('onboarding-continue')).toBeDisabled();
  });

  it('steps the shared-passion weight by ten and clamps it to 0–100', async () => {
    await renderValues();

    await press('weight-increase');
    expect(screen.getByTestId('weight-value')).toHaveTextContent('70%');

    await press('weight-decrease');
    await press('weight-decrease');
    expect(screen.getByTestId('weight-value')).toHaveTextContent('50%');

    for (let i = 0; i < 6; i += 1) {
      await press('weight-increase');
    }
    expect(screen.getByTestId('weight-value')).toHaveTextContent('100%');
    expect(screen.getByTestId('weight-increase')).toBeDisabled();
    expect(store().sharedPassionWeight).toBe(100);

    for (let i = 0; i < 11; i += 1) {
      await press('weight-decrease');
    }
    expect(screen.getByTestId('weight-value')).toHaveTextContent('0%');
    expect(screen.getByTestId('weight-decrease')).toBeDisabled();
  });

  it('exposes the weight as an adjustable element for screen readers', async () => {
    await renderValues();

    const weight = screen.getByTestId('weight-value');
    expect(weight).toHaveProp('accessibilityRole', 'adjustable');
    expect(weight).toHaveAccessibilityValue({ min: 0, max: 100, now: 60, text: '60%' });

    await act(async () => {
      fireEvent(weight, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    });
    expect(screen.getByTestId('weight-value')).toHaveTextContent('70%');

    await act(async () => {
      fireEvent(weight, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    });
    expect(screen.getByTestId('weight-value')).toHaveTextContent('60%');
  });

  it('goes to the starter step', async () => {
    const router = await renderValues();
    await chooseThree();

    await press('onboarding-continue');

    expect(router.getPathname()).toBe('/starter');
  });

  it('goes back to the vibe step with the answers kept', async () => {
    const router = await renderValues('/vibe');

    await type('onboarding-name', 'Rosa');
    await type('onboarding-birthday', '14031994');
    await press('vibe-bookworm');
    await press('looking-for-everyone');
    await press('onboarding-continue');
    expect(router.getPathname()).toBe('/values');

    await chooseThree();
    await press('onboarding-back');

    expect(router.getPathname()).toBe('/vibe');
    expect(screen.getByTestId('vibe-bookworm')).toBeChecked();
    expect(store().values).toHaveLength(3);
  });

  it('renders in the dark scheme', async () => {
    mockColorScheme = 'dark';

    await renderValues();

    expect(screen.getByRole('header')).toHaveTextContent(enUS['onboarding.values.title']);
    expect(screen.getByTestId('value-cycling')).toBeOnTheScreen();
  });
});
