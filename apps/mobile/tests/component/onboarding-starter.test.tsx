import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';
import { View } from 'react-native';
import StarterScreen from '@/app/(onboarding)/starter';
import ValuesScreen from '@/app/(onboarding)/values';
import { useSessionStore } from '@/features/auth/session-store';
import { createEmptyDraft, useOnboardingStore } from '@/features/onboarding/onboarding-store';
import { enUS } from '@/localization/en-US';
import { fakeBackend, TEST_USER } from './mocks/backend';
import type { OnboardingDraft } from '@/features/profile/profile-schema';

let mockColorScheme: 'light' | 'dark' = 'light';

jest.mock('@/hooks/use-color-scheme', () => ({ useColorScheme: () => mockColorScheme }));
jest.mock('@/localization/get-device-locale', () => ({ getDeviceLocale: () => 'en-US' }));

const store = () => useOnboardingStore.getState();

/** The completed S2 + S3 answers; S4 only has to add the written answer. */
function seedDraft(overrides: Partial<OnboardingDraft> = {}) {
  useOnboardingStore.setState({
    ...createEmptyDraft(),
    displayName: 'Rosa',
    birthDateInput: '14/03/1994',
    vibe: 'bookworm',
    lookingFor: 'everyone',
    unionMember: true,
    union: 'apeoesp',
    values: ['bookshops_coffee', 'tenant_rights', 'cycling'],
    sharedPassionWeight: 70,
    promptAnswer: '',
    ...overrides,
  });
}

/** Age the schema must compute for 14/03/1994, worked out here independently. */
function expectedAge() {
  const today = new Date();
  const month = today.getUTCMonth() + 1;
  const birthdayPassed = month > 3 || (month === 3 && today.getUTCDate() >= 14);
  return today.getUTCFullYear() - 1994 - (birthdayPassed ? 0 : 1);
}

beforeEach(() => {
  mockColorScheme = 'light';
  useOnboardingStore.setState(createEmptyDraft());
  useSessionStore.getState().setSignedIn(TEST_USER, null);
});

