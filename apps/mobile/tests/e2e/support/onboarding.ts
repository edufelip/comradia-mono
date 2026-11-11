import { expect, type Page } from '@playwright/test';
import { expectPathname } from './app';

/**
 * Every onboarding screen stays mounted in the stack, so `onboarding-continue` and
 * `onboarding-back` exist more than once. Scope each interaction to the screen that is
 * on top: `onboarding-vibe`, `onboarding-values`, `onboarding-starter`.
 */
export function onboardingStep(page: Page, step: 'vibe' | 'values' | 'starter') {
  return page.getByTestId(`onboarding-${step}`);
}

/**
 * Fills S2–S4 with valid answers and finishes onboarding. Starts on `/vibe` (right after
 * `signUpWithPhone`) and ends on `/discover`. Uses the test ids in docs/architecture.md.
 */
export async function completeOnboarding(
  page: Page,
  { name = 'Rosa', birthday = '14/03/1994' }: { name?: string; birthday?: string } = {},
): Promise<void> {
  await expectPathname(page, '/vibe');
  const vibe = onboardingStep(page, 'vibe');
  await vibe.getByTestId('onboarding-name').fill(name);
  await vibe.getByTestId('onboarding-birthday').fill(birthday);
  await vibe.getByTestId('vibe-bookworm').click();
  await vibe.getByTestId('looking-for-everyone').click();
  await vibe.getByTestId('onboarding-continue').click();

  await expectPathname(page, '/values');
  const values = onboardingStep(page, 'values');
  for (const id of ['bookshops_coffee', 'tenant_rights', 'cycling']) {
    await values.getByTestId(`value-${id}`).click();
  }
  await values.getByTestId('onboarding-continue').click();

  await expectPathname(page, '/starter');
  const starter = onboardingStep(page, 'starter');
  await starter.getByTestId('prompt-green_flag').click();
  await starter.getByTestId('starter-answer').fill('You know your neighbours by name.');
  await starter.getByTestId('starter-finish').click();

  await expectPathname(page, '/discover');
  await expect(page.getByTestId('discover-like')).toBeVisible();
}
