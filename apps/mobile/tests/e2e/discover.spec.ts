import { expect, test, type Page } from '@playwright/test';

import { expectPathname } from './support/app';
import { SEEDED, signUpWithPhone } from './support/firebase';
import { completeOnboarding } from './support/onboarding';

const EMPTY_TITLE = 'You are all caught up';
const SEEDED_IDS: string[] = SEEDED.map((profile) => profile.id);

const deck = (page: Page) => page.getByTestId('discover-screen');
const matches = (page: Page) => page.getByTestId('matches-screen');
const profile = (page: Page) => page.getByTestId('profile-screen');
const cardTitle = (page: Page) => page.getByTestId('discover-card-name');
/**
 * The top card carries its Firestore id, which is the only stable identity here: every
 * test account is created from the same onboarding answers, so two people can share a
 * name and age.
 */
const personCard = (page: Page) => page.locator('[data-testid^="discover-person-"]');

/**
 * A fresh, complete account sitting on /discover. Every test uses its own phone number and
 * display name: the test users share one Firestore database, so a name of our own is the
 * only way to tell "me" apart from everyone else in the deck.
 */
async function readyUser(page: Page): Promise<{ digits: string; name: string }> {
  const e164 = await signUpWithPhone(page);
  const digits = e164.replace('+55', '');
  const name = `Rosa ${digits.slice(-8)}`;
  await completeOnboarding(page, { name });
  return { digits, name };
}

/** The Firestore id of the top card, or null when the deck shows no card. */
async function currentPerson(page: Page): Promise<string | null> {
  if ((await personCard(page).count()) === 0) return null;
  const testId = await personCard(page).first().getAttribute('data-testid');
  return testId?.replace('discover-person-', '') ?? null;
}

function emptyStateVisible(page: Page) {
  return deck(page)
    .getByText(EMPTY_TITLE)
    .count()
    .then((count) => count > 0);
}

/**
 * Swipes through the deck until `stop` matches a card, and returns that card's id. Returns
 * null when the deck runs out first. Waits out a reload in flight instead of sleeping.
 */
async function passUntil(
  page: Page,
  stop: (id: string, name: string) => boolean,
  limit = 60,
): Promise<string | null> {
  for (let step = 0; step < limit; step += 1) {
    const person = await currentPerson(page);
    if (person !== null) {
      const name = await cardTitle(page).innerText();
      if (stop(person, name)) return person;
      await swipe(page, 'pass');
      continue;
    }

    // No card yet: either the deck emptied or a reload is still on its way.
    await expect
      .poll(async () => (await currentPerson(page)) !== null || (await emptyStateVisible(page)))
      .toBe(true);
    if (await emptyStateVisible(page)) return null;
  }
  throw new Error(`the deck did not settle after ${limit} cards`);
}

/** Presses Like or Pass and waits for the following card (or the empty state). */
async function swipe(page: Page, direction: 'like' | 'pass'): Promise<void> {
  const before = await currentPerson(page);
  await page.getByTestId(`discover-${direction}`).click();
  await expect.poll(() => currentPerson(page)).not.toBe(before);
}

/** Passes every remaining card and asserts the empty state. */
async function emptyDeck(page: Page): Promise<void> {
  await passUntil(page, () => false);
  await expect(deck(page).getByText(EMPTY_TITLE)).toBeVisible();
}

/**
 * Where a reload lands: a browser that kept the Firebase session opens /discover, a cold
 * one opens /welcome. Both are valid; the test signs back in when it is the second.
 */
async function sessionLanding(page: Page): Promise<'welcome' | 'discover'> {
  await expect
    .poll(async () => {
      if ((await page.getByTestId('welcome-cta-start').count()) > 0) return 'welcome';
      if ((await deck(page).count()) > 0) return 'discover';
      return 'loading';
    })
    .not.toBe('loading');

  return (await page.getByTestId('welcome-cta-start').count()) > 0 ? 'welcome' : 'discover';
}

