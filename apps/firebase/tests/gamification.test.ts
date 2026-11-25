import { after, before, beforeEach, describe, it } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db, testEnvironment } from './helpers';

let env: RulesTestEnvironment;
let alice: ReturnType<RulesTestEnvironment['authenticatedContext']>;
let bob: ReturnType<RulesTestEnvironment['authenticatedContext']>;
let signedOut: ReturnType<RulesTestEnvironment['unauthenticatedContext']>;

before(async () => {
  env = await testEnvironment('gamification');
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

/** Writes server-owned documents past the rules, as Functions would. */
async function seed(path: string, data: Record<string, unknown>): Promise<void> {
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(db(context), path), data);
  });
}

function projection(): Record<string, unknown> {
  return {
    balance: 120,
    lifetimeNet: 120,
    levelHighWaterMark: 120,
    levelId: 'botao',
    streak: { currentWeeks: 2, recordWeeks: 9, qualifiedThisWeek: true, pauseBank: 1, pausedUntil: null },
    quest: { questId: 'quest_reply_three', weekStart: '2026-11-23', progress: 1, target: 3, completedAt: null },
    updatedAt: serverTimestamp(),
  };
}

function celebration(): Record<string, unknown> {
  return {
    kind: 'toast',
    copyKey: 'gam.toast.conversation_started',
    amount: 30,
    createdAt: serverTimestamp(),
    seenAt: null,
  };
}

describe('gamification projection', () => {
  it('lets the owner get their own doc and nobody else', async () => {
    await seed('gamification/alice', projection());
    await assertSucceeds(getDoc(doc(db(alice), 'gamification/alice')));
    await assertFails(getDoc(doc(db(bob), 'gamification/alice')));
    await assertFails(getDoc(doc(db(signedOut), 'gamification/alice')));
    await assertFails(getDoc(doc(db(alice), 'gamification/bob')));
  });

  it('denies listing the collection, even to a member', async () => {
    await seed('gamification/alice', projection());
    await assertFails(getDocs(collection(db(alice), 'gamification')));
  });

  it('denies every client write, including the owner', async () => {
    await seed('gamification/alice', projection());
    await assertFails(setDoc(doc(db(alice), 'gamification/alice'), projection()));
    await assertFails(updateDoc(doc(db(alice), 'gamification/alice'), { balance: 999999 }));
    await assertFails(deleteDoc(doc(db(alice), 'gamification/alice')));
    await assertFails(setDoc(doc(db(alice), 'gamification/carol'), projection()));
  });
});

describe('gamification ledger', () => {
  it('lets the owner get and list entries; nobody else', async () => {
    await seed('gamification/alice/ledger/conversation_started:ab12_cd34:ab12', {
      track: 'cravos',
      kind: 'earn',
      amount: 30,
      ruleId: 'conversation_started',
      ruleSetVersion: 1,
      source: { event: 'conversation.started', path: 'matches/ab12_cd34', eventId: 'e1' },
      actor: 'system',
      createdAt: serverTimestamp(),
    });
    await assertSucceeds(
      getDoc(doc(db(alice), 'gamification/alice/ledger/conversation_started:ab12_cd34:ab12')),
    );
    await assertSucceeds(
      getDocs(
        query(
          collection(db(alice), 'gamification/alice/ledger'),
          orderBy('createdAt', 'desc'),
          limit(20),
        ),
      ),
    );
    await assertFails(
      getDoc(doc(db(bob), 'gamification/alice/ledger/conversation_started:ab12_cd34:ab12')),
    );
    await assertFails(
      getDocs(query(collection(db(bob), 'gamification/alice/ledger'), limit(20))),
    );
  });

  it('denies every client write to the ledger', async () => {
    await seed('gamification/alice', projection());
    await assertFails(
      setDoc(doc(db(alice), 'gamification/alice/ledger/forged:ab12_cd34:alice'), {
        kind: 'earn',
        amount: 5000,
      }),
    );
    await assertFails(
      updateDoc(doc(db(alice), 'gamification/alice/ledger/conversation_started:ab12_cd34:ab12'), {
        amount: 5000,
      }),
    );
    await assertFails(
      deleteDoc(doc(db(alice), 'gamification/alice/ledger/conversation_started:ab12_cd34:ab12')),
    );
  });
});

