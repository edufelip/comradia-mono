import { expect, test, type Page } from '@playwright/test';

import { appRoot, gotoApp, welcomeCta } from './support/app';
import { signUpWithPhone } from './support/firebase';
import { completeOnboarding } from './support/onboarding';

const deck = (page: Page) => page.getByTestId('discover-screen');
const profile = (page: Page) => page.getByTestId('profile-screen');

/** A fresh account sitting on /discover, so the tab screens have data to expose. */
async function readyUser(page: Page): Promise<void> {
  await signUpWithPhone(page);
  await completeOnboarding(page);
}

test.describe('welcome accessibility', () => {
  test('headline is a heading and both CTAs are named buttons', async ({ page }) => {
    await gotoApp(page);
    await expect(welcomeCta(page, 'start')).toBeVisible();

    await expect(
      page.getByRole('heading', { level: 1, name: 'Meet someone who gives a damn.' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Find your person →' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'I already have an account' })).toBeVisible();

    const snapshot = await appRoot(page).ariaSnapshot();
    expect(snapshot).toContain('- heading "Meet someone who gives a damn." [level=1]');
    expect(snapshot).toContain('- button "Find your person →"');
    expect(snapshot).toContain('- button "I already have an account"');
  });

  test('decorative welcome art stays out of the accessibility tree', async ({ page }) => {
    await gotoApp(page);
    await expect(welcomeCta(page, 'start')).toBeVisible();

    await expect(appRoot(page).getByRole('img')).toHaveCount(0, { timeout: 1_500 });
  });
});

test.describe('discover accessibility', () => {
  test('has a heading, named action buttons and no unlabelled images', async ({ page }) => {
    await readyUser(page);

    await expect(deck(page).getByRole('heading', { name: 'Comradia' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Like' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pass' })).toBeVisible();

    const snapshot = await deck(page).ariaSnapshot();
    expect(snapshot).toContain('- heading "Comradia"');
    expect(snapshot).toContain('- button "Like"');
    expect(snapshot).toContain('- button "Pass"');

    await expect(deck(page).getByRole('img')).toHaveCount(0, { timeout: 1_500 });
  });

  test('the tab bar exposes named tabs and hides its icons', async ({ page }) => {
    await readyUser(page);

    for (const label of ['Discover', 'Matches', 'Profile']) {
      await expect(page.getByRole('tab', { name: new RegExp(label) })).toBeVisible();
    }

    const snapshot = await appRoot(page).ariaSnapshot();
    expect(snapshot).toContain('- tab "Discover');
    expect(snapshot).toContain('- tab "Matches');
    expect(snapshot).toContain('- tab "Profile');
  });
});

test.describe('profile accessibility', () => {
  test('has a heading, the own card and a named Sign out button', async ({ page }) => {
    await readyUser(page);

    await page.getByRole('tab', { name: /Profile/ }).click();
    await expect(profile(page).getByRole('heading', { name: 'Your Profile' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();

    const snapshot = await profile(page).ariaSnapshot();
    expect(snapshot).toContain('- heading "Your Profile"');
    expect(snapshot).toContain('- button "Sign out"');

    await expect(profile(page).getByRole('img')).toHaveCount(0, { timeout: 1_500 });
  });
});
