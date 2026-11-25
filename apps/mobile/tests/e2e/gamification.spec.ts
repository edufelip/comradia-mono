import { expect, test } from '@playwright/test';
import { seedCravos, signUpWithPhone, uidForPhone } from './support/firebase';
import { completeOnboarding } from './support/onboarding';

test.skip(
  process.env.E2E_GAMIFICATION !== '1',
  'Run with E2E_GAMIFICATION=1 to enable the emulator-only feature fixture',
);

test('opens the treatment wallet and replays an achievement without horizontal overflow', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 320, height: 568 });
  const phone = await signUpWithPhone(page);
  await completeOnboarding(page);
  await seedCravos(await uidForPhone(phone));
  await page.goto('/profile');
  await page.getByTestId('gam-wallet-link').click();
  await expect(page.getByTestId('gam-wallet')).toBeVisible();
  await expect(page.getByText('Flor', { exact: true })).toBeVisible();
  await expect(page.getByTestId('gam-streak-card')).toBeVisible();
  await page.getByTestId('gam-achievement-faisca').click();
  await page.getByRole('button', { name: 'Replay', exact: true }).click();
  await expect(page.getByText('Achievement unlocked')).toBeVisible();
  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(horizontalOverflow).toBe(false);
});
