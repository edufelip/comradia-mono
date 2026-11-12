import path from 'node:path';
import { expect, type Locator, type Page, test } from '@playwright/test';
import { expectPathname } from './support/app';
import { signUpWithPhone, uidForPhone } from './support/firebase';
import { completeOnboarding, onboardingStep } from './support/onboarding';
import { listObjects, objectMetadata, objectStatus, uploadJpeg } from './support/storage';

// Must match apps/firebase/firebase.json and services/backend/config.ts.
const PROJECT = 'demo-comradia';
const AUTH = 'http://127.0.0.1:9099';
const FIRESTORE = 'http://127.0.0.1:8089';
const DOCS = `${FIRESTORE}/v1/projects/${PROJECT}/databases/(default)/documents`;
/** The emulator's admin token: rules are bypassed, so tests seed and read raw documents. */
const ADMIN = { Authorization: 'Bearer owner' };
/** The emulator accepts any key in single-project mode; the app uses this one too. */
const API_KEY = 'demo-api-key';

const FIXTURE_A = path.join(__dirname, 'fixtures', 'portrait-a.jpg');
const FIXTURE_B = path.join(__dirname, 'fixtures', 'portrait-b.jpg');

/** An old timestamp: Discover lists the 50 oldest profiles first, so this card always shows. */
const OLD = '2000-01-01T00:00:00.000Z';

const deck = (page: Page) => page.getByTestId('discover-screen');
const matches = (page: Page) => page.getByTestId('matches-screen');
const chat = (page: Page) => page.getByTestId('chat-screen');
/** The top card carries its Firestore id; every account shares the same onboarding answers. */
const personCard = (page: Page) => page.locator('[data-testid^="discover-person-"]');

const photoPathRegex = (uid: string) => new RegExp(`^photos/${uid}/[A-Za-z0-9_-]+\\.jpg$`);

// --- Firestore / Auth emulator REST (admin reads and seeds) -------------------------------

type FirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { booleanValue: boolean }
  | { nullValue: null }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { timestampValue: string };

type FirestoreDocument = { name: string; fields?: Record<string, FirestoreValue> };

/** A field value the seed helpers understand; `{ timestampValue }` is passed through as is. */
type SeedValue = string | number | boolean | null | SeedValue[] | { timestampValue: string };

function encode(value: SeedValue): FirestoreValue {
  if (value === null) return { nullValue: null };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return { integerValue: String(value) };
  if (typeof value === 'string') return { stringValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  return value;
}

function decode(value: FirestoreValue): unknown {
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('booleanValue' in value) return value.booleanValue;
  if ('nullValue' in value) return null;
  if ('arrayValue' in value) return (value.arrayValue.values ?? []).map(decode);
  if ('timestampValue' in value) return value.timestampValue;
  return undefined;
}

function decodeFields(document: FirestoreDocument): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(document.fields ?? {}).map(([key, value]) => [key, decode(value)]),
  );
}

/** Seeds (or replaces) one document as `owner`, the way scripts/seed.mjs does. */
async function writeDoc(docPath: string, fields: Record<string, SeedValue>): Promise<void> {
  const encoded = Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, encode(value)]),
  );
  const res = await fetch(`${DOCS}/${docPath}`, {
    method: 'PATCH',
    headers: { ...ADMIN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: encoded }),
  });
  if (!res.ok) throw new Error(`PATCH ${docPath} → ${res.status} ${await res.text()}`);
}

/** The HTTP status of one document: 200 when it exists, 404 when it does not. */
async function docStatus(docPath: string): Promise<number> {
  const res = await fetch(`${DOCS}/${docPath}`, { headers: ADMIN });
  return res.status;
}

/** The `photoPath` of a public card: a storage path, null when there is no photo. */
async function photoPathOf(uid: string): Promise<string | null> {
  const res = await fetch(`${DOCS}/profiles/${uid}`, { headers: ADMIN });
  expect(res.ok).toBeTruthy();
  const document = (await res.json()) as FirestoreDocument;
  return decodeFields(document).photoPath as string | null;
}

/**
 * The storage path the card points at. With `previous`, waits until the card points somewhere
 * new; the app writes the new path after the upload, so a poll is needed.
 */
async function savedPhotoPath(uid: string, previous?: string): Promise<string> {
  await expect
    .poll(async () => {
      const current = await photoPathOf(uid);
      return current !== null && current !== previous && photoPathRegex(uid).test(current);
    })
    .toBe(true);
  return (await photoPathOf(uid)) as string;
}

