import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { serverTimestamp, type Firestore } from 'firebase/firestore';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const RULES = readFileSync(join(ROOT, 'firestore.rules'), 'utf8');

const [HOST, PORT] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8089').split(':');
export const EMULATOR_ORIGIN = `http://${HOST}:${PORT}`;

/**
 * Starts a rules environment for one test file and deploys firestore.rules to it. Every
 * file gets its own project id, so the files (which `node --test` runs in parallel) never
 * clear each other's documents, and they stay out of the `demo-comradia` data the E2E
 * suite seeds.
 */
export async function testEnvironment(name: string): Promise<RulesTestEnvironment> {
  const projectId = `demo-comradia-rules-${name}`;
  const env = await initializeTestEnvironment({
    projectId,
    firestore: { host: HOST, port: Number(PORT), rules: RULES },
  });
  await assertRulesDeployed(projectId);
  return env;
}

/**
 * A project without a deployed ruleset is open, so assert the deployment landed before a
 * file's tests run instead of silently passing on permissive defaults.
 */
async function assertRulesDeployed(projectId: string): Promise<void> {
  const url = `${EMULATOR_ORIGIN}/emulator/v1/projects/${projectId}:securityRules`;
  const response = await fetch(url);
  assert.ok(response.ok, `GET ${url} → ${response.status}. Are the Firestore emulators running?`);
  const body = (await response.json()) as { rules?: { files?: { content?: string }[] } };
  assert.equal(
    body.rules?.files?.[0]?.content,
    RULES,
    `The emulator did not take the ruleset deployed for ${projectId}; use a fresh emulator`,
  );
}

/**
 * `context.firestore()` is a compat instance; its internal `_delegate` is a modular
 * Firestore, so the modular API (doc / setDoc / serverTimestamp) works on it. The cast
 * only fixes the types.
 */
export function db(context: RulesTestContext): Firestore {
  return context.firestore() as unknown as Firestore;
}

/** A complete, valid public card. Override one field to test that field's rule. */
export function profile(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    displayName: 'Alice',
    age: 30,
    vibe: 'bookworm',
    lookingFor: 'everyone',
    unionMember: true,
    union: 'apeoesp',
    values: ['climate_outdoors', 'public_transit', 'cycling'],
    promptId: 'perfect_sunday',
    promptAnswer: 'Feira, then a long lunch.',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  };
}

/** A complete, valid private account document. */
export function account(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    birthDate: '1990-01-02',
    sharedPassionWeight: 60,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  };
}

/** A complete, valid swipe. */
export function swipe(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { direction: 'like', createdAt: serverTimestamp(), ...overrides };
}

/** A like written by `likerUid` on `targetUid`: `likes/{targetUid}/from/{likerUid}`. */
export function like(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { createdAt: serverTimestamp(), ...overrides };
}

/** A match document: `users` is the two uids sorted, and the id is both joined by `_`. */
export function match(
  a: string,
  b: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    users: a < b ? [a, b] : [b, a],
    createdAt: serverTimestamp(),
    ...overrides,
  };
}

/** A chat message sent by Alice. */
export function message(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    from: 'alice',
    text: 'Oi! Want to get a coffee?',
    createdAt: serverTimestamp(),
    ...overrides,
  };
}

/**
 * A block document: both `users/{uid}/blocks/{blockedUid}` and the reverse index
 * `blocks/{blockedUid}/by/{uid}` hold the same one-field document.
 */
export function block(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { createdAt: serverTimestamp(), ...overrides };
}

/** A report written by Alice about Bob. Override one field to test that field's rule. */
export function report(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    reporter: 'alice',
    target: 'bob',
    reason: 'harassment',
    details: 'Kept messaging after I said no.',
    context: 'chat',
    createdAt: serverTimestamp(),
    ...overrides,
  };
}

/** Returns a copy of `data` without `keys` (a missing key must be denied). */
export function without(data: Record<string, unknown>, ...keys: string[]): Record<string, unknown> {
  const copy = { ...data };
  for (const key of keys) delete copy[key];
  return copy;
}
