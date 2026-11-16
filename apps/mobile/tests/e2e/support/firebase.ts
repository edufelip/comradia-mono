import { expect, type Page } from '@playwright/test';

// Must match apps/firebase/firebase.json and services/backend/config.ts.
const PROJECT = 'demo-comradia';
const AUTH = 'http://127.0.0.1:9099';
const FIRESTORE = 'http://127.0.0.1:8089';

export async function clearEmulators(): Promise<void> {
  await fetch(`${AUTH}/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
  await fetch(`${FIRESTORE}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, {
    method: 'DELETE',
  });
}

export async function seedProfiles(): Promise<void> {
  const { seed } = await import('../../../../firebase/scripts/seed.mjs');
  await seed();
}

/** Seeded Discover cards (apps/firebase/scripts/seed.mjs). Order is not guaranteed; match by id. */
export const SEEDED = [
  { id: 'seed-maya', name: 'Maya', age: 28 },
  { id: 'seed-lucas', name: 'Lucas', age: 31 },
  { id: 'seed-val', name: 'Val', age: 26 },
] as const;

/**
 * A Brazilian mobile number nobody else in this run uses, so parallel tests never share
 * an account. Returns the 11 national digits (area code + number).
 */
export function uniquePhone(): string {
  const n = Math.floor(Math.random() * 1e8)
    .toString()
    .padStart(8, '0');
  return `119${n}`;
}

/** The last SMS code the auth emulator "sent" to this number (E.164, e.g. +5511987654321). */
export async function latestSmsCode(e164: string): Promise<string> {
  let code: string | undefined;
  await expect
    .poll(
      async () => {
        const res = await fetch(`${AUTH}/emulator/v1/projects/${PROJECT}/verificationCodes`);
        const body = (await res.json()) as {
          verificationCodes?: { phoneNumber: string; code: string }[];
        };
        code = body.verificationCodes?.filter((c) => c.phoneNumber === e164).at(-1)?.code;
        return code;
      },
      { message: `SMS code for ${e164}` },
    )
    .toBeTruthy();
  return code as string;
}

/** The uid the Auth emulator gave this phone number (E.164); throws if nobody signed up with it. */
export async function uidForPhone(e164: string): Promise<string> {
  const res = await fetch(
    `${AUTH}/identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:lookup`,
    {
      method: 'POST',
      headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: [e164] }),
    },
  );
  if (!res.ok) throw new Error(`accounts:lookup → ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { users?: { localId: string; phoneNumber?: string }[] };
  const user = body.users?.find((account) => account.phoneNumber === e164);
  if (!user) throw new Error(`no auth user for ${e164}`);
  return user.localId;
}

/** Firestore emulator REST write as `owner` (bypasses rules), the same way scripts/seed.mjs does. */
async function writeDoc(path: string, fields: Record<string, unknown>): Promise<void> {
  const res = await fetch(
    `${FIRESTORE}/v1/projects/${PROJECT}/databases/(default)/documents/${path}`,
    {
      method: 'PATCH',
      headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
    },
  );
  if (!res.ok) throw new Error(`PATCH ${path} → ${res.status} ${await res.text()}`);
}

/** Seeds `fromUid`'s like on `toUid` plus the swipe, as if they liked them in Discover. */
export async function seedLike(fromUid: string, toUid: string): Promise<void> {
  const createdAt = { timestampValue: new Date().toISOString() };
  await writeDoc(`likes/${toUid}/from/${fromUid}`, { createdAt });
  await writeDoc(`users/${fromUid}/swipes/${toUid}`, {
    direction: { stringValue: 'like' },
    createdAt,
  });
}

/** Seeds one chat message in `matchId`, sent by `fromUid`, with a fresh id. */
export async function seedMessage(matchId: string, fromUid: string, text: string): Promise<void> {
  const id = `seed-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  await writeDoc(`matches/${matchId}/messages/${id}`, {
    from: { stringValue: fromUid },
    text: { stringValue: text },
    createdAt: { timestampValue: new Date().toISOString() },
  });
}

/**
 * Signs up through the real UI: Welcome → S1B phone → S1C code. Returns once the app has
 * left S1C (a new account lands on /vibe). Depends on the S1B / S1C testIDs in
 * docs/architecture.md ("Test ids").
 */
export async function signUpWithPhone(page: Page, nationalDigits = uniquePhone()): Promise<string> {
  await page.goto('/');
  await page.getByTestId('welcome-cta-start').click();
  await page.getByTestId('register-phone-input').fill(nationalDigits);
  await page.getByTestId('register-send-code').click();
  const e164 = `+55${nationalDigits}`;
  // S1C submits by itself on the sixth digit; wait for routing to leave it.
  await page.getByTestId('verify-code-input').fill(await latestSmsCode(e164));
  await expect
    .poll(() => new URL(page.url()).pathname, { message: 'leave /verify-phone' })
    .not.toBe('/verify-phone');
  return e164;
}