/** A second account for the other side of a match or a card. Returns its uid. */
async function createRestUser(): Promise<{ uid: string }> {
  const email = `photos-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const res = await fetch(
    `${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'comradia-e2e', returnSecureToken: true }),
    },
  );
  if (!res.ok) throw new Error(`accounts:signUp → ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { localId: string };
  return { uid: body.localId };
}

/** A complete public card with a portrait already uploaded to `photos/{uid}/seed1.jpg`. */
async function seedPhotoProfile(
  uid: string,
  displayName: string,
  createdAt?: string,
): Promise<void> {
  const now = { timestampValue: createdAt ?? new Date().toISOString() };
  await uploadJpeg(`photos/${uid}/seed1.jpg`, FIXTURE_B);
  await writeDoc(`profiles/${uid}`, {
    displayName,
    age: 29,
    vibe: 'community',
    lookingFor: 'everyone',
    unionMember: false,
    union: null,
    values: ['tenant_rights', 'cycling', 'food_markets'],
    promptId: 'green_flag',
    promptAnswer: 'They show up when they said they would.',
    photoPath: `photos/${uid}/seed1.jpg`,
    createdAt: now,
    updatedAt: now,
  });
}

/** Seeds a mutual like and its match for `a` and `b`, as if both had swiped right. */
async function seedMutualMatch(a: string, b: string): Promise<string> {
  const matchId = [a, b].sort().join('_');
  const now = { timestampValue: new Date().toISOString() };
  await writeDoc(`users/${a}/swipes/${b}`, { direction: 'like', createdAt: now });
  await writeDoc(`users/${b}/swipes/${a}`, { direction: 'like', createdAt: now });
  await writeDoc(`likes/${b}/from/${a}`, { createdAt: now });
  await writeDoc(`likes/${a}/from/${b}`, { createdAt: now });
  await writeDoc(`matches/${matchId}`, {
    users: [a, b].sort(),
    createdAt: now,
  });
  return matchId;
}

// --- Discover helpers ---------------------------------------------------------------------

/** The Firestore id of the top card, or null when the deck shows no card. */
async function currentPerson(page: Page): Promise<string | null> {
  if ((await personCard(page).count()) === 0) return null;
  const testId = await personCard(page).first().getAttribute('data-testid');
  return testId?.replace('discover-person-', '') ?? null;
}

async function deckEmpty(page: Page): Promise<boolean> {
  return (await deck(page).getByText('You are all caught up').count()) > 0;
}

/** Presses Pass and waits for the following card (or the empty state). */
async function pass(page: Page): Promise<void> {
  const before = await currentPerson(page);
  await page.getByTestId('discover-pass').click();
  await expect.poll(() => currentPerson(page)).not.toBe(before);
}

/** Passes through the deck until `stop` matches a card, and returns that card's id (or null). */
async function passUntil(page: Page, stop: (id: string) => boolean, limit = 60) {
  for (let step = 0; step < limit; step += 1) {
    const person = await currentPerson(page);
    if (person !== null) {
      if (stop(person)) return person;
      await pass(page);
      continue;
    }

    await expect
      .poll(async () => (await currentPerson(page)) !== null || (await deckEmpty(page)))
      .toBe(true);
    if (await deckEmpty(page)) return null;
  }
  throw new Error(`the deck did not settle after ${limit} cards`);
}

// --- Photo helpers ------------------------------------------------------------------------

/** Clicks a photo button and answers the file chooser it opens with `file`. */
async function choosePhoto(page: Page, testId: string, file: string): Promise<void> {
  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId(testId).click();
  await (await chooser).setFiles(file);
}

/** The portrait is on screen and its bytes really came from the Storage emulator. */
async function expectPortraitLoaded(image: Locator): Promise<void> {
  await expect(image).toBeVisible();
  await expect
    .poll(() =>
      image.evaluate((element) => {
        const img = element.tagName === 'IMG' ? element : element.querySelector('img');
        return img instanceof HTMLImageElement ? img.naturalWidth : 0;
      }),
    )
    .toBeGreaterThan(0);
}

async function openProfile(page: Page): Promise<void> {
  await page.getByRole('tab', { name: /Profile/ }).click();
  await expectPathname(page, '/profile');
}

test.describe('photos', () => {
  test('a photo picked during sign-up is on my profile', async ({ page }) => {
    const e164 = await signUpWithPhone(page);
    const digits = e164.replace('+55', '');
    const uid = await uidForPhone(e164);
    await expectPathname(page, '/vibe');

    await choosePhoto(page, 'onboarding-photo-pick', FIXTURE_A);
    await expectPortraitLoaded(onboardingStep(page, 'vibe').getByTestId('onboarding-photo-image'));

    await completeOnboarding(page, { name: `Rosa ${digits.slice(-8)}` });

    // The photo is uploaded when onboarding finishes, and the card keeps its path.
    const path = await savedPhotoPath(uid);
    expect(path).toMatch(photoPathRegex(uid));
    await expect.poll(() => objectStatus(path)).toBe(200);
    // A path never changes content, so clients may cache it for a year.
    expect(await objectMetadata(path)).toMatchObject({
      contentType: 'image/jpeg',
      cacheControl: 'public, max-age=31536000, immutable',
    });

    await openProfile(page);
    await expectPortraitLoaded(page.getByTestId('profile-photo-image'));
  });

  test('change and remove a photo from Profile', async ({ page }) => {
    const e164 = await signUpWithPhone(page);
    const digits = e164.replace('+55', '');
    const uid = await uidForPhone(e164);
    await completeOnboarding(page, { name: `Rosa ${digits.slice(-8)}` });

    await openProfile(page);
    await expect(page.getByTestId('profile-photo-image')).toHaveCount(0);

    // Add: the first portrait is uploaded and the card points at it.
    await choosePhoto(page, 'profile-photo-change', FIXTURE_A);
    await expectPortraitLoaded(page.getByTestId('profile-photo-image'));
    const first = await savedPhotoPath(uid);
    expect(first).toMatch(photoPathRegex(uid));
    await expect.poll(() => objectStatus(first)).toBe(200);

    // Change: a new file is stored, the card moves to it, and the old file is deleted.
    await choosePhoto(page, 'profile-photo-change', FIXTURE_B);
    const second = await savedPhotoPath(uid, first);
    expect(second).not.toBe(first);
    expect(second).toMatch(photoPathRegex(uid));
    await expect.poll(() => objectStatus(second)).toBe(200);
    await expect.poll(() => objectStatus(first)).toBe(404);
    await expectPortraitLoaded(page.getByTestId('profile-photo-image'));

    // Remove: the card has no photo again and the file is deleted.
    await page.getByTestId('profile-photo-remove').click();
    await expect(page.getByTestId('profile-photo-image')).toHaveCount(0);
    await expect.poll(() => photoPathOf(uid)).toBeNull();
    await expect.poll(() => objectStatus(second)).toBe(404);
  });

  test('other people see my photo on their card, in Matches and in chat', async ({ page }) => {
    const e164 = await signUpWithPhone(page);
    const digits = e164.replace('+55', '');
    const uid = await uidForPhone(e164);

    // Two other people with portraits. The one seeded with an old timestamp is the first card
    // Discover shows to a new account; the other one is the match.
    const matchPerson = await createRestUser();
    const matchName = `Bruno ${digits.slice(-8)}`;
    await seedPhotoProfile(matchPerson.uid, matchName);

    const deckPerson = await createRestUser();
    await seedPhotoProfile(deckPerson.uid, `Carla ${digits.slice(-8)}`, OLD);

    await completeOnboarding(page, { name: `Rosa ${digits.slice(-8)}` });

    // Discover: the card shows the other person's portrait.
    await expect(deck(page)).toBeVisible();
    const found = await passUntil(page, (id) => id === deckPerson.uid);
    expect(found).toBe(deckPerson.uid);
    await expectPortraitLoaded(page.getByTestId('discover-photo-image'));
    // Screen readers get one named image, not the inner <img> as well.
    await expect(deck(page).getByRole('img')).toHaveCount(1);
    await expect(deck(page).getByRole('img', { name: /^Photo of Carla/ })).toBeVisible();

    // Matches: the row shows the matched person's portrait.
    const matchId = await seedMutualMatch(uid, matchPerson.uid);
    await page.getByRole('tab', { name: /Matches/ }).click();
    await expectPathname(page, '/matches');
    await expect(matches(page).getByTestId(`match-row-${matchId}`)).toBeVisible();
    await expectPortraitLoaded(page.getByTestId(`match-row-photo-${matchId}-image`));

    // Chat: the header shows the same portrait.
    await matches(page).getByTestId(`match-row-${matchId}`).click();
    await expectPathname(page, `/chat/${matchId}`);
    await expect(chat(page)).toBeVisible();
    await expectPortraitLoaded(chat(page).getByTestId('chat-photo-image'));
  });

  test('deleting the account deletes my photos', async ({ page }) => {
    const e164 = await signUpWithPhone(page);
    const digits = e164.replace('+55', '');
    const uid = await uidForPhone(e164);
    await completeOnboarding(page, { name: `Rosa ${digits.slice(-8)}` });

    await openProfile(page);
    await choosePhoto(page, 'profile-photo-change', FIXTURE_A);
    const path = await savedPhotoPath(uid);
    await expect.poll(() => objectStatus(path)).toBe(200);
    await expect.poll(() => listObjects(`photos/${uid}/`)).toHaveLength(1);

    // The sign-in is seconds old, so the five-minute check passes and the account goes.
    await page.getByTestId('profile-delete-account').click();
    await page.getByTestId('profile-delete-confirm').click();

    await expectPathname(page, '/welcome');
    await expect.poll(() => docStatus(`profiles/${uid}`)).toBe(404);
    await expect.poll(() => listObjects(`photos/${uid}/`)).toHaveLength(0);
    await expect.poll(() => objectStatus(path)).toBe(404);
  });
});
