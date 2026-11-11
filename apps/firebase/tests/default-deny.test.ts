import { after, before, beforeEach, describe, it } from 'node:test';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { addDoc, collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { db, profile, testEnvironment } from './helpers';

let env: RulesTestEnvironment;
let alice: ReturnType<RulesTestEnvironment['authenticatedContext']>;
let signedOut: ReturnType<RulesTestEnvironment['unauthenticatedContext']>;

before(async () => {
  env = await testEnvironment('deny');
  alice = env.authenticatedContext('alice');
  signedOut = env.unauthenticatedContext();
});

after(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

// Everything the rules do not model (profiles, users, users/*/swipes, likes, matches,
// matches/*/messages) is denied by default.
describe('default deny', () => {
  it('denies read and write on an unknown collection', async () => {
    await assertFails(setDoc(doc(db(alice), 'messages/m1'), { body: 'hi' }));
    await assertFails(getDoc(doc(db(alice), 'messages/m1')));
    await assertFails(getDocs(collection(db(alice), 'messages')));
    await assertFails(addDoc(collection(db(alice), 'reports'), { reason: 'spam' }));
  });

  it('denies a signed-out read of a valid card path', async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(db(context), 'profiles/alice'), profile());
    });
    await assertFails(getDoc(doc(db(signedOut), 'profiles/alice')));
  });

  it('denies a nested collection that the rules do not model', async () => {
    await assertFails(setDoc(doc(db(alice), 'profiles/alice/photos/p1'), { url: 'x' }));
    await assertFails(setDoc(doc(db(alice), 'users/alice/matches/m1'), { other: 'bob' }));
  });

  it('is not bypassed by a signed-in user writing to the reserved root', async () => {
    await assertFails(setDoc(doc(db(alice), 'config/app'), { ready: true }));
  });
});
