import { expect, type Page } from '@playwright/test';

import { expectPathname } from './app';

/**
 * Fills S2–S4 with valid answers and finishes onboarding. Starts on `/vibe` (right after
 * `signUpWithPhone`) and ends on `/discover`. Uses the test ids in docs/architecture.md.
 */
export async function completeOnboarding(
  page: Page,
  { name = 'Rosa', birthday = '14/03/1994' }: { name?: string; birthday?: string } = {},
): Promise<void> {
  await expectPathname(page, '/vibe');
  await page.getByTestId('onboarding-name').fill(name);
  await page.getByTestId('onboarding-birthday').fill(birthday);
  await page.getByTestId('vibe-bookworm').click();
  await page.getByTestId('looking-for-everyone').click();
  await page.getByTestId('onboarding-continue').click();

  await expectPathname(page, '/values');
  for (const id of ['bookshops_coffee', 'tenant_rights', 'cycling']) {
    await page.getByTestId(`value-${id}`).click();
  }
  await page.getByTestId('onboarding-continue').click();

  await expectPathname(page, '/starter');
  await page.getByTestId('prompt-green_flag').click();
  await page.getByTestId('starter-answer').fill('You know your neighbours by name.');
  await page.getByTestId('starter-finish').click();

  await expectPathname(page, '/discover');
  await expect(page.getByTestId('discover-like')).toBeVisible();
}
