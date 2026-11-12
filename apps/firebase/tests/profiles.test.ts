import { after, before, beforeEach, describe, it } from 'node:test';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { db, profile, testEnvironment, without } from './helpers';

let env: RulesTestEnvironment;
let alice: ReturnType<RulesTestEnvironment['authenticatedContext']>;
let bob: ReturnType<RulesTestEnvironment['authenticatedContext']>;
let aliceTwo: ReturnType<RulesTestEnvironment['authenticatedContext']>;
let signedOut: ReturnType<RulesTestEnvironment['unauthenticatedContext']>;

before(async () => {
  env = await testEnvironment('profiles');
  alice = env.authenticatedContext('alice');
  bob = env.authenticatedContext('bob');
  aliceTwo = env.authenticatedContext('alice-two');
  signedOut = env.unauthenticatedContext();
});

after(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

const aliceCard = () => doc(db(alice), 'profiles/alice');

/** Writes a document with the rules bypassed, to set up read tests. */
function seed(path: string, data: Record<string, unknown>) {
  return env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(db(context), path), data);
  });
}

describe('profiles read', () => {
  it('denies a signed-out read', async () => {
    await seed('profiles/alice', profile());
    await assertFails(getDoc(doc(db(signedOut), 'profiles/alice')));
  });

  it('allows any signed-in user to read a card', async () => {
    await seed('profiles/alice', profile());
    await assertSucceeds(getDoc(doc(db(bob), 'profiles/alice')));
  });

  it('allows a signed-in user to list cards (Discover)', async () => {
    await seed('profiles/alice', profile());
    await assertSucceeds(getDocs(collection(db(bob), 'profiles')));
  });

  it('denies a signed-out list', async () => {
    await assertFails(getDocs(collection(db(signedOut), 'profiles')));
  });
});

