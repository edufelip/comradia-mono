import { expect, test } from '@playwright/test';
import { enterApp, expectPathname, expectWelcomeScreen, gotoApp, welcomeCta } from './support/app';

test.describe('onboarding to discover', () => {
  test('"Find your person" opens the Discover tab', async ({ page }) => {
    await gotoApp(page);
    await expectWelcomeScreen(page);

    await welcomeCta(page, 'start').click();

    await expectPathname(page, '/');
    await expect(page.getByText('Maya, 28', { exact: true })).toBeVisible();
    await expect(page.getByText('she/her · São Paulo')).toBeVisible();
  });

  test('"I already have an account" opens the Discover tab too', async ({ page }) => {
    await gotoApp(page);
    await expectWelcomeScreen(page);

    await welcomeCta(page, 'login').click();

    await expectPathname(page, '/');
    await expect(page.getByText('Maya, 28', { exact: true })).toBeVisible();
  });

  test('the tab bar shows Discover, Matches and Profile', async ({ page }) => {
    await gotoApp(page);
    await enterApp(page);

    for (const label of ['Discover', 'Matches', 'Profile']) {
      // Native tab items expose the icon glyph as text, so match on the visible label.
      await expect(page.getByRole('tab', { name: new RegExp(label) })).toBeVisible();
    }
  });

  test('CURRENT BEHAVIOUR: reloading after sign-in returns to /welcome', async ({ page }) => {
    // Documents the S1 shortcut: features/auth/session-store.ts keeps the session in memory,
    // so a reload is a cold start. Replace this expectation when S1B persists the session.
    await gotoApp(page);
    await enterApp(page);
    await expectPathname(page, '/');

    await page.reload();

    await expectWelcomeScreen(page);
  });
});
