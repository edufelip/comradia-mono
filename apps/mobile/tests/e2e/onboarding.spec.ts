import { expect, type Page, test } from '@playwright/test';
import { expectPathname } from './support/app';
import { latestSmsCode, uniquePhone } from './support/firebase';
import { completeOnboarding, onboardingStep } from './support/onboarding';

// Same project and emulator as apps/firebase/firebase.json and services/backend/config.ts.
const FIRESTORE = 'http://127.0.0.1:8089';
const PROJECT = 'demo-comradia';
/** The emulator's admin token: rules are bypassed, so the test reads the raw documents. */
const ADMIN_HEADERS = { Authorization: 'Bearer owner' };

type FirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { nullValue: null }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { timestampValue: string };

type FirestoreDocument = { name: string; fields?: Record<string, FirestoreValue> };

function decode(value: FirestoreValue): unknown {
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('nullValue' in value) return null;
  if ('arrayValue' in value) return (value.arrayValue.values ?? []).map(decode);
  if ('timestampValue' in value) return value.timestampValue;
  return undefined;
}

function decodeFields(document: FirestoreDocument): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(document.fields ?? {}).map(([key, value]) => [key, decode(value)]),
  );
}

async function listProfiles(): Promise<{ id: string; data: Record<string, unknown> }[]> {
  const response = await fetch(
    // The emulator pages lists at 30; a full run creates more profiles than that.
    // shortcut: one 1000-doc page, switch to a runQuery on displayName if a run ever creates more.
    `${FIRESTORE}/v1/projects/${PROJECT}/databases/(default)/documents/profiles?pageSize=1000`,
    { headers: ADMIN_HEADERS },
  );
  expect(response.ok).toBeTruthy();
  const body = (await response.json()) as { documents?: FirestoreDocument[] };
  return (body.documents ?? []).map((document) => ({
    id: document.name.split('/').pop() as string,
    data: decodeFields(document),
  }));
}

async function readDocument(path: string): Promise<Record<string, unknown> | null> {
  const response = await fetch(
    `${FIRESTORE}/v1/projects/${PROJECT}/databases/(default)/documents/${path}`,
    { headers: ADMIN_HEADERS },
  );
  if (response.status === 404) return null;
  expect(response.ok).toBeTruthy();
  return decodeFields((await response.json()) as FirestoreDocument);
}

/**
 * Local sign-up: `signUpWithPhone` also clicks `verify-submit`, but the code screen
 * submits itself as soon as the sixth digit is typed (`verify-phone.tsx`), so by then the
 * button is busy or already gone and the click times out under parallel load.
 */
async function signUp(page: Page, nationalDigits = uniquePhone()): Promise<void> {
  await page.goto('/');
  await page.getByTestId('welcome-cta-start').click();
  await page.getByTestId('register-phone-input').fill(nationalDigits);
  await page.getByTestId('register-send-code').click();
  await page.getByTestId('verify-code-input').fill(await latestSmsCode(`+55${nationalDigits}`));
  await expectPathname(page, '/vibe');
}

function continueButton(page: Page, step: 'vibe' | 'values' | 'starter' = 'vibe') {
  return onboardingStep(page, step).getByTestId('onboarding-continue');
}

async function fillBasics(page: Page, name = 'Rosa', birthday = '14/03/1994') {
  const vibe = onboardingStep(page, 'vibe');
  await vibe.getByTestId('onboarding-name').fill(name);
  await vibe.getByTestId('onboarding-birthday').fill(birthday);
}

