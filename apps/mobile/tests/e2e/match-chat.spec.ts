import { expect, test, type Page } from '@playwright/test';

import { expectPathname } from './support/app';
import { seedLike, seedMessage, signUpWithPhone, uidForPhone } from './support/firebase';
import { completeOnboarding } from './support/onboarding';

/** The seeded card this journey matches with (apps/firebase/scripts/seed.mjs). */
const SEED_MAYA = 'seed-maya';

const deck = (page: Page) => page.getByTestId('discover-screen');
const matchScreen = (page: Page) => page.getByTestId('match-screen');
const chat = (page: Page) => page.getByTestId('chat-screen');
const matches = (page: Page) => page.getByTestId('matches-screen');
/** The top card carries its Firestore id; every test account shares the same onboarding answers. */
const personCard = (page: Page) => page.locator('[data-testid^="discover-person-"]');

async function currentPerson(page: Page): Promise<string | null> {
  if ((await personCard(page).count()) === 0) return null;
  const testId = await personCard(page).first().getAttribute('data-testid');
  return testId?.replace('discover-person-', '') ?? null;
}

/** Passes through the deck until `target` is the top card. Waits out reloads instead of sleeping. */
async function passUntil(page: Page, target: string, limit = 60): Promise<void> {
  for (let step = 0; step < limit; step += 1) {
    const person = await currentPerson(page);
    if (person === target) return;
    if (person === null) {
      await expect.poll(() => currentPerson(page), { message: 'a card to swipe' }).not.toBeNull();
      continue;
    }
    await page.getByTestId('discover-pass').click();
    await expect.poll(() => currentPerson(page)).not.toBe(person);
  }
  throw new Error(`the deck never showed ${target}`);
}

test.describe('match loop', () => {
  test('a mutual like opens the match, the chat and the Matches hub', async ({ page }) => {
    // Maya likes the new account first: our like is the second half of the pair.
    const e164 = await signUpWithPhone(page);
    const uid = await uidForPhone(e164);
    await seedLike(SEED_MAYA, uid);

    const name = `Rosa ${e164.slice(-8)}`;
    await completeOnboarding(page, { name });
    const matchId = [uid, SEED_MAYA].sort().join('_');

    await expect(deck(page)).toBeVisible();
    await passUntil(page, SEED_MAYA);
    await page.getByTestId('discover-like').click();

    await expectPathname(page, `/match/${matchId}`);
    await expect(matchScreen(page).getByText("It's a match!")).toBeVisible();
    await expect(matchScreen(page).getByTestId('match-names')).toContainText(name);
    await expect(matchScreen(page).getByTestId('match-names')).toContainText('Maya');
    await expect(matchScreen(page).getByText('Tenant rights')).toBeVisible();

    await page.getByTestId('match-send-message').click();
    await expectPathname(page, `/chat/${matchId}`);
    await expect(chat(page).getByRole('heading', { name: 'Maya' })).toBeVisible();

    const input = chat(page).getByTestId('chat-input');
    await input.fill('Hi Maya, feira on Saturday?');
    await chat(page).getByTestId('chat-send').click();
    await expect(chat(page).getByText('Hi Maya, feira on Saturday?')).toBeVisible();
    await expect(input).toHaveValue('');

    await seedMessage(matchId, SEED_MAYA, 'Saturday works — see you at the market.');
    await expect(chat(page).getByText('Saturday works — see you at the market.')).toBeVisible();

    await chat(page).getByTestId('chat-back').click();
    await page.getByRole('tab', { name: /Matches/ }).click();
    await expectPathname(page, '/matches');
    await expect(matches(page).getByTestId(`match-row-${matchId}`)).toBeVisible();
    await expect(matches(page).getByTestId(`match-row-${matchId}`)).toContainText('Maya, 28');
  });
});
