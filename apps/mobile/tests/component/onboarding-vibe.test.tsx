import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { View } from 'react-native';
import VibeScreen from '@/app/(onboarding)/vibe';
import { createEmptyDraft, useOnboardingStore } from '@/features/onboarding/onboarding-store';
import { enUS } from '@/localization/en-US';

let mockColorScheme: 'light' | 'dark' = 'light';

jest.mock('@/hooks/use-color-scheme', () => ({ useColorScheme: () => mockColorScheme }));
jest.mock('@/localization/get-device-locale', () => ({ getDeviceLocale: () => 'en-US' }));

const store = () => useOnboardingStore.getState();

beforeEach(() => {
  mockColorScheme = 'light';
  useOnboardingStore.setState(createEmptyDraft());
});

/**
 * `renderRouter` is built for RNTL 13's synchronous render (see docs/testing.md); keep a
 * plain handle instead of awaiting the thenable, which would drop the routing helpers.
 */
async function renderVibe() {
  const result = renderRouter(
    {
      '(onboarding)/vibe': VibeScreen,
      '(onboarding)/values': () => <View testID="values-route" />,
    },
    { initialUrl: '/vibe' },
  );
  await result;
  return { getPathname: () => result.getPathname() };
}

/** expo-router renders under a concurrent root: state changes only land inside `act`. */
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

async function blur(testID: string) {
  await act(async () => {
    fireEvent(screen.getByTestId(testID), 'blur');
  });
}

async function toggleUnion() {
  await press('union-toggle');
}

/** Fills everything S2 needs, leaving the union badge off. */
async function fillValidAnswers() {
  await type('onboarding-name', 'Rosa');
  await type('onboarding-birthday', '14031994');
  await press('vibe-bookworm');
  await press('looking-for-everyone');
}

