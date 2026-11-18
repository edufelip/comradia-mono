import { expect, test, type Page } from '@playwright/test';

import { expectPathname } from './support/app';
import { seedMessage, signUpWithPhone, uidForPhone } from './support/firebase';
import { completeOnboarding } from './support/onboarding';

// Must match apps/firebase/firebase.json and services/backend/config.ts.
const PROJECT = 'demo-comradia';
const AUTH = 'http://127.0.0.1:9099';
const FIRESTORE = 'http://127.0.0.1:8089';
const DOCS = `${FIRESTORE}/v1/projects/${PROJECT}/databases/(default)/documents`;
/** The emulator's admin token: rules are bypassed, so tests seed and read raw documents. */
const ADMIN = { Authorization: 'Bearer owner' };
/** The emulator accepts any key in single-project mode; the app uses this one too. */
const API_KEY = 'demo-api-key';

const EMPTY_TITLE = 'You are all caught up';

const deck = (page: Page) => page.getByTestId('discover-screen');
const matches = (page: Page) => page.getByTestId('matches-screen');
const chat = (page: Page) => page.getByTestId('chat-screen');
/** The top card carries its Firestore id; every account shares the same onboarding answers. */
const personCard = (page: Page) => page.locator('[data-testid^="discover-person-"]');

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
async function writeDoc(path: string, fields: Record<string, SeedValue>): Promise<void> {
  const encoded = Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, encode(value)]),
  );
  const res = await fetch(`${DOCS}/${path}`, {
    method: 'PATCH',
    headers: { ...ADMIN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: encoded }),
  });
  if (!res.ok) throw new Error(`PATCH ${path} → ${res.status} ${await res.text()}`);
}

/** The HTTP status of one document: 200 when it exists, 404 when it does not. */
async function docStatus(path: string): Promise<number> {
  const res = await fetch(`${DOCS}/${path}`, { headers: ADMIN });
  return res.status;
}

/** Deletes one document as `owner`. */
async function deleteDoc(path: string): Promise<void> {
  const res = await fetch(`${DOCS}/${path}`, { method: 'DELETE', headers: ADMIN });
  if (!res.ok) throw new Error(`delete ${path} failed: ${res.status}`);
}

/** Every document of a collection. The emulator pages lists at 30, so always ask for more. */
async function listDocs(
  collection: string,
): Promise<{ id: string; data: Record<string, unknown> }[]> {
  const res = await fetch(`${DOCS}/${collection}?pageSize=1000`, { headers: ADMIN });
  expect(res.ok).toBeTruthy();
  const body = (await res.json()) as { documents?: FirestoreDocument[] };
  return (body.documents ?? []).map((document) => ({
    id: document.name.split('/').pop() as string,
    data: decodeFields(document),
  }));
}

/** The uids the Auth emulator still knows for this project. */
async function authUserIds(localIds: string[]): Promise<string[]> {
  const res = await fetch(
    `${AUTH}/identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:lookup`,
    {
      method: 'POST',
      headers: { ...ADMIN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ localId: localIds }),
    },
  );
  if (!res.ok) throw new Error(`accounts:lookup → ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { users?: { localId: string }[] };
  return (body.users ?? []).map((user) => user.localId);
}

/**
 * A second account for the "the other side is denied too" half of a block. Email sign-up is
 * one call and returns an ID token, so the test can write to Firestore as that person.
 */
async function createRestUser(): Promise<{ uid: string; idToken: string }> {
  const email = `safety-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const res = await fetch(
    `${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'comradia-e2e', returnSecureToken: true }),
    },
  );
  if (!res.ok) throw new Error(`accounts:signUp → ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { localId: string; idToken: string };
  return { uid: body.localId, idToken: body.idToken };
}

/** A complete public card (the fields the app reads; seeds bypass the rules). */
async function seedProfile(uid: string, displayName: string): Promise<void> {
  const now = { timestampValue: new Date().toISOString() };
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
    createdAt: now,
    updatedAt: now,
  });
}

/**
 * Seeds a mutual like and its match for `a` and `b`, as if both had swiped right. Account
 * deletion takes the match with it, so tests that need a chat must not depend on the seed.
 */
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

/**
 * A message create exactly as the app does it (rules need `createdAt == request.time`, so the
 * commit asks the server for the timestamp). Returns the HTTP status.
 */
