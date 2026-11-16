import { expect, test } from '@playwright/test';
import { signUpWithPhone, uidForPhone } from './support/firebase';
import { completeOnboarding } from './support/onboarding';

const DOCS = 'http://127.0.0.1:8089/v1/projects/demo-comradia/databases/(default)/documents';
async function document(path: string) {
  const response = await fetch(`${DOCS}/${path}`, { headers: { Authorization: 'Bearer owner' } });
  expect(response.ok).toBeTruthy();
  return (await response.json()).fields;
}

test('profile edits persist without changing private data; discovery filters reset without swiping', async ({
  page,
}, testInfo) => {
  const phone = await signUpWithPhone(page);
  await completeOnboarding(page);
  const uid = await uidForPhone(phone);
  const accountBefore = await document(`users/${uid}`);
  const profileBefore = await document(`profiles/${uid}`);
  await page.goto('/profile');
  await page.getByTestId('profile-edit').click();
  await page.getByTestId('profile-edit-name').fill('Rosa Nova');
  await page.getByTestId('profile-edit-vibe-creative').click();
  await page.getByTestId('profile-edit-prompt-together_we_could').click();
  await page.getByTestId('profile-edit-answer').fill('Build a community garden.');
  await page.getByTestId('profile-edit-union-app_workers').click();
  await page.getByTestId('profile-edit-save').scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('profile-editor.png'), fullPage: true });
  await page.getByTestId('profile-edit-save').click();
  await expect(page.getByTestId('profile-editor')).toHaveCount(0);
  await expect(page.getByTestId('profile-card-name')).toContainText('Rosa Nova');
  const after = await document(`profiles/${uid}`);
  expect(after.age).toEqual(profileBefore.age);
  expect(after.photoPath).toEqual(profileBefore.photoPath);
  expect(after.createdAt).toEqual(profileBefore.createdAt);
  expect(after.vibe).toEqual({ stringValue: 'creative' });
  expect(await document(`users/${uid}`)).toEqual(accountBefore);
  await page.reload();
  await expect(page.getByTestId('profile-card-name')).toContainText('Rosa Nova');
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.getByTestId('profile-edit').click();
  await expect(page.getByTestId('profile-edit-name')).toHaveValue('Rosa Nova');
  await page.screenshot({
    path: testInfo.outputPath('profile-editor-dark-reduced.png'),
    fullPage: true,
  });
  await page.getByTestId('profile-edit-cancel').click();
  await page.goto('/discover');
  await expect(page.locator('[data-testid^="discover-person-"]').first()).toBeVisible();
  await page.getByTestId('discover-filters-open').click();
  await page.getByTestId('discover-filter-min-age').fill('99');
  await page.getByTestId('discover-filter-max-age').fill('99');
  await page.getByTestId('discover-filter-vibe-creative').click();
  await page.getByTestId('discover-filters-apply').click();
  await expect(page.getByText('No people match these filters')).toBeVisible();
  await page.getByTestId('discover-filters-open').click();
  await page.screenshot({
    path: testInfo.outputPath('discover-filters-dark-reduced.png'),
    fullPage: true,
  });
  await page.getByTestId('discover-filters-reset').click();
  await expect(page.locator('[data-testid^="discover-person-"]').first()).toBeVisible();
  const swipes = await fetch(`${DOCS}/users/${uid}/swipes`, {
    headers: { Authorization: 'Bearer owner' },
  });
  expect((await swipes.json()).documents ?? []).toHaveLength(0);
});

for (const locale of ['pt-BR', 'es-ES'] as const) {
  test.describe(locale, () => {
    test.use({ locale, colorScheme: 'dark', contextOptions: { reducedMotion: 'reduce' } });
    test('localizes the editor and filter controls without horizontal overflow', async ({
      page,
    }, testInfo) => {
      await signUpWithPhone(page);
      await completeOnboarding(page);
      await page.goto('/profile');
      await page.getByTestId('profile-edit').click();
      await expect(page.getByTestId('profile-editor')).toContainText('Editar perfil');
      await page.getByTestId('profile-edit-name').fill('Rosa');
      await page.getByTestId('profile-edit-save').scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath(`profile-${locale}.png`), fullPage: true });
      await page.getByTestId('profile-edit-save').click();
      await expect(page.getByTestId('profile-editor')).toHaveCount(0);
      await page.goto('/discover');
      await page.getByTestId('discover-filters-open').click();
      await expect(page.getByTestId('discover-filter-min-age')).toHaveAccessibleName(
        locale === 'pt-BR' ? 'Idade mínima' : 'Edad mínima',
      );
      await page.screenshot({ path: testInfo.outputPath(`filters-${locale}.png`), fullPage: true });
      const box = await page.getByTestId('discover-filters-panel').boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    });
  });
}
