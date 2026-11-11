import { expect, test } from '@playwright/test';
import { expectPathname, gotoApp, isSmallPhone } from './support/app';
import { latestSmsCode, signUpWithPhone, uniquePhone } from './support/firebase';

const WRONG_CODE = '000000';
/** A complete number for the flows that need to know it (edit number, resend). */
const KNOWN_PHONE = '11987654321';

/** Welcome → S1B → S1C, stopping on the verification screen. Returns the E.164 number. */
async function openVerification(page: import('@playwright/test').Page, digits = uniquePhone()) {
  await gotoApp(page);
  await page.getByTestId('welcome-cta-start').click();
  await expectPathname(page, '/register');
  await page.getByTestId('register-phone-input').fill(digits);
  await page.getByTestId('register-send-code').click();
  await expectPathname(page, '/verify-phone');
  return `+55${digits}`;
}

test.describe('sign in', () => {
  test('signs up with a phone number and lands on the first onboarding step', async ({ page }) => {
    await signUpWithPhone(page);

    await expectPathname(page, '/vibe');
    await expect(page.getByTestId('register-phone-input')).toBeHidden();
  });

  test('shows the Brazilian number formatted while it is typed', async ({ page }) => {
    await gotoApp(page);
    await page.getByTestId('welcome-cta-start').click();

    await page.getByTestId('register-phone-input').fill('11987654321');
    await expect(page.getByTestId('register-phone-input')).toHaveValue('(11) 98765-4321');

    await page.getByTestId('register-phone-input').fill('1134567890');
    await expect(page.getByTestId('register-phone-input')).toHaveValue('(11) 3456-7890');
  });

  test('keeps the send button disabled while the number is incomplete', async ({ page }) => {
    await gotoApp(page);
    await page.getByTestId('welcome-cta-start').click();

    const send = page.getByTestId('register-send-code');
    await expect(send).toHaveAttribute('aria-disabled', 'true');

    await page.getByTestId('register-phone-input').fill('1198765');
    await expect(send).toHaveAttribute('aria-disabled', 'true');

    await page.getByTestId('register-phone-input').fill('11987654321');
    await expect(send).not.toHaveAttribute('aria-disabled', 'true');
  });

  test('opens registration with the log-in copy and can switch back', async ({ page }) => {
    await gotoApp(page);
    await page.getByTestId('welcome-cta-login').click();
    await expectPathname(page, '/register');

    await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
    await expect(page.getByText('LOG IN')).toBeVisible();
    await expect(page.getByRole('link', { name: 'New here? Create an account' })).toBeVisible();

    await page.getByTestId('register-switch-mode').click();

    await expect(page.getByRole('heading', { name: 'Create your account.' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Already have an account? Log in' })).toBeVisible();
  });

  test('rejects a wrong code without leaving the verification screen', async ({ page }) => {
    await openVerification(page);

    await page.getByTestId('verify-code-input').fill(WRONG_CODE);

    await expect(page.getByTestId('verify-error')).toBeVisible();
    await expect(page.getByTestId('verify-error')).toHaveText(
      "That code isn't right. Check the SMS and try again.",
    );
    await expectPathname(page, '/verify-phone');
    await expect(page.getByTestId('verify-code-input')).toHaveValue('');
  });

  test('accepts the real SMS code the emulator sent', async ({ page }) => {
    const e164 = await openVerification(page);

    await page.getByTestId('verify-code-input').fill(await latestSmsCode(e164));

    await expectPathname(page, '/vibe');
  });

  test('offers a resend once the 30-second countdown runs out', async ({ page }) => {
    await page.clock.install();
    await openVerification(page);

    await expect(page.getByTestId('verify-resend-countdown')).toContainText('Resend in 30s');
    await expect(page.getByTestId('verify-resend')).toBeHidden();

    // `runFor` fires every timer in the window; `fastForward` fires each due timer once.
    await page.clock.runFor(30_000);

    await expect(page.getByTestId('verify-resend-countdown')).toBeHidden();
    await expect(page.getByTestId('verify-resend')).toBeVisible();
  });

  // Regression: a reused RecaptchaVerifier made the second attempt hang forever.
  test('resends the code and restarts the countdown', async ({ page }) => {
    await page.clock.install();
    await openVerification(page);
    await page.clock.runFor(30_000);
    await page.getByTestId('verify-resend').click();
    await page.clock.resume();

    // The countdown only exists while it runs, so its return proves the restart.
    await expect(page.getByTestId('verify-resend-countdown')).toBeVisible();
  });

  test('edits the number by going back to registration', async ({ page }) => {
    await openVerification(page, KNOWN_PHONE);

    await page.getByTestId('verify-edit').click();

    await expectPathname(page, '/register');
    await expect(page.getByTestId('register-phone-input')).toHaveValue('(11) 98765-4321');
  });

  // Regression: browser Back crashed react-navigation core < 7.16 ("reading 'stale'"),
  // fixed by the `resolutions` pin in package.json.
  test('browser back from registration returns to welcome', async ({ page }) => {
    await gotoApp(page);
    await page.getByTestId('welcome-cta-start').click();
    await expectPathname(page, '/register');

    await page.goBack();

    await expectPathname(page, '/welcome');
    await expect(page.getByTestId('welcome-cta-start')).toBeVisible();
  });

  test('goes back from registration to welcome', async ({ page }) => {
    await gotoApp(page);
    await page.getByTestId('welcome-cta-start').click();
    await expectPathname(page, '/register');

    await page.getByTestId('register-back').click();

    await expectPathname(page, '/welcome');
  });

  test('signs in with Google through the auth emulator popup', async ({ page }) => {
    // The popup handshake is the slowest step and depends on the opener staying awake.
    test.slow();
    await gotoApp(page);
    await page.getByTestId('welcome-cta-start').click();

    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.getByTestId('register-google').click(),
    ]);

    const email = `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
    // The emulator widget wires its form in an inline script at the end of the body; a
    // click that lands before that is silently lost, so retry until the form opens.
    await popup.waitForLoadState('domcontentloaded');
    await expect(async () => {
      await popup.locator('#add-account-button').click();
      await expect(popup.locator('#email-input')).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 10_000 });
    await popup.locator('#email-input').fill(email);
    await popup.locator('#display-name-input').fill('Comradia E2E');
    await popup.locator('#sign-in').click();
    await page.bringToFront();

    // The emulator reports the credential back to the opener, then closes the popup.
    await expect.poll(() => popup.isClosed(), { message: 'popup closes' }).toBe(true);
    await expect
      .poll(() => new URL(page.url()).pathname, {
        message: 'expected pathname /vibe',
        timeout: 30_000,
      })
      .toBe('/vibe');
  });

  test('keeps the send button and the footer reachable on a 320x568 screen', async ({ page }) => {
    test.skip(!isSmallPhone(page), 'asserts the 320x568 layout');

    await gotoApp(page);
    await page.getByTestId('welcome-cta-start').click();

    await expect(page.getByTestId('register-phone-input')).toBeInViewport();

    await page.getByTestId('register-send-code').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('register-send-code')).toBeInViewport();

    await page.getByTestId('register-switch-mode').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('register-switch-mode')).toBeInViewport();
  });

  test('keeps the submit button reachable on a 320x568 screen', async ({ page }) => {
    test.skip(!isSmallPhone(page), 'asserts the 320x568 layout');

    await openVerification(page);

    await page.getByTestId('verify-submit').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('verify-submit')).toBeInViewport();
    await expect(page.getByTestId('verify-code-input')).toBeVisible();
  });
});
