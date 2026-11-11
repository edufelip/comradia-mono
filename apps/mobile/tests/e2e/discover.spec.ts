import { expect, test } from '@playwright/test';
import { enterApp, expectPathname, gotoApp } from './support/app';

const DECK = ['Maya, 28', 'Lucas, 31', 'Val, 26'];

test.describe('discover deck', () => {
  test('Like advances the deck and puts the person on Matches', async ({ page }) => {
    await gotoApp(page);
    await enterApp(page);
    await expect(page.getByText('Maya, 28', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Like' }).click();

    await expect(page.getByText('Lucas, 31', { exact: true })).toBeVisible();
    await expect(page.getByText('Maya, 28', { exact: true })).toHaveCount(0);

    await page.getByRole('tab', { name: /Matches/ }).click();

    await expectPathname(page, '/matches');
    await expect(page.getByText('Maya, 28 · São Paulo')).toBeVisible();
  });

  test('Pass walks the whole deck and Reset Deck restores it', async ({ page }) => {
    await gotoApp(page);
    await enterApp(page);

    for (const candidate of DECK) {
      await expect(page.getByText(candidate, { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Pass' }).click();
    }

    await expect(page.getByText('You are all caught up')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reset Deck' })).toBeVisible();

    await page.getByRole('button', { name: 'Reset Deck' }).click();

    await expect(page.getByText('Maya, 28', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pass' })).toBeVisible();
    await expect(page.getByText('You are all caught up')).toHaveCount(0);
  });

  test('passing does not create matches', async ({ page }) => {
    await gotoApp(page);
    await enterApp(page);

    await page.getByRole('button', { name: 'Pass' }).click();
    await page.getByRole('tab', { name: /Matches/ }).click();

    await expectPathname(page, '/matches');
    await expect(
      page.getByText('No matches yet — tap Like on Discover to start a conversation.'),
    ).toBeVisible();
  });
});