describe('celebrations', () => {
  it('lets the owner get and list; nobody else', async () => {
    await seed('gamification/alice/celebrations/c1', celebration());
    await assertSucceeds(getDoc(doc(db(alice), 'gamification/alice/celebrations/c1')));
    await assertSucceeds(
      getDocs(query(collection(db(alice), 'gamification/alice/celebrations'), limit(10))),
    );
    await assertFails(getDoc(doc(db(bob), 'gamification/alice/celebrations/c1')));
    await assertFails(getDoc(doc(db(signedOut), 'gamification/alice/celebrations/c1')));
  });

  it('lets the owner set only seenAt, with the server timestamp', async () => {
    await seed('gamification/alice/celebrations/c1', celebration());
    await assertSucceeds(
      updateDoc(doc(db(alice), 'gamification/alice/celebrations/c1'), {
        seenAt: serverTimestamp(),
      }),
    );
    // Acknowledging twice stays allowed: it is the same harmless field.
    await assertSucceeds(
      updateDoc(doc(db(alice), 'gamification/alice/celebrations/c1'), {
        seenAt: serverTimestamp(),
      }),
    );
  });

  it('denies the owner touching any other field', async () => {
    await seed('gamification/alice/celebrations/c1', celebration());
    await assertFails(
      updateDoc(doc(db(alice), 'gamification/alice/celebrations/c1'), {
        seenAt: serverTimestamp(),
        amount: 4000,
      }),
    );
    await assertFails(
      updateDoc(doc(db(alice), 'gamification/alice/celebrations/c1'), { amount: 4000 }),
    );
    await assertFails(
      updateDoc(doc(db(alice), 'gamification/alice/celebrations/c1'), {
        copyKey: 'gam.toast.forged',
      }),
    );
    await assertFails(
      updateDoc(doc(db(alice), 'gamification/alice/celebrations/c1'), {
        seenAt: '2026-11-25T00:00:00Z',
      }),
    );
    await assertFails(
      updateDoc(doc(db(alice), 'gamification/alice/celebrations/c1'), {
        seenAt: Timestamp.fromDate(new Date('2020-01-01')),
      }),
    );
  });

  it('denies writes by anyone else, and create or delete by anyone', async () => {
    await seed('gamification/alice/celebrations/c1', celebration());
    await assertFails(
      updateDoc(doc(db(bob), 'gamification/alice/celebrations/c1'), {
        seenAt: serverTimestamp(),
      }),
    );
    await assertFails(
      setDoc(doc(db(alice), 'gamification/alice/celebrations/c2'), celebration()),
    );
    await assertFails(deleteDoc(doc(db(alice), 'gamification/alice/celebrations/c1')));
  });
});

describe('lots and achievements', () => {
  it('let the owner read them and nobody else, with no client writes', async () => {
    await seed('gamification/alice/lots/l1', {
      amount: 30,
      earnedAt: '2026-11-21T22:42:10Z',
      expiresAt: '2027-11-21',
      sourceLedgerId: 'conversation_started:ab12_cd34:ab12',
    });
    await seed('gamification/alice/achievements/faisca', {
      tier: 0,
      unlockedAt: '2026-11-21T22:42:10Z',
      status: 'unlocked',
      updatedAt: '2026-11-21T22:42:10Z',
    });
    for (const path of ['lots/l1', 'achievements/faisca']) {
      await assertSucceeds(getDoc(doc(db(alice), `gamification/alice/${path}`)));
      await assertSucceeds(
        getDocs(collection(db(alice), `gamification/alice/${path.split('/')[0]}`)),
      );
      await assertFails(getDoc(doc(db(bob), `gamification/alice/${path}`)));
      await assertFails(
        setDoc(doc(db(alice), `gamification/alice/${path}`), { forged: true }),
      );
      await assertFails(deleteDoc(doc(db(alice), `gamification/alice/${path}`)));
    }
  });
});

describe('server-only collections', () => {
  it('denies the owner read and write access to counters', async () => {
    await seed('gamification/alice/counters/conversation_started:2026-11-25', {
      count: 1,
      updatedAt: serverTimestamp(),
    });
    await assertFails(
      getDoc(doc(db(alice), 'gamification/alice/counters/conversation_started:2026-11-25')),
    );
    await assertFails(
      getDocs(collection(db(alice), 'gamification/alice/counters')),
    );
    await assertFails(
      setDoc(doc(db(alice), 'gamification/alice/counters/forged'), { count: 99 }),
    );
  });

  it('denies every nested path the rules do not model', async () => {
    await assertFails(getDoc(doc(db(alice), 'gamification/alice/history/h1')));
    await assertFails(setDoc(doc(db(alice), 'gamification/alice/history/h1'), { weeks: 9 }));
  });

  it('keeps gamRuleSets, gamConfig, gamAudit, gamAdjustments, gamShadow and gamMetrics server-only', async () => {
    for (const path of [
      'gamRuleSets/v1',
      'gamConfig/active',
      'gamAudit/a1',
      'gamAdjustments/ad1',
      'gamShadow/alice',
      'gamMetrics/2026-11-25',
    ]) {
      await assertFails(getDoc(doc(db(alice), path)));
      await assertFails(getDoc(doc(db(signedOut), path)));
      await assertFails(setDoc(doc(db(alice), path), { forged: true }));
    }
  });
});