describe('profiles create', () => {
  it('allows the owner to create a complete, valid card', async () => {
    await assertSucceeds(setDoc(aliceCard(), profile()));
  });

  it('allows the boundary values: name 40, answer 280, age 18 and 99', async () => {
    await assertSucceeds(
      setDoc(
        aliceCard(),
        profile({ displayName: 'a'.repeat(40), promptAnswer: 'a'.repeat(280), age: 18 }),
      ),
    );
    // A second card needs a second owner: the rules require uid == document id, and a
    // second write to alice's own card would be an update (createdAt != request.time).
    await assertSucceeds(
      setDoc(doc(db(aliceTwo), 'profiles/alice-two'), profile({ age: 99 })),
    );
  });

  it('denies a signed-out create', async () => {
    await assertFails(setDoc(doc(db(signedOut), 'profiles/alice'), profile()));
  });

  it('denies creating a card for another user', async () => {
    await assertFails(setDoc(doc(db(bob), 'profiles/alice'), profile()));
  });

  it('denies a card with a missing key', async () => {
    await assertFails(setDoc(aliceCard(), without(profile(), 'promptId')));
    await assertFails(setDoc(aliceCard(), without(profile(), 'union')));
  });

  it('allows a card with no portrait (photoPath null)', async () => {
    await assertSucceeds(setDoc(aliceCard(), profile({ photoPath: null })));
  });

  it('allows a card with the owner’s own portrait path', async () => {
    await assertSucceeds(setDoc(aliceCard(), profile({ photoPath: 'photos/alice/abc123.jpg' })));
  });

  it('denies a portrait path outside the owner’s folder, not a jpg, or escaping the folder', async () => {
    await assertFails(setDoc(aliceCard(), profile({ photoPath: 'photos/bob/abc123.jpg' })));
    await assertFails(setDoc(aliceCard(), profile({ photoPath: 'photos/alice/abc.png' })));
    await assertFails(setDoc(aliceCard(), profile({ photoPath: 'photos/alice/../x.jpg' })));
    await assertFails(setDoc(aliceCard(), profile({ photoPath: 42 })));
  });

  it('denies a card with a missing photoPath key', async () => {
    await assertFails(setDoc(aliceCard(), without(profile(), 'photoPath')));
  });

  it('denies a card with an extra key', async () => {
    await assertFails(setDoc(aliceCard(), profile({ phoneNumber: '+5511987654321' })));
  });

  it('denies a name outside 1–40 characters', async () => {
    await assertFails(setDoc(aliceCard(), profile({ displayName: '' })));
    await assertFails(setDoc(aliceCard(), profile({ displayName: 'a'.repeat(41) })));
  });

  it('denies an age outside 18–99 or that is not an int', async () => {
    await assertFails(setDoc(aliceCard(), profile({ age: 17 })));
    await assertFails(setDoc(aliceCard(), profile({ age: 100 })));
    await assertFails(setDoc(aliceCard(), profile({ age: 28.5 })));
    await assertFails(setDoc(aliceCard(), profile({ age: '30' })));
  });

  it('denies an unknown vibe or lookingFor', async () => {
    await assertFails(setDoc(aliceCard(), profile({ vibe: 'gamer' })));
    await assertFails(setDoc(aliceCard(), profile({ lookingFor: 'cats' })));
  });

  it('denies a union for a non-member and a member without a union', async () => {
    await assertFails(setDoc(aliceCard(), profile({ unionMember: false, union: 'apeoesp' })));
    await assertFails(setDoc(aliceCard(), profile({ unionMember: true, union: null })));
  });

  it('allows a non-member with a null union', async () => {
    await assertSucceeds(setDoc(aliceCard(), profile({ unionMember: false, union: null })));
  });

  it('denies an unknown union id', async () => {
    await assertFails(setDoc(aliceCard(), profile({ union: 'not_a_union' })));
  });

  it('denies values outside 3–5 unique known ids', async () => {
    await assertFails(setDoc(aliceCard(), profile({ values: ['cycling', 'volunteering'] })));
    await assertFails(
      setDoc(
        aliceCard(),
        profile({
          values: [
            'cycling',
            'volunteering',
            'food_markets',
            'pets_parks',
            'tenant_rights',
            'public_transit',
          ],
        }),
      ),
    );
    await assertFails(
      setDoc(aliceCard(), profile({ values: ['cycling', 'cycling', 'volunteering'] })),
    );
    await assertFails(
      setDoc(aliceCard(), profile({ values: ['cycling', 'volunteering', 'karaoke'] })),
    );
  });

  it('denies an unknown promptId', async () => {
    await assertFails(setDoc(aliceCard(), profile({ promptId: 'not_a_prompt' })));
  });

  it('denies an answer outside 1–280 characters', async () => {
    await assertFails(setDoc(aliceCard(), profile({ promptAnswer: '' })));
    await assertFails(setDoc(aliceCard(), profile({ promptAnswer: 'a'.repeat(281) })));
  });

  it('denies client timestamps instead of request.time', async () => {
    await assertFails(
      setDoc(aliceCard(), profile({ createdAt: Timestamp.fromDate(new Date('2020-01-01')) })),
    );
    await assertFails(
      setDoc(aliceCard(), profile({ updatedAt: Timestamp.fromDate(new Date('2020-01-01')) })),
    );
    await assertFails(setDoc(aliceCard(), without(profile(), 'createdAt')));
    await assertFails(setDoc(aliceCard(), without(profile(), 'updatedAt')));
  });
});

describe('profiles update and delete', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(db(context), 'profiles/alice'), profile());
    });
  });

  it('allows the owner to update a field and refresh updatedAt', async () => {
    await assertSucceeds(
      updateDoc(aliceCard(), { promptAnswer: 'Sunrise at the feira.', updatedAt: serverTimestamp() }),
    );
  });

  it('allows the owner to attach an own portrait to a card with none', async () => {
    const existing = await getDoc(aliceCard());
    await assertSucceeds(
      setDoc(
        aliceCard(),
        profile({
          photoPath: 'photos/alice/abc123.jpg',
          createdAt: existing.data()?.createdAt,
        }),
      ),
    );
  });

  it('denies an update that changes createdAt', async () => {
    await assertFails(
      updateDoc(aliceCard(), {
        createdAt: Timestamp.fromDate(new Date('2020-01-01')),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('denies an update that leaves updatedAt stale', async () => {
    const stale = Timestamp.fromDate(new Date('2020-01-01'));
    await assertFails(updateDoc(aliceCard(), { age: 31, updatedAt: stale }));
  });

  it('denies an update with an invalid field value', async () => {
    await assertFails(updateDoc(aliceCard(), { age: 12, updatedAt: serverTimestamp() }));
  });

  it("denies updating another user's card", async () => {
    await assertFails(
      updateDoc(doc(db(bob), 'profiles/alice'), { age: 31, updatedAt: serverTimestamp() }),
    );
  });

  it('allows the owner to delete and denies anyone else', async () => {
    await assertFails(deleteDoc(doc(db(bob), 'profiles/alice')));
    await assertSucceeds(deleteDoc(aliceCard()));
  });
});
