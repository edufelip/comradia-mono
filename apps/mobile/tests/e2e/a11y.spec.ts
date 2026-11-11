import { expect, test } from '@playwright/test';
import { appRoot, gotoApp, welcomeCta } from './support/app';

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