describe('VibeScreen (S2)', () => {
  it('shows step 1 of 3 with no back button, the title, the lede and five vibe cards', async () => {
    await renderVibe();

    expect(screen.getByTestId('onboarding-progress')).toHaveTextContent('Step 1 of 3');
    expect(screen.queryByTestId('onboarding-back')).not.toBeOnTheScreen();
    expect(screen.getByRole('header', { name: enUS['onboarding.vibe.title'] })).toBeOnTheScreen();
    expect(screen.getByText(enUS['onboarding.vibe.lede'])).toBeOnTheScreen();

    for (const vibe of ['outdoorsy', 'bookworm', 'creative', 'community', 'foodie'] as const) {
      expect(screen.getByTestId(`vibe-${vibe}`)).toBeOnTheScreen();
      expect(screen.getByText(enUS[`onboarding.vibe.${vibe}`])).toBeOnTheScreen();
      expect(screen.getByText(enUS[`onboarding.vibe.${vibe}_desc`])).toBeOnTheScreen();
    }
    expect(screen.getByTestId('vibe-bookworm')).toHaveProp('accessibilityRole', 'radio');
  });

  it('keeps Continue disabled until name, birthday, vibe and looking-for are answered', async () => {
    await renderVibe();
    expect(screen.getByTestId('onboarding-continue')).toBeDisabled();

    await type('onboarding-name', 'Rosa');
    expect(screen.getByTestId('onboarding-continue')).toBeDisabled();

    await type('onboarding-birthday', '14031994');
    expect(screen.getByTestId('onboarding-continue')).toBeDisabled();

    await press('vibe-bookworm');
    expect(screen.getByTestId('onboarding-continue')).toBeDisabled();

    await press('looking-for-everyone');
    expect(screen.getByTestId('onboarding-continue')).toBeEnabled();
  });

  it('selects one vibe and one looking-for at a time', async () => {
    await renderVibe();

    await press('vibe-bookworm');
    expect(screen.getByTestId('vibe-bookworm')).toBeChecked();
    expect(screen.getByTestId('vibe-foodie')).not.toBeChecked();

    await press('vibe-foodie');
    expect(screen.getByTestId('vibe-foodie')).toBeChecked();
    expect(screen.getByTestId('vibe-bookworm')).not.toBeChecked();
    expect(store().vibe).toBe('foodie');

    await press('looking-for-women');
    expect(screen.getByTestId('looking-for-women')).toBeChecked();
    await press('looking-for-everyone');
    expect(screen.getByTestId('looking-for-everyone')).toBeChecked();
    expect(screen.getByTestId('looking-for-women')).not.toBeChecked();
    expect(store().lookingFor).toBe('everyone');
  });

  it('reveals the union chips only for members and forgets the union when the badge goes off', async () => {
    await renderVibe();
    expect(screen.queryByTestId('union-apeoesp')).not.toBeOnTheScreen();

    await toggleUnion();
    expect(screen.getByTestId('union-toggle')).toHaveProp('accessibilityRole', 'switch');
    expect(screen.getByTestId('union-toggle')).toHaveProp(
      'accessibilityLabel',
      enUS['onboarding.union.title'],
    );
    expect(screen.getByTestId('union-toggle')).toBeChecked();
    expect(screen.getByTestId('union-apeoesp')).toBeOnTheScreen();

    await press('union-apeoesp');
    expect(screen.getByTestId('union-apeoesp')).toBeChecked();
    expect(store().union).toBe('apeoesp');

    await toggleUnion();
    expect(screen.getByTestId('union-toggle')).not.toBeChecked();
    expect(screen.queryByTestId('union-apeoesp')).not.toBeOnTheScreen();
    expect(store().unionMember).toBe(false);
    expect(store().union).toBeNull();
  });

  it('keeps Continue disabled while the union badge has no union selected', async () => {
    await renderVibe();
    await fillValidAnswers();
    expect(screen.getByTestId('onboarding-continue')).toBeEnabled();

    await toggleUnion();
    expect(screen.getByTestId('onboarding-continue')).toBeDisabled();

    await press('union-seesp');
    expect(screen.getByTestId('onboarding-continue')).toBeEnabled();
  });

  it('masks the birthday as DD/MM/YYYY while it is typed', async () => {
    await renderVibe();

    await type('onboarding-birthday', '14031994');

    expect(screen.getByTestId('onboarding-birthday')).toHaveProp('value', '14/03/1994');
    expect(store().birthDateInput).toBe('14/03/1994');
  });

  it('explains an under-18 birthday once the field is left', async () => {
    await renderVibe();

    await type('onboarding-name', 'Rosa');
    await type('onboarding-birthday', '01/01/2020');
    expect(screen.queryByText(enUS['onboarding.error.too_young'])).not.toBeOnTheScreen();

    await blur('onboarding-birthday');

    expect(screen.getByText(enUS['onboarding.error.too_young'])).toBeOnTheScreen();
    expect(screen.getByTestId('onboarding-continue')).toBeDisabled();
  });

  it('explains a birthday that is not a real date', async () => {
    await renderVibe();

    await type('onboarding-name', 'Rosa');
    await type('onboarding-birthday', '31042000');
    await blur('onboarding-birthday');

    expect(screen.getByText(enUS['onboarding.error.birth_date_invalid'])).toBeOnTheScreen();
  });

  it('asks for a first name once an empty field is left', async () => {
    await renderVibe();

    await blur('onboarding-name');

    expect(screen.getByText(enUS['onboarding.error.name_required'])).toBeOnTheScreen();
  });

  it('shows the birthday hint while the date is still valid', async () => {
    await renderVibe();

    expect(screen.getByText(enUS['onboarding.basics.birthday_hint'])).toBeOnTheScreen();
  });

  it('goes to the values step with the finished answers', async () => {
    const router = await renderVibe();
    await fillValidAnswers();

    await press('onboarding-continue');

    expect(router.getPathname()).toBe('/values');
    expect(store().vibe).toBe('bookworm');
  });

  it('renders in the dark scheme', async () => {
    mockColorScheme = 'dark';

    await renderVibe();

    expect(screen.getByRole('header', { name: enUS['onboarding.vibe.title'] })).toBeOnTheScreen();
    expect(screen.getByTestId('vibe-outdoorsy')).toBeOnTheScreen();
  });
});
