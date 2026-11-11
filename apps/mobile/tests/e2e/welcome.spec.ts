import { expect, test } from '@playwright/test';
import {
  expectPathname,
  expectWelcomeScreen,
  gotoApp,
  isSmallPhone,
  welcomeCta,
} from './support/app';

test.describe('welcome', () => {
  test('cold start lands on /welcome and shows the key copy', async ({ page }) => {
    await gotoApp(page);

    await expectWelcomeScreen(page);
    await expect(page.getByText('SÃO PAULO · 23.55°S 46.63°W')).toBeVisible();
    await expect(page.getByText('TONIGHT · 24°C · CLEAR SKIES')).toBeVisible();
    await expect(page.getByText('214 first dates this week')).toBeVisible();
    await expect(page.getByText('PINHEIROS · VILA MADÁ · BIXIGA')).toBeVisible();
    await expect(page.getByText('12.4k people nearby are already here')).toBeVisible();
    await expect(welcomeCta(page, 'start')).toHaveText('Find your person →');
    await expect(welcomeCta(page, 'login')).toHaveText('I already have an account');
  });

  test('both CTAs sit inside the viewport without scrolling on a 390x844 phone', async ({
    page,
  }) => {
    test.skip(isSmallPhone(page), 'asserts the 390x844 layout');

    await gotoApp(page);
    await expectWelcomeScreen(page);

    await expect(welcomeCta(page, 'start')).toBeInViewport();
    await expect(welcomeCta(page, 'login')).toBeInViewport();
  });

  test('the login CTA is reachable by scrolling on a small phone', async ({ page }) => {
    test.skip(!isSmallPhone(page), 'asserts the 320x568 layout');

    await gotoApp(page);
    await expectWelcomeScreen(page);

    // It is below the fold at this size, but only by a few pixels: it must not be
    // fully visible before scrolling, and it must become reachable afterwards.
    await expect(welcomeCta(page, 'login')).not.toBeInViewport({ ratio: 0.9 });
    await welcomeCta(page, 'login').scrollIntoViewIfNeeded();
    await expect(welcomeCta(page, 'login')).toBeInViewport({ ratio: 0.9 });

    await welcomeCta(page, 'login').click();
    await expectPathname(page, '/');
  });

  test('dark color scheme repaints the primary CTA', async ({ page }) => {
    await gotoApp(page);
    await expectWelcomeScreen(page);

    const start = welcomeCta(page, 'start');
    const headline = page.getByRole('heading', { name: 'Meet someone who gives a damn.' });

    const lightCta = await start.evaluate((el) => getComputedStyle(el).backgroundColor);
    const lightText = await headline.evaluate((el) => getComputedStyle(el).color);
    expect(lightCta).not.toBe('rgba(0, 0, 0, 0)');

    await page.emulateMedia({ colorScheme: 'dark' });

    await expect
      .poll(() => start.evaluate((el) => getComputedStyle(el).backgroundColor))
      .not.toBe(lightCta);
    await expect
      .poll(() => headline.evaluate((el) => getComputedStyle(el).color))
      .not.toBe(lightText);
  });

  test.describe('pt-BR locale', () => {
    test.use({ locale: 'pt-BR' });

    test('shows the Portuguese welcome copy', async ({ page }) => {
      await gotoApp(page);

      await expect(page.getByTestId('welcome-cta-start')).toHaveText('Encontre sua pessoa →');
      await expect(page.getByRole('button', { name: 'Já tenho uma conta' })).toBeVisible();
      await expect(page.getByText('214 primeiros encontros esta semana')).toBeVisible();
    });
  });

  test.describe('es-ES locale', () => {
    test.use({ locale: 'es-ES' });

    test('shows the Spanish welcome copy', async ({ page }) => {
      await gotoApp(page);

      await expect(page.getByTestId('welcome-cta-start')).toHaveText('Encuentra a tu persona →');
      await expect(page.getByRole('button', { name: 'Ya tengo una cuenta' })).toBeVisible();
      await expect(page.getByText('214 primeras citas esta semana')).toBeVisible();
    });
  });
});
