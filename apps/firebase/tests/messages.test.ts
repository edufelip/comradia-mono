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
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { block, db, message, match, testEnvironment, without } from './helpers';

let env: RulesTestEnvironment;
let alice: ReturnType<RulesTestEnvironment['authenticatedContext']>;
let bob: ReturnType<RulesTestEnvironment['authenticatedContext']>;
let carol: ReturnType<RulesTestEnvironment['authenticatedContext']>;
let signedOut: ReturnType<RulesTestEnvironment['unauthenticatedContext']>;

before(async () => {
  env = await testEnvironment('messages');
  alice = env.authenticatedContext('alice');
  bob = env.authenticatedContext('bob');
  carol = env.authenticatedContext('carol');
  signedOut = env.unauthenticatedContext();
});

after(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(db(context), 'matches/alice_bob'), match('alice', 'bob'));
  });
});

/** `matches/{matchId}/messages/{messageId}` */
const messageRef = (context: RulesTestContext, matchId: string, id = 'm1') =>
  doc(db(context), `matches/${matchId}/messages/${id}`);

function seed(path: string, data: Record<string, unknown>) {
  return env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(db(context), path), data);
  });
}

describe('messages create', () => {
  it('allows either person to write a message as themselves', async () => {
    await assertSucceeds(setDoc(messageRef(alice, 'alice_bob'), message()));
    await assertSucceeds(setDoc(messageRef(bob, 'alice_bob', 'm2'), message({ from: 'bob' })));
  });

  it('allows the text bounds: 1 and 1000 characters', async () => {
    await assertSucceeds(setDoc(messageRef(alice, 'alice_bob', 'm1'), message({ text: 'a' })));
    await assertSucceeds(
      setDoc(messageRef(alice, 'alice_bob', 'm2'), message({ text: 'a'.repeat(1000) })),
    );
  });

  it('denies empty and over-long text, and a non-string', async () => {
    await assertFails(setDoc(messageRef(alice, 'alice_bob', 'm1'), message({ text: '' })));
    await assertFails(
      setDoc(messageRef(alice, 'alice_bob', 'm2'), message({ text: 'a'.repeat(1001) })),
    );
    await assertFails(setDoc(messageRef(alice, 'alice_bob', 'm3'), message({ text: 42 })));
  });

  it('denies a message written as the other person', async () => {
    await assertFails(setDoc(messageRef(alice, 'alice_bob'), message({ from: 'bob' })));
  });

  it('denies a message from someone outside the match', async () => {
    await assertFails(setDoc(messageRef(carol, 'alice_bob'), message({ from: 'carol' })));
  });

  it('denies a signed-out create', async () => {
    await assertFails(setDoc(messageRef(signedOut, 'alice_bob'), message()));
  });

  it('denies a message in a match that does not exist', async () => {
    await assertFails(setDoc(messageRef(alice, 'alice_carol'), message()));
  });

  it('denies extra and missing keys, and a client timestamp', async () => {
    await assertFails(setDoc(messageRef(alice, 'alice_bob'), message({ read: true })));
    await assertFails(setDoc(messageRef(alice, 'alice_bob'), without(message(), 'from')));
    await assertFails(setDoc(messageRef(alice, 'alice_bob'), without(message(), 'text')));
    await assertFails(setDoc(messageRef(alice, 'alice_bob'), without(message(), 'createdAt')));
    await assertFails(
      setDoc(
        messageRef(alice, 'alice_bob'),
        message({ createdAt: Timestamp.fromDate(new Date('2020-01-01')) }),
      ),
    );
  });

  it('denies a message when one of them blocked the other', async () => {
    await seed('blocks/bob/by/alice', block());
    await assertFails(setDoc(messageRef(alice, 'alice_bob'), message()));
  });

  it('denies a message when the other person blocked me', async () => {
    await seed('blocks/alice/by/bob', block());
    await assertFails(setDoc(messageRef(alice, 'alice_bob'), message()));
  });

  it('allows the message again once the block is gone', async () => {
    await seed('blocks/bob/by/alice', block());
    await assertFails(setDoc(messageRef(alice, 'alice_bob'), message()));
    await assertSucceeds(deleteDoc(doc(db(alice), 'blocks/bob/by/alice')));
    await assertSucceeds(setDoc(messageRef(alice, 'alice_bob'), message()));
  });

  it('denies update, and allows the sender to delete only their own message', async () => {
    await seed('matches/alice_bob/messages/m1', message());
    await assertFails(
      updateDoc(messageRef(alice, 'alice_bob'), {
        text: 'edited',
        createdAt: serverTimestamp(),
      }),
    );
    await assertFails(deleteDoc(messageRef(bob, 'alice_bob')));
    await assertFails(deleteDoc(messageRef(carol, 'alice_bob')));
    await assertFails(deleteDoc(messageRef(signedOut, 'alice_bob')));
    await assertSucceeds(deleteDoc(messageRef(alice, 'alice_bob')));
    await seed('matches/alice_bob/messages/m1', message({ from: 'bob' }));
    await assertFails(deleteDoc(messageRef(alice, 'alice_bob')));
    await assertSucceeds(deleteDoc(messageRef(bob, 'alice_bob')));
  });
});

describe('messages read', () => {
  beforeEach(async () => {
    await seed('matches/alice_bob/messages/m1', message());
  });

  it('allows both people to read and to list the chat', async () => {
    await assertSucceeds(getDoc(messageRef(alice, 'alice_bob')));
    await assertSucceeds(getDoc(messageRef(bob, 'alice_bob')));
    await assertSucceeds(
      getDocs(
        query(collection(db(bob), 'matches/alice_bob/messages'), orderBy('createdAt', 'asc')),
      ),
    );
  });

  it('denies a third person and a signed-out reader', async () => {
    await assertFails(getDoc(messageRef(carol, 'alice_bob')));
    await assertFails(
      getDocs(query(collection(db(carol), 'matches/alice_bob/messages'), orderBy('createdAt'))),
    );
    await assertFails(getDoc(messageRef(signedOut, 'alice_bob')));
  });

  it('denies reading messages of a match that does not exist', async () => {
    await assertFails(getDoc(messageRef(alice, 'alice_carol')));
  });
});