async function renderStarter() {
  const result = renderRouter(
    {
      '(onboarding)/vibe': () => <View testID="vibe-route" />,
      '(onboarding)/values': ValuesScreen,
      '(onboarding)/starter': StarterScreen,
    },
    { initialUrl: '/starter' },
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

function expectedProfile() {
  return {
    displayName: 'Rosa',
    age: expectedAge(),
    vibe: 'bookworm',
    lookingFor: 'everyone',
    unionMember: true,
    union: 'apeoesp',
    values: ['bookshops_coffee', 'tenant_rights', 'cycling'],
    promptId: 'perfect_sunday',
    promptAnswer: 'Feira, then a long lunch.',
    photoPath: null,
  };
}

describe('StarterScreen (S4)', () => {
  it('shows step 3 of 3 with back, the prompt picker and the chosen prompt card', async () => {
    seedDraft();
    await renderStarter();

    expect(screen.getByTestId('onboarding-progress')).toHaveTextContent('Step 3 of 3');
    expect(screen.getByTestId('onboarding-back')).toBeOnTheScreen();
    expect(screen.getByRole('header')).toHaveTextContent(enUS['onboarding.starter.title']);
    expect(screen.getByText(enUS['onboarding.starter.lede'])).toBeOnTheScreen();
    expect(screen.getByText(enUS['onboarding.starter.prompt_label'])).toBeOnTheScreen();

    for (const id of [
      'perfect_sunday',
      'hill_to_die_on',
      'together_we_could',
      'green_flag',
      'weirdly_good_at',
    ] as const) {
      expect(screen.getByTestId(`prompt-${id}`)).toHaveProp('accessibilityRole', 'radio');
      expect(screen.getAllByText(enUS[`onboarding.prompt.${id}`]).length).toBeGreaterThan(0);
    }

    expect(
      within(screen.getByTestId('starter-prompt-card')).getByText(
        enUS['onboarding.prompt.perfect_sunday'],
      ),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('starter-answer')).toHaveProp(
      'accessibilityLabel',
      enUS['onboarding.starter.answer_label'],
    );
    expect(screen.getByTestId('starter-answer-count')).toHaveTextContent('0/280');
    expect(screen.getByText(enUS['onboarding.starter.voice_soon'])).toBeOnTheScreen();
  });

  it('swaps the card question when another prompt is picked', async () => {
    seedDraft();
    await renderStarter();

    await press('prompt-green_flag');

    expect(store().promptId).toBe('green_flag');
    expect(screen.getByTestId('prompt-green_flag')).toBeChecked();
    expect(screen.getByTestId('prompt-perfect_sunday')).not.toBeChecked();
    expect(
      within(screen.getByTestId('starter-prompt-card')).getByText(
        enUS['onboarding.prompt.green_flag'],
      ),
    ).toBeOnTheScreen();
  });

  it('keeps Finish disabled until a non-blank answer is written', async () => {
    seedDraft();
    await renderStarter();
    expect(screen.getByTestId('starter-finish')).toBeDisabled();

    await type('starter-answer', '   ');
    expect(screen.getByTestId('starter-finish')).toBeDisabled();

    await type('starter-answer', 'You know your neighbours by name.');
    expect(screen.getByTestId('starter-finish')).toBeEnabled();
  });

  it('counts the answer and never stores more than 280 characters', async () => {
    seedDraft();
    await renderStarter();

    await type('starter-answer', 'Feira.');
    expect(screen.getByTestId('starter-answer-count')).toHaveTextContent('6/280');

    await type('starter-answer', 'a'.repeat(300));
    expect(screen.getByTestId('starter-answer-count')).toHaveTextContent('280/280');
    expect(store().promptAnswer).toHaveLength(280);
  });

  it('writes both documents, resets the draft and flips the session to ready', async () => {
    seedDraft();
    await renderStarter();

    await type('starter-answer', '  Feira, then a long lunch.  ');
    await press('starter-finish');

    await waitFor(() => expect(useSessionStore.getState().status).toBe('ready'));

    const calls = fakeBackend.callsTo('saveOnboarding');
    expect(calls).toHaveLength(1);
    expect(calls[0].args).toEqual([
      TEST_USER.uid,
      {
        profile: expectedProfile(),
        account: { birthDate: '1994-03-14', sharedPassionWeight: 70 },
      },
      null,
    ]);
    expect(useSessionStore.getState().profile).toEqual(expectedProfile());
    expect(store().displayName).toBe('');
    expect(store().values).toEqual([]);
    expect(screen.queryByTestId('onboarding-error')).not.toBeOnTheScreen();
  });

  it('saves the photo with the documents and keeps the returned photoPath in the session', async () => {
    seedDraft({ photoUri: 'file:///tmp/me.jpg' });
    await renderStarter();

    await type('starter-answer', 'Feira, then a long lunch.');
    await press('starter-finish');

    await waitFor(() => expect(useSessionStore.getState().status).toBe('ready'));

    const calls = fakeBackend.callsTo('saveOnboarding');
    expect(calls).toHaveLength(1);
    expect(calls[0].args[2]).toBe('file:///tmp/me.jpg');
    expect(useSessionStore.getState().profile).toEqual({
      ...expectedProfile(),
      photoPath: 'photos/test-user/p1.jpg',
    });
    expect(store().photoUri).toBeNull();
  });

  it('saves without a photo as a null third argument', async () => {
    seedDraft();
    await renderStarter();

    await type('starter-answer', 'Feira, then a long lunch.');
    await press('starter-finish');

    await waitFor(() => expect(useSessionStore.getState().status).toBe('ready'));

    const calls = fakeBackend.callsTo('saveOnboarding');
    expect(calls[0].args[2]).toBeNull();
    expect(useSessionStore.getState().profile?.photoPath).toBeNull();
  });

  it('keeps the draft and explains a failed save', async () => {
    seedDraft();
    await renderStarter();
    fakeBackend.state.failNext.set('saveOnboarding', 'network');

    await type('starter-answer', 'Feira, then a long lunch.');
    await press('starter-finish');

    await waitFor(() => expect(screen.getByRole('alert')).toBeOnTheScreen());

    expect(screen.getByTestId('onboarding-error')).toHaveTextContent(enUS['onboarding.error.save']);
    expect(useSessionStore.getState().status).toBe('needsOnboarding');
    expect(store().promptAnswer).toBe('Feira, then a long lunch.');
    expect(screen.getByTestId('starter-finish')).toBeEnabled();
  });

  it('goes back to the values step', async () => {
    seedDraft();
    const result = renderRouter(
      {
        '(onboarding)/values': ValuesScreen,
        '(onboarding)/starter': StarterScreen,
      },
      { initialUrl: '/values' },
    );
    await result;

    await press('onboarding-continue');
    expect(result.getPathname()).toBe('/starter');

    await press('onboarding-back');
    expect(result.getPathname()).toBe('/values');
  });

  it('does not write anything while the session has no user', async () => {
    seedDraft();
    useSessionStore.getState().setSignedOut();
    await renderStarter();

    await type('starter-answer', 'Feira.');
    await press('starter-finish');

    expect(fakeBackend.callsTo('saveOnboarding')).toHaveLength(0);
    expect(screen.queryByTestId('onboarding-error')).not.toBeOnTheScreen();
  });

  it('renders in the dark scheme', async () => {
    mockColorScheme = 'dark';
    seedDraft();
    await renderStarter();

    expect(screen.getByRole('header')).toHaveTextContent(enUS['onboarding.starter.title']);
    expect(screen.getByTestId('starter-answer')).toBeOnTheScreen();
  });
});