describe('catalog', () => {
  it('is readable by any signed-in member, and by nobody signed out', async () => {
    await seed('catalog/coffee_bookshop', {
      title: 'Coffee at the bookshop',
      description: 'One coffee, on us.',
      priceCravos: 150,
      kind: 'partner_funded',
      partner: 'Sebo & Café',
      stock: 10,
      active: true,
    });
    await assertSucceeds(getDoc(doc(db(alice), 'catalog/coffee_bookshop')));
    await assertSucceeds(getDoc(doc(db(bob), 'catalog/coffee_bookshop')));
    await assertSucceeds(getDocs(collection(db(alice), 'catalog')));
    await assertFails(getDoc(doc(db(signedOut), 'catalog/coffee_bookshop')));
    await assertFails(getDocs(collection(db(signedOut), 'catalog')));
  });

  it('denies every client write', async () => {
    await assertFails(
      setDoc(doc(db(alice), 'catalog/forged'), { title: 'Free Cravos', priceCravos: 0 }),
    );
    await assertFails(
      updateDoc(doc(db(alice), 'catalog/coffee_bookshop'), { priceCravos: 1 }),
    );
    await assertFails(deleteDoc(doc(db(alice), 'catalog/coffee_bookshop')));
  });
});

describe('redemptions', () => {
  it('allows owner reads and bounded owner queries', async () => {
    await seed('redemptions/r1', {
      uid: 'alice',
      itemId: 'coffee_bookshop',
      status: 'pending',
      cravos: 150,
      redeemEntryIds: ['redeem:l1:alice'],
      code: null,
      createdAt: serverTimestamp(),
      fulfilledAt: null,
    });
    await seed('redemptions/r2', {
      uid: 'bob',
      itemId: 'coffee_bookshop',
      status: 'pending',
      cravos: 150,
      redeemEntryIds: ['redeem:l9:bob'],
      code: null,
      createdAt: serverTimestamp(),
      fulfilledAt: null,
    });
    await assertSucceeds(getDoc(doc(db(alice), 'redemptions/r1')));
    await assertFails(getDoc(doc(db(bob), 'redemptions/r1')));
    await assertFails(getDoc(doc(db(alice), 'redemptions/r2')));
    await assertFails(getDoc(doc(db(signedOut), 'redemptions/r1')));
    await assertFails(
      getDocs(query(collection(db(alice), 'redemptions'), orderBy('createdAt'), limit(20))),
    );
    await assertSucceeds(getDocs(query(collection(db(alice), 'redemptions'),
      where('uid', '==', 'alice'), orderBy('createdAt', 'desc'), limit(25))));
    await assertFails(getDocs(query(collection(db(bob), 'redemptions'),
      where('uid', '==', 'alice'), orderBy('createdAt', 'desc'), limit(25))));
    await assertFails(getDocs(query(collection(db(alice), 'redemptions'), where('uid', '==', 'alice'))));
    await assertFails(
      setDoc(doc(db(alice), 'redemptions/r3'), { uid: 'alice', itemId: 'coffee_bookshop' }),
    );
    await assertFails(updateDoc(doc(db(alice), 'redemptions/r1'), { code: 'FREEBIE' }));
    await assertFails(deleteDoc(doc(db(alice), 'redemptions/r1')));
  });
});

it('denies all direct access to the private partner code pool', async () => {
  const path = 'catalogCodes/sample/codes/PARTNER_CODE';
  await seed(path, { assignedTo: null });
  for (const context of [alice, signedOut]) {
    await assertFails(getDoc(doc(db(context), path)));
    await assertFails(getDocs(collection(db(context), 'catalogCodes/sample/codes')));
    await assertFails(updateDoc(doc(db(context), path), { assignedTo: 'alice' }));
  }
});

it('lets only the owner read server-managed Cravos preferences', async () => {
  const path = 'gamPreferences/alice';
  await seed(path, { optedOut: true });
  await assertSucceeds(getDoc(doc(db(alice), path)));
  await assertFails(getDoc(doc(db(bob), path)));
  await assertFails(getDocs(collection(db(alice), 'gamPreferences')));
  await assertFails(updateDoc(doc(db(alice), path), { optedOut: false }));
});