test.describe('discover deck', () => {
  test('shows the seeded people nearby, but never the signed-in user', async ({ page }) => {
    const { name: me } = await readyUser(page);

    await expect(deck(page).getByText('VALUES & PASSIONS')).toBeVisible();
    await expect(page.getByTestId('discover-like')).toBeVisible();
    await expect(page.getByTestId('discover-pass')).toBeVisible();

    const seen = new Set<string>();
    await passUntil(page, (id, name) => {
      expect(name.startsWith(me)).toBe(false);
      if (SEEDED_IDS.includes(id)) seen.add(id);
      return seen.size === SEEDED_IDS.length;
    });

    expect([...seen].sort()).toEqual([...SEEDED_IDS].sort());
  });

  test('Like advances the deck and puts the person on Matches', async ({ page }) => {
    await readyUser(page);

    const liked = await cardTitle(page).innerText();
    await swipe(page, 'like');

    await page.getByRole('tab', { name: /Matches/ }).click();

    await expectPathname(page, '/matches');
    await expect(matches(page).getByText(liked).first()).toBeVisible();
  });

  test('Pass removes the card and creates no match', async ({ page }) => {
    await readyUser(page);

    await swipe(page, 'pass');

    await page.getByRole('tab', { name: /Matches/ }).click();

    await expectPathname(page, '/matches');
    await expect(
      matches(page).getByText('No matches yet — tap Like on Discover to start a conversation.'),
    ).toBeVisible();
  });

  test('swipes are persisted: a reload does not bring them back', async ({ page }) => {
    const { digits } = await readyUser(page);

    const passed: string[] = [];
    const liked = await passUntil(page, (id) => {
      if (SEEDED_IDS.includes(id)) return true;
      passed.push(id);
      return false;
    });
    expect(liked).not.toBeNull();

    await swipe(page, 'like');

    await page.reload();
    if ((await sessionLanding(page)) === 'welcome') await signUpWithPhone(page, digits);
    await expectPathname(page, '/discover');

    // Re-reads Firestore for the same account: the swiped people are gone for good.
    const afterReload = new Set<string>();
    await passUntil(page, (id) => {
      afterReload.add(id);
      return false;
    });

    expect(afterReload.has(liked as string)).toBe(false);
    for (const id of passed) expect(afterReload.has(id)).toBe(false);
  });

  test('shows the empty state once everyone has been swiped', async ({ page }) => {
    await readyUser(page);

    await emptyDeck(page);
    await expect(page.getByTestId('discover-like')).toHaveCount(0);
    await expect(page.getByTestId('discover-refresh')).toBeVisible();

    // Refresh asks Firestore again with the same swipes; only new sign-ups can show up.
    await page.getByTestId('discover-refresh').click();
    await emptyDeck(page);
  });

  test('signing out from Profile returns to /welcome', async ({ page }) => {
    const { name: me } = await readyUser(page);

    await page.getByRole('tab', { name: /Profile/ }).click();
    await expectPathname(page, '/profile');
    await expect(profile(page).getByTestId('profile-card-name')).toHaveText(
      new RegExp(`^${me}, \\d+$`),
    );

    await page.getByTestId('profile-sign-out').click();

    await expectPathname(page, '/welcome');
    await expect(page.getByTestId('welcome-cta-start')).toBeVisible();
  });

  test('dark mode repaints the deck', async ({ page }) => {
    await readyUser(page);

    const screen = deck(page);
    const lightCanvas = await screen.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    expect(lightCanvas).not.toBe('rgba(0, 0, 0, 0)');

    await page.emulateMedia({ colorScheme: 'dark' });

    await expect
      .poll(() => screen.evaluate((element) => getComputedStyle(element).backgroundColor))
      .not.toBe(lightCanvas);
  });

  test.describe('pt-BR locale', () => {
    test.use({ locale: 'pt-BR' });

    test('shows the Portuguese deck copy', async ({ page }) => {
      await readyUser(page);

      await expect(deck(page).getByText('Conheça alguém que realmente se importa.')).toBeVisible();
      await expect(page.getByTestId('discover-pass')).toHaveText('Passar');
      await expect(page.getByTestId('discover-like')).toHaveText('Curtir');
      await expect(cardTitle(page)).toBeVisible();
    });
  });

  test.describe('es-ES locale', () => {
    test.use({ locale: 'es-ES' });

    test('shows the Spanish deck copy', async ({ page }) => {
      await readyUser(page);

      await expect(
        deck(page).getByText('Conoce a alguien que realmente se preocupa.'),
      ).toBeVisible();
      await expect(page.getByTestId('discover-pass')).toHaveText('Pasar');
      await expect(page.getByTestId('discover-like')).toHaveText('Me gusta');
      await expect(cardTitle(page)).toBeVisible();
    });
  });
});