test.describe('onboarding S2–S4', () => {
  test('a new account finishes onboarding and lands on the Discover deck', async ({ page }) => {
    await signUp(page);

    await completeOnboarding(page);

    await expectPathname(page, '/discover');
    await expect(page.getByTestId('discover-like')).toBeVisible();
  });

  test('reloading keeps the finished session on Discover', async ({ page }) => {
    await signUp(page);
    await completeOnboarding(page);

    await page.reload();

    await expectPathname(page, '/discover');
    await expect(page.getByTestId('discover-like')).toBeVisible();
    await expect(page.getByTestId('onboarding-name')).toHaveCount(0);
  });

  test('an under-18 birthday blocks Continue and says why', async ({ page }) => {
    await signUp(page);
    await expectPathname(page, '/vibe');

    await fillBasics(page, 'Rosa', '01/01/2020');
    await onboardingStep(page, 'vibe').getByTestId('onboarding-name').click();
    await expect(page.getByText('You need to be 18 or older to use Comradia.')).toBeVisible();
    await expect(continueButton(page)).toHaveAttribute('aria-disabled', 'true');

    await onboardingStep(page, 'vibe').getByTestId('onboarding-birthday').fill('14/03/1994');
    await onboardingStep(page, 'vibe').getByTestId('vibe-bookworm').click();
    await onboardingStep(page, 'vibe').getByTestId('looking-for-everyone').click();

    await expect(continueButton(page)).not.toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByText('You need to be 18 or older to use Comradia.')).toHaveCount(0);
  });

  test('going back from Values keeps the vibe answers', async ({ page }) => {
    await signUp(page);
    await expectPathname(page, '/vibe');

    await fillBasics(page);
    await onboardingStep(page, 'vibe').getByTestId('vibe-bookworm').click();
    await onboardingStep(page, 'vibe').getByTestId('looking-for-everyone').click();
    await continueButton(page, 'vibe').click();
    await expectPathname(page, '/values');

    await onboardingStep(page, 'values').getByTestId('onboarding-back').click();

    await expectPathname(page, '/vibe');
    await expect(onboardingStep(page, 'vibe').getByTestId('onboarding-name')).toHaveValue('Rosa');
    await expect(onboardingStep(page, 'vibe').getByTestId('onboarding-birthday')).toHaveValue(
      '14/03/1994',
    );
    await expect(onboardingStep(page, 'vibe').getByTestId('vibe-bookworm')).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(onboardingStep(page, 'vibe').getByTestId('looking-for-everyone')).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  test('writes the public profile and the private account, with no private field in public', async ({
    page,
  }) => {
    const nationalDigits = uniquePhone();
    const displayName = `E2E ${nationalDigits}`;

    await signUp(page, nationalDigits);
    await completeOnboarding(page, { name: displayName });

    // The app may leave S4 before the REST listing sees the write (seen on WebKit).
    let profile: Awaited<ReturnType<typeof listProfiles>>[number] | undefined;
    await expect
      .poll(async () => {
        profile = (await listProfiles()).find(
          (candidate) => candidate.data.displayName === displayName,
        );
        return profile;
      })
      .toBeDefined();
    const uid = profile?.id as string;

    // Everything the public card may hold and nothing else: the birth date and the
    // shared-passion weight stay in the owner-only `users/{uid}` document.
    expect(Object.keys(profile?.data ?? {}).sort()).toEqual([
      'age',
      'createdAt',
      'displayName',
      'lookingFor',
      'promptAnswer',
      'promptId',
      'union',
      'unionMember',
      'updatedAt',
      'values',
      'vibe',
    ]);
    expect(profile?.data).toMatchObject({
      displayName,
      vibe: 'bookworm',
      lookingFor: 'everyone',
      unionMember: false,
      union: null,
      values: ['bookshops_coffee', 'tenant_rights', 'cycling'],
      promptId: 'green_flag',
      promptAnswer: 'You know your neighbours by name.',
    });
    expect(typeof profile?.data.age).toBe('number');
    expect(profile?.data.age as number).toBeGreaterThanOrEqual(18);

    const account = await readDocument(`users/${uid}`);
    expect(account).toMatchObject({ birthDate: '1994-03-14', sharedPassionWeight: 60 });
    expect(account).toHaveProperty('createdAt');
    expect(account).not.toHaveProperty('displayName');
  });
});
