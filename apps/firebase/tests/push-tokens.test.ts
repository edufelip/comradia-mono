import { createHash, randomUUID } from 'node:crypto';
import { after, before, beforeEach, describe, it } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  type RulesTestContext,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import { db, testEnvironment } from './helpers';

let env: RulesTestEnvironment;
let alice: ReturnType<RulesTestEnvironment['authenticatedContext']>;
let bob: ReturnType<RulesTestEnvironment['authenticatedContext']>;
let signedOut: ReturnType<RulesTestEnvironment['unauthenticatedContext']>;

before(async () => {
  env = await testEnvironment('push-tokens');
  alice = env.authenticatedContext('alice');
  bob = env.authenticatedContext('bob');
  signedOut = env.unauthenticatedContext();
});

after(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

function tokenId(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function pushToken(token: string, overrides: Record<string, unknown> = {}) {
  return {
    token,
    platform: 'ios',
    updatedAt: serverTimestamp(),
    ...overrides,
  };
}

function tokenRef(context: RulesTestContext, uid: string, id: string) {
  return doc(db(context), `users/${uid}/pushTokens/${id}`);
}

describe('users/{uid}/pushTokens', () => {
  it('allows the owner to create, read, update and delete a valid token', async () => {
    const token = `fcm-${randomUUID()}`;
    const ref = tokenRef(alice, 'alice', tokenId(token));
    await assertSucceeds(setDoc(ref, pushToken(token)));
    await assertSucceeds(getDoc(ref));
    await assertSucceeds(getDocs(collection(db(alice), 'users/alice/pushTokens')));
    await assertSucceeds(
      setDoc(ref, pushToken(token, { platform: 'android', updatedAt: serverTimestamp() })),
    );
    await assertSucceeds(deleteDoc(ref));

    const maxLengthToken = 't'.repeat(4096);
    await assertSucceeds(
      setDoc(tokenRef(alice, 'alice', tokenId(maxLengthToken)), pushToken(maxLengthToken)),
    );
  });

  it('denies other users and signed-out users from reading or writing tokens', async () => {
    const token = `fcm-${randomUUID()}`;
    const ownerRef = tokenRef(alice, 'alice', tokenId(token));
    await assertSucceeds(setDoc(ownerRef, pushToken(token)));

    const bobRef = tokenRef(bob, 'alice', tokenId(token));
    const signedOutRef = tokenRef(signedOut, 'alice', tokenId(token));
    await assertFails(getDoc(bobRef));
    await assertFails(getDoc(signedOutRef));
    await assertFails(getDocs(collection(db(bob), 'users/alice/pushTokens')));
    await assertFails(getDocs(collection(db(signedOut), 'users/alice/pushTokens')));
    await assertFails(setDoc(bobRef, pushToken(token)));
    await assertFails(setDoc(signedOutRef, pushToken(token)));
    await assertFails(deleteDoc(bobRef));
    await assertFails(deleteDoc(signedOutRef));
  });

  it('requires a lowercase 64-character SHA-256-shaped document id', async () => {
    await assertFails(setDoc(tokenRef(alice, 'alice', 'bad-id'), pushToken('fcm-token')));
    await assertFails(
      setDoc(tokenRef(alice, 'alice', 'A'.repeat(64)), pushToken('fcm-token')),
    );
    await assertFails(
      setDoc(tokenRef(alice, 'alice', 'a'.repeat(63)), pushToken('fcm-token')),
    );
  });

  it('bounds the token and validates the platform and exact fields', async () => {
    const token = `fcm-${randomUUID()}`;
    const id = tokenId(token);
    await assertFails(setDoc(tokenRef(alice, 'alice', id), pushToken('')));
    await assertFails(
      setDoc(tokenRef(alice, 'alice', id), pushToken('t'.repeat(4097))),
    );
    await assertFails(setDoc(tokenRef(alice, 'alice', id), pushToken(token, { platform: 'web' })));
    await assertFails(setDoc(tokenRef(alice, 'alice', id), pushToken(token, { extra: true })));
    const { updatedAt: _updatedAt, ...missingUpdatedAt } = pushToken(token);
    await assertFails(setDoc(tokenRef(alice, 'alice', id), missingUpdatedAt));
    await assertFails(
      setDoc(
        tokenRef(alice, 'alice', id),
        pushToken(token, { updatedAt: Timestamp.fromDate(new Date('2020-01-01')) }),
      ),
    );
  });

  it('denies writes into another user path', async () => {
    const token = `fcm-${randomUUID()}`;
    await assertFails(
      setDoc(tokenRef(bob, 'alice', tokenId(token)), pushToken(token)),
    );
  });
});

describe('notificationDispatches server-only ledger', () => {
  it('denies client reads, queries, creates, updates and deletes', async () => {
    const markerId = 'a'.repeat(64);
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(db(context), 'notificationDispatches', markerId), {
        createdAt: serverTimestamp(),
      });
    });
    for (const context of [alice, bob, signedOut]) {
      const marker = doc(db(context), 'notificationDispatches', markerId);
      await assertFails(getDoc(marker));
      await assertFails(getDocs(collection(db(context), 'notificationDispatches')));
      await assertFails(setDoc(doc(db(context), 'notificationDispatches', 'b'.repeat(64)), {
        createdAt: serverTimestamp(),
      }));
      await assertFails(setDoc(marker, { createdAt: serverTimestamp() }));
      await assertFails(deleteDoc(marker));
    }
  });
});

it('accepts optional supported registration locales while retaining legacy registrations', async () => {
  const token = `locale-${randomUUID()}`;
  const ref = tokenRef(alice, 'alice', tokenId(token));
  await assertSucceeds(setDoc(ref, pushToken(token)));
  for (const locale of ['en-US', 'pt-BR', 'es-ES']) {
    await assertSucceeds(setDoc(ref, pushToken(token, { locale })));
  }
});

it('denies malformed or unsupported registration locales', async () => {
  const token = `locale-invalid-${randomUUID()}`;
  const ref = tokenRef(alice, 'alice', tokenId(token));
  for (const locale of ['fr-FR', '', null, 123, ['pt-BR']]) {
    await assertFails(setDoc(ref, pushToken(token, { locale })));
  }
});
