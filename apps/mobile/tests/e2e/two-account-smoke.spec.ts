import { expect, test, type Page } from '@playwright/test';
import { signUpWithPhone, uidForPhone } from './support/firebase';
import { completeOnboarding } from './support/onboarding';

async function bringIntoFixturePage(uid: string) {
  // Test fixture only: both new accounts must be inside Discover's oldest-50 page.
  const response = await fetch(
    `http://127.0.0.1:8089/v1/projects/demo-comradia/databases/(default)/documents/profiles/${uid}?updateMask.fieldPaths=createdAt`,
    {
      method: 'PATCH',
      headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: { createdAt: { timestampValue: '1999-01-01T00:00:00.000Z' } },
      }),
    },
  );
  expect(response.ok).toBeTruthy();
}
async function findPerson(page: Page, uid: string) {
  const card = page.locator('[data-testid^="discover-person-"]').first();
  for (let step = 0; step < 50; step++) {
    await expect(card).toBeVisible();
    const id = await card.getAttribute('data-testid');
    if (id === `discover-person-${uid}`) return;
    await page.getByTestId('discover-pass').click();
    await expect.poll(() => card.getAttribute('data-testid')).not.toBe(id);
  }
  throw new Error('The other account did not appear in the fixture page');
}

test('two independent signed-in accounts mutually match and exchange live messages', async ({
  page,
  browser,
}, testInfo) => {
  test.setTimeout(90_000);
  const otherContext = await browser.newContext({
    baseURL: 'http://localhost:8199',
    viewport: page.viewportSize()!,
    locale: 'en-US',
  });
  try {
    const other = await otherContext.newPage();
    const phoneA = await signUpWithPhone(page);
    await completeOnboarding(page, { name: 'Rosa Smoke' });
    const phoneB = await signUpWithPhone(other);
    await completeOnboarding(other, { name: 'Ana Smoke' });
    const uidA = await uidForPhone(phoneA);
    const uidB = await uidForPhone(phoneB);
    await bringIntoFixturePage(uidA);
    await bringIntoFixturePage(uidB);
    await page.goto('/discover');
    await other.goto('/discover');
    await findPerson(page, uidB);
    await page.getByTestId('discover-like').click();
    await expect(page.getByTestId('match-screen')).toHaveCount(0);
    await findPerson(other, uidA);
    await other.getByTestId('discover-like').click();
    await expect(other.getByTestId('match-screen')).toBeVisible();
    await other.getByTestId('match-send-message').click();
    await page.goto('/matches');
    await page.getByTestId(`match-row-${[uidA, uidB].sort().join('_')}`).click();
    await expect(page.getByTestId('chat-screen')).toBeVisible();
    await page.getByTestId('chat-input').fill('Hello from Rosa');
    await page.getByTestId('chat-send').click();
    await expect(other.getByText('Hello from Rosa', { exact: true })).toBeVisible();
    await other.getByTestId('chat-input').fill('Hello from Ana');
    await other.getByTestId('chat-send').click();
    await expect(page.getByText('Hello from Ana', { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('two-account-chat.png') });
    await page.reload();
    await expect(page.getByText('Hello from Rosa', { exact: true })).toBeVisible();
    await expect(page.getByText('Hello from Ana', { exact: true })).toBeVisible();
  } finally {
    await otherContext.close();
  }
});