async function sendMessageAs(
  idToken: string,
  matchId: string,
  fromUid: string,
  text: string,
): Promise<number> {
  const messageId = `e2e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const res = await fetch(`${DOCS}:commit`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      writes: [
        {
          update: {
            name: `projects/${PROJECT}/databases/(default)/documents/matches/${matchId}/messages/${messageId}`,
            fields: { from: { stringValue: fromUid }, text: { stringValue: text } },
          },
          currentDocument: { exists: false },
          updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
        },
      ],
    }),
  });
  return res.status;
}

// --- Discover helpers ---------------------------------------------------------------------

/** The Firestore id of the top card, or null when the deck shows no card. */
async function currentPerson(page: Page): Promise<string | null> {
  const testId = await personCard(page).evaluateAll(
    (cards) => cards[0]?.getAttribute('data-testid') ?? null,
  );
  return testId?.replace('discover-person-', '') ?? null;
}

async function deckEmpty(page: Page): Promise<boolean> {
  return (await deck(page).getByText(EMPTY_TITLE).count()) > 0;
}

/** Presses Like or Pass and waits for the following card (or the empty state). */
async function swipe(page: Page, direction: 'like' | 'pass'): Promise<void> {
  const before = await currentPerson(page);
  await page.getByTestId(`discover-${direction}`).click();
  await expect.poll(() => currentPerson(page)).not.toBe(before);
}

/**
 * Passes through the deck until `stop` matches a card, and returns that card's id. Returns
 * null when the deck runs out first; waits out a reload in flight instead of sleeping.
 */
async function passUntil(
  page: Page,
  stop: (id: string) => boolean,
  limit = 60,
): Promise<string | null> {
  for (let step = 0; step < limit; step += 1) {
    const person = await currentPerson(page);
    if (person !== null) {
      if (stop(person)) return person;
      await swipe(page, 'pass');
      continue;
    }

    await expect
      .poll(async () => (await currentPerson(page)) !== null || (await deckEmpty(page)))
      .toBe(true);
    if (await deckEmpty(page)) return null;
  }
  throw new Error(`the deck did not settle after ${limit} cards`);
}

/** A reload keeps the Firebase session on most runs; when it does not, sign back in. */
async function signInAgainIfSignedOut(page: Page, digits: string): Promise<void> {
  if ((await page.getByTestId('welcome-cta-start').count()) > 0) {
    await signUpWithPhone(page, digits);
  }
}

async function openChatFromUrl(page: Page, matchId: string, digits: string): Promise<void> {
  await page.goto(`/chat/${matchId}`);
  await expect
    .poll(async () => {
      if ((await chat(page).count()) > 0) return 'chat';
      if ((await page.getByTestId('welcome-cta-start').count()) > 0) return 'welcome';
      return 'loading';
    })
    .not.toBe('loading');
  if ((await chat(page).count()) === 0) {
    await signUpWithPhone(page, digits);
    await page.goto(`/chat/${matchId}`);
  }
}

test.describe('safety', () => {
  test('reporting a card from Discover blocks the person and keeps them out of the deck', async ({
    page,
  }) => {
    const e164 = await signUpWithPhone(page);
    const digits = e164.replace('+55', '');
    const uid = await uidForPhone(e164);
    await completeOnboarding(page, { name: `Rosa ${digits.slice(-8)}` });

    await expect(deck(page)).toBeVisible();
    const target = await currentPerson(page);
    if (!target) throw new Error('the deck showed no card to report');

    await page.getByTestId('discover-report').click();

    await expectPathname(page, `/safety/${target}`);
    await expect(page.getByTestId('safety-screen')).toBeVisible();
    // A report needs a reason; the sheet opens with nothing selected.
    await expect(page.getByTestId('report-submit')).toHaveAttribute('aria-disabled', 'true');

    await page.getByTestId('report-reason-harassment').click();
    await expect(page.getByTestId('report-reason-harassment')).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await page.getByTestId('report-details').fill('Kept messaging after I asked them to stop.');
    await page.getByTestId('report-submit').click();

    // Back on the deck, without the person: a report blocks as well as records.
    await expectPathname(page, '/discover');
    await expect(page.getByTestId(`discover-person-${target}`)).toHaveCount(0);
    await expect.poll(() => currentPerson(page)).not.toBe(target);

    // Other tests report the same first card, so the report is found by reporter, not target.
    const mine = async () =>
      (await listDocs('reports')).filter(
        (doc) => doc.data.reporter === uid && doc.data.target === target,
      );
    await expect.poll(async () => await mine()).toHaveLength(1);
    const report = (await mine())[0];
    expect(report?.data).toMatchObject({
      reporter: uid,
      target,
      reason: 'harassment',
      context: 'profile',
      details: 'Kept messaging after I asked them to stop.',
    });
    expect(report?.data.createdAt).toEqual(expect.any(String));

    await expect.poll(() => docStatus(`blocks/${target}/by/${uid}`)).toBe(200);
    await expect.poll(() => docStatus(`users/${uid}/blocks/${target}`)).toBe(200);

    // And the block survives a reload: the blocked person is not in the deck again.
    await page.reload();
    await signInAgainIfSignedOut(page, digits);
    await expectPathname(page, '/discover');
    await expect(deck(page)).toBeVisible();

    // This was the first card in the stable oldest-first deck. Without the persisted
    // block filter it would be first again; traversing every unrelated signup created
    // by parallel tests adds no proof of this reload behavior.
    await expect
      .poll(async () => {
        const person = await currentPerson(page);
        return person === null ? 'loading' : person === target ? 'blocked-target' : 'other-person';
      })
      .toBe('other-person');

    // Unblocking keeps the report. Reporting the same person again must still block them,
    // without trying to rewrite the existing (create-only) report.
    await deleteDoc(`users/${uid}/blocks/${target}`);
    await deleteDoc(`blocks/${target}/by/${uid}`);
    // Open the report directly: the deck ranks cards on the device, and parallel signups can
    // outrank the target, so card order proves nothing here.
    await page.goto(`/safety/${target}`);
    await signInAgainIfSignedOut(page, digits);
    await expect(page.getByTestId('safety-screen')).toBeVisible();
    await page.getByTestId('report-reason-spam').click();
    await page.getByTestId('report-submit').click();
    await expect.poll(() => docStatus(`users/${uid}/blocks/${target}`)).toBe(200);
    await expect.poll(() => docStatus(`blocks/${target}/by/${uid}`)).toBe(200);
    await expect.poll(async () => await mine()).toHaveLength(1);
  });

  test('blocking from a chat closes it for both people and hides the match', async ({ page }) => {
    const e164 = await signUpWithPhone(page);
    const digits = e164.replace('+55', '');
    const uid = await uidForPhone(e164);
    await completeOnboarding(page, { name: `Rosa ${digits.slice(-8)}` });

    // The other person: a real Auth account (so the test can write as them) with a card.
    const other = await createRestUser();
    await seedProfile(other.uid, `Bruno ${digits.slice(-8)}`);
    const matchId = await seedMutualMatch(uid, other.uid);

    await page.getByRole('tab', { name: /Matches/ }).click();
    await expectPathname(page, '/matches');
    await expect(matches(page).getByTestId(`match-row-${matchId}`)).toBeVisible();

    await matches(page).getByTestId(`match-row-${matchId}`).click();
    await expectPathname(page, `/chat/${matchId}`);
    await expect(chat(page)).toBeVisible();

    await chat(page).getByTestId('chat-safety').click();
    await expectPathname(page, `/safety/${other.uid}`);

    await page.getByTestId('safety-block').click();
    await expect(page.getByTestId('safety-block-confirm-panel')).toBeVisible();
    await page.getByTestId('safety-block-confirm').click();

    // A block made in a chat lands on Matches, and the conversation is gone from it.
    await expectPathname(page, '/matches');
    // One Matches screen: the modal goes back to the existing tabs, not a second copy of them.
    await expect(page.getByTestId('matches-screen')).toHaveCount(1);
    await expect(page.getByTestId(`match-row-${matchId}`)).toHaveCount(0);
    await expect(page.getByTestId('matches-empty')).toBeVisible();

    await expect.poll(() => docStatus(`blocks/${other.uid}/by/${uid}`)).toBe(200);

    // Reopening the conversation by URL shows it closed: messages stay, the composer goes.
    await openChatFromUrl(page, matchId, digits);

    await expect(chat(page).getByTestId('chat-closed')).toBeVisible();
    await expect(chat(page).getByTestId('chat-input')).toHaveCount(0);
    await expect(chat(page).getByTestId('chat-send')).toHaveCount(0);

    // The block closes the chat on the other side too: their writes are denied by the rules.
    expect(await sendMessageAs(other.idToken, matchId, other.uid, 'Are you there?')).toBe(403);
  });

  test('opening a chat while the other person blocks you keeps its messages readable', async ({
    page,
  }) => {
    const e164 = await signUpWithPhone(page);
    const uid = await uidForPhone(e164);
    await completeOnboarding(page, { name: `Rosa ${e164.slice(-8)}` });

    const other = await createRestUser();
    const otherName = `Bruno ${e164.slice(-8)}`;
    await seedProfile(other.uid, otherName);
    const matchId = await seedMutualMatch(uid, other.uid);
    const message = 'See you at the market.';
    await seedMessage(matchId, other.uid, message);
    const createdAt = { timestampValue: new Date().toISOString() };
    await Promise.all([
      writeDoc(`users/${other.uid}/blocks/${uid}`, { createdAt }),
      writeDoc(`blocks/${uid}/by/${other.uid}`, { createdAt }),
    ]);

    await openChatFromUrl(page, matchId, e164.replace('+55', ''));
    await expect(chat(page).getByTestId('chat-closed')).toBeVisible();
    await expect(chat(page).getByText(message)).toBeVisible();
    await expect(chat(page).getByTestId('chat-input')).toHaveCount(0);
    await expect(chat(page).getByRole('heading', { name: otherName })).toHaveCount(0);
  });

  test('a match becomes visible again when the other person unblocks you', async ({ page }) => {
    const e164 = await signUpWithPhone(page);
    const uid = await uidForPhone(e164);
    await completeOnboarding(page, { name: `Rosa ${e164.slice(-8)}` });

    const other = await createRestUser();
    const otherName = `Bruno ${e164.slice(-8)}`;
    await seedProfile(other.uid, otherName);
    const matchId = await seedMutualMatch(uid, other.uid);
    const blockPaths = [`users/${other.uid}/blocks/${uid}`, `blocks/${uid}/by/${other.uid}`];
    await Promise.all(
      blockPaths.map((path) =>
        writeDoc(path, { createdAt: { timestampValue: new Date().toISOString() } }),
      ),
    );

    const matchesTab = page.getByRole('tab', { name: /Matches/ });
    const row = matches(page).getByTestId(`match-row-${matchId}`);
    await matchesTab.click();
    await expect(matches(page).getByTestId('matches-empty')).toBeVisible();
    await expect(row).toHaveCount(0);

    await page.getByRole('tab', { name: /Discover/ }).click();
    await expectPathname(page, '/discover');
    await Promise.all(blockPaths.map(deleteDoc));
    await matchesTab.click();
    await expect(row).toBeVisible();

    await row.click();
    await expect(chat(page).getByRole('heading', { name: otherName })).toBeVisible();
    await expect(chat(page).getByTestId('chat-input')).toBeVisible();
  });

  test('deleting the account removes it everywhere, and cancel deletes nothing', async ({
    page,
  }) => {
    const e164 = await signUpWithPhone(page);
    const digits = e164.replace('+55', '');
    const uid = await uidForPhone(e164);
    await completeOnboarding(page, { name: `Rosa ${digits.slice(-8)}` });

    await page.getByRole('tab', { name: /Profile/ }).click();
    await expectPathname(page, '/profile');

    // Cancel first: the panel closes and nothing was written or deleted.
    await page.getByTestId('profile-delete-account').click();
    await expect(page.getByTestId('profile-delete-panel')).toBeVisible();
    await page.getByTestId('profile-delete-cancel').click();
    await expect(page.getByTestId('profile-delete-panel')).toHaveCount(0);
    await expect(page.getByTestId('profile-delete-account')).toBeVisible();
    expect(await docStatus(`profiles/${uid}`)).toBe(200);

    // The sign-in is seconds old, so the five-minute check passes and the account goes.
    await page.getByTestId('profile-delete-account').click();
    await page.getByTestId('profile-delete-confirm').click();

    await expectPathname(page, '/welcome');
    await expect(page.getByTestId('welcome-cta-start')).toBeVisible();
    await expect(page.getByTestId('profile-delete-reauth')).toHaveCount(0);

    await expect.poll(() => docStatus(`profiles/${uid}`)).toBe(404);
    await expect.poll(() => docStatus(`users/${uid}`)).toBe(404);
    await expect.poll(() => authUserIds([uid])).toHaveLength(0);
  });
});
