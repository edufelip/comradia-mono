import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { FieldValue, Timestamp, getFirestore, type Firestore } from 'firebase-admin/firestore';
import type { MulticastMessage } from 'firebase-admin/messaging';
import {
  createNotificationDispatcher,
  FirestoreNotificationStore,
  type CreatedNotificationEvent,
  type FcmSender,
  type FcmSendResult,
  type NotificationStore,
} from '../src/notification-handler.js';

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
if (!emulatorHost || !['127.0.0.1', 'localhost', '::1'].includes(emulatorHost.split(':')[0] ?? '')) {
  throw new Error('Functions integration tests require a local FIRESTORE_EMULATOR_HOST.');
}

const app = initializeApp({ projectId: 'demo-comradia' }, `notification-tests-${randomUUID()}`);
let firestore: Firestore;

before(() => {
  firestore = getFirestore(app);
});

after(async () => {
  await deleteApp(app);
});

class RecordingSender implements FcmSender {
  readonly messages: MulticastMessage[] = [];
  response: (message: MulticastMessage) => FcmSendResult = (message) => ({
    responses: message.tokens.map(() => ({ success: true })),
  });

  async sendEachForMulticast(message: MulticastMessage): Promise<FcmSendResult> {
    this.messages.push(structuredClone(message));
    return this.response(message);
  }
}

async function fixture() {
  const id = randomUUID().replaceAll('-', '');
  const users = [`a${id}`, `b${id}`].sort() as [string, string];
  const matchId = `${users[0]}_${users[1]}`;
  const profileData = {
    displayName: 'Private Name',
    values: ['political-data-must-not-be-sent'],
  };
  const accountData = { birthDate: '1990-01-02' };

  await Promise.all(
    users.flatMap((uid) => [
      firestore.doc(`users/${uid}`).set(accountData),
      firestore.doc(`profiles/${uid}`).set(profileData),
    ]),
  );
  await firestore.doc(`matches/${matchId}`).set({ users, createdAt: FieldValue.serverTimestamp() });

  return { users, matchId };
}

async function seedToken(uid: string, token: string, platform: 'ios' | 'android' = 'ios') {
  const id = createHash('sha256').update(token).digest('hex');
  await firestore.doc(`users/${uid}/pushTokens/${id}`).set({
    token,
    platform,
    updatedAt: FieldValue.serverTimestamp(),
  });
  return id;
}

function createdEvent(
  matchId: string,
  options: Partial<CreatedNotificationEvent> = {},
): CreatedNotificationEvent {
  return {
    eventId: randomUUID(),
    type: 'match',
    matchId,
    ...options,
  };
}

describe('match and message notification dispatch', () => {
  it('sends both match notifications with generic lockscreen text and minimal data', async () => {
    const { users, matchId } = await fixture();
    await seedToken(users[0], `token-${randomUUID()}`);
    await seedToken(users[1], `token-${randomUUID()}`, 'android');
    const sender = new RecordingSender();
    const dispatch = createNotificationDispatcher(new FirestoreNotificationStore(firestore), sender);

    await dispatch(createdEvent(matchId, { eventId: 'match-generic-payload' }));

    assert.equal(sender.messages.length, 2);
    for (const message of sender.messages) {
      assert.deepEqual(Object.keys(message.data ?? {}).sort(), ['matchId', 'recipientUid', 'type']);
      assert.equal(message.data?.type, 'match');
      assert.equal(message.data?.matchId, matchId);
      assert.ok(users.includes(message.data?.recipientUid ?? ''));
      assert.equal(message.notification?.title, 'New match');
      assert.equal(message.notification?.body, 'You have a new match.');
      assert.equal(JSON.stringify(message).includes('Private Name'), false);
      assert.equal(JSON.stringify(message).includes('political-data-must-not-be-sent'), false);
      assert.equal(message.android?.notification?.channelId, 'matches-messages');
    }
  });

  it('notifies only the other match member for a valid new message', async () => {
    const { users, matchId } = await fixture();
    await seedToken(users[0], `sender-token-${randomUUID()}`);
    await seedToken(users[1], `recipient-token-${randomUUID()}`);
    const sender = new RecordingSender();
    const dispatch = createNotificationDispatcher(new FirestoreNotificationStore(firestore), sender);

    await dispatch(createdEvent(matchId, {
      eventId: 'message-recipient-only',
      type: 'message',
      senderUid: users[0],
      messageText: 'Do not include this text in a push.',
    }));

    assert.equal(sender.messages.length, 1);
    assert.equal(sender.messages[0]?.tokens.length, 1);
    assert.equal(sender.messages[0]?.data?.recipientUid, users[1]);
    assert.equal(sender.messages[0]?.data?.type, 'message');
    assert.equal(sender.messages[0]?.notification?.title, 'New message');
    assert.equal(sender.messages[0]?.notification?.body, 'You received a new message.');
    assert.equal(JSON.stringify(sender.messages[0]).includes('Do not include this text'), false);
  });

  it('skips an invalid message sender and deleted account', async () => {
    const first = await fixture();
    for (const uid of first.users) await seedToken(uid, `invalid-sender-${uid}`);
    const sender = new RecordingSender();
    const dispatch = createNotificationDispatcher(new FirestoreNotificationStore(firestore), sender);
    await dispatch(createdEvent(first.matchId, {
      eventId: 'message-outside-match',
      type: 'message',
      senderUid: 'not-a-member',
    }));

    const second = await fixture();
    await seedToken(second.users[0], `deleted-recipient-${randomUUID()}`);
    await seedToken(second.users[1], `deleted-sender-${randomUUID()}`);
    await firestore.doc(`users/${second.users[1]}`).delete();
    await dispatch(createdEvent(second.matchId, {
      eventId: 'message-deleted-account',
      type: 'message',
      senderUid: second.users[0],
    }));

    assert.equal(sender.messages.length, 0);
  });

  it('rechecks both mirrored block paths after reading the registrations', async () => {
    for (const blocker of [0, 1] as const) {
      const { users, matchId } = await fixture();
      await seedToken(users[0], `block-test-${randomUUID()}`);
      const blockPath = blocker === 0
        ? `blocks/${users[1]}/by/${users[0]}`
        : `blocks/${users[0]}/by/${users[1]}`;
      const store = new FirestoreNotificationStore(firestore);
      const listTokens = store.listPushTokens.bind(store);
      store.listPushTokens = async (uid) => {
        const tokens = await listTokens(uid);
        await firestore.doc(blockPath).set({ createdAt: FieldValue.serverTimestamp() });
        return tokens;
      };
      const sender = new RecordingSender();
      const dispatch = createNotificationDispatcher(store, sender);

      await dispatch(createdEvent(matchId, { eventId: `block-direction-${blocker}` }));
      assert.equal(sender.messages.length, 0);
    }
  });

  it('does not send a token revoked after claiming the event and before reading registrations', async () => {
    const { users, matchId } = await fixture();
    const token = `revoked-before-read-${randomUUID()}`;
    const tokenId = await seedToken(users[1], token);
    const store = new FirestoreNotificationStore(firestore);
    const claimDispatch = store.claimDispatch.bind(store);
    store.claimDispatch = async (input) => {
      const claim = await claimDispatch(input);
      assert.equal(claim, 'claimed');
      await firestore.doc(`users/${input.recipientUid}/pushTokens/${tokenId}`).delete();
      return claim;
    };
    const sender = new RecordingSender();
    const dispatch = createNotificationDispatcher(store, sender);

    await dispatch(createdEvent(matchId, {
      eventId: 'revoked-before-read',
      type: 'message',
      senderUid: users[0],
    }));

    assert.equal(sender.messages.length, 0);
  });

  it('reads a Portuguese recipient token once and checks dispatch safety once', async () => {
    const { users, matchId } = await fixture();
    const tokenId = createHash('sha256').update('single-locale-cost-token').digest('hex');
    await firestore.doc(`users/${users[1]}/pushTokens/${tokenId}`).set({
      token: 'single-locale-cost-token',
      platform: 'ios',
      locale: 'pt-BR',
      updatedAt: FieldValue.serverTimestamp(),
    });
    const store = new FirestoreNotificationStore(firestore);
    let listCalls = 0;
    let safetyCalls = 0;
    const listPushTokens = store.listPushTokens.bind(store);
    const isDispatchAllowed = store.isDispatchAllowed.bind(store);
    store.listPushTokens = async (uid) => {
      listCalls += 1;
      return listPushTokens(uid);
    };
    store.isDispatchAllowed = async (input) => {
      safetyCalls += 1;
      return isDispatchAllowed(input);
    };
    const sender = new RecordingSender();

    await createNotificationDispatcher(store, sender)(createdEvent(matchId, {
      eventId: 'pt-br-one-token',
      type: 'message',
      senderUid: users[0],
    }));

    assert.equal(sender.messages.length, 1);
    assert.equal(sender.messages[0]?.notification?.title, 'Nova mensagem');
    assert.equal(listCalls, 1);
    assert.equal(safetyCalls, 1);
  });

  it('claims deterministic per-event recipient markers before sending duplicates', async () => {
    const { users, matchId } = await fixture();
    await seedToken(users[1], `duplicate-token-${randomUUID()}`);
    const sender = new RecordingSender();
    const dispatch = createNotificationDispatcher(new FirestoreNotificationStore(firestore), sender);
    const event = createdEvent(matchId, {
      eventId: 'duplicate-message-event',
      type: 'message',
      senderUid: users[0],
    });

    await dispatch(event);
    await dispatch(event);

    assert.equal(sender.messages.length, 1);
  });

  it('sets a seven-day TTL on notification dispatch and report alert markers', async () => {
    const { users, matchId } = await fixture();
    const store = new FirestoreNotificationStore(firestore);
    const dispatchId = 'ttl-dispatch-marker';
    assert.equal(await store.claimDispatch({
      eventId: dispatchId,
      type: 'match',
      matchId,
      users,
      recipientUid: users[0],
    }), 'claimed');
    assert.equal(await store.claimReportAlert('ttl-report-marker', users[0]), true);

    for (const rawId of [`match\0${dispatchId}\0${users[0]}`, `report\0ttl-report-marker\0${users[0]}`]) {
      const markerId = createHash('sha256').update(rawId).digest('hex');
      const marker = await firestore.doc(`notificationDispatches/${markerId}`).get();
      const createdAt = marker.get('createdAt');
      const expireAt = marker.get('expireAt');
      assert.ok(createdAt instanceof Timestamp);
      assert.ok(expireAt instanceof Timestamp);
      assert.ok(Math.abs(expireAt.toMillis() - createdAt.toMillis() - 7 * 24 * 60 * 60 * 1000) < 1000);
    }
  });

  it('does not send or later replay an event that had no registered tokens', async () => {
    const { users, matchId } = await fixture();
    const sender = new RecordingSender();
    const dispatch = createNotificationDispatcher(new FirestoreNotificationStore(firestore), sender);
    const event = createdEvent(matchId, {
      eventId: 'message-without-tokens',
      type: 'message',
      senderUid: users[0],
    });

    await dispatch(event);
    await seedToken(users[1], `late-token-${randomUUID()}`);
    await dispatch(event);

    assert.equal(sender.messages.length, 0);
  });

  it('does not resend after an FCM failure because the recipient marker is already claimed', async () => {
    const { users, matchId } = await fixture();
    await seedToken(users[1], `failed-send-${randomUUID()}`);
    const sender = new RecordingSender();
    let attempts = 0;
    sender.sendEachForMulticast = async () => {
      attempts += 1;
      throw new Error('FCM unavailable');
    };
    const dispatch = createNotificationDispatcher(new FirestoreNotificationStore(firestore), sender);
    const event = createdEvent(matchId, {
      eventId: 'message-fcm-failure',
      type: 'message',
      senderUid: users[0],
    });

    await dispatch(event);
    await dispatch(event);

    assert.equal(attempts, 1);
  });

  it('prunes only invalid FCM tokens from the real Firestore token collection', async () => {
    const { users, matchId } = await fixture();
    const invalidToken = `invalid-token-${randomUUID()}`;
    const validToken = `valid-token-${randomUUID()}`;
    const invalidId = await seedToken(users[1], invalidToken);
    const validId = await seedToken(users[1], validToken);
    const sender = new RecordingSender();
    sender.response = (message) => ({
      responses: message.tokens.map((token) => ({
        success: token === validToken,
        ...(token === invalidToken && {
          error: { code: 'messaging/registration-token-not-registered' },
        }),
      })),
    });
    const dispatch = createNotificationDispatcher(new FirestoreNotificationStore(firestore), sender);

    await dispatch(createdEvent(matchId, {
      eventId: 'prune-invalid-token',
      type: 'message',
      senderUid: users[0],
    }));

    assert.equal((await firestore.doc(`users/${users[1]}/pushTokens/${invalidId}`).get()).exists, false);
    assert.equal((await firestore.doc(`users/${users[1]}/pushTokens/${validId}`).get()).exists, true);
  });

  it('caps total account fanout at the 20 most recently updated registrations', async () => {
    const { users, matchId } = await fixture();
    for (let index = 0; index < 25; index += 1) {
      await seedToken(users[1], `limited-token-${index}-${randomUUID()}`);
    }
    const expected = await firestore
      .collection(`users/${users[1]}/pushTokens`)
      .orderBy('updatedAt', 'desc')
      .limit(20)
      .get();
    const sender = new RecordingSender();
    const dispatch = createNotificationDispatcher(new FirestoreNotificationStore(firestore), sender);

    await dispatch(createdEvent(matchId, {
      eventId: 'chunked-message-event',
      type: 'message',
      senderUid: users[0],
    }));

    assert.equal(sender.messages.length, 1);
    assert.equal(sender.messages[0]?.tokens.length, 20);
    assert.deepEqual(
      sender.messages[0]?.tokens.toSorted(),
      expected.docs.map((document) => document.get('token')).toSorted(),
    );
  });

  it('chunks any larger adapter result into FCM calls of at most 500 tokens', async () => {
    const users = [`chunk-a-${randomUUID()}`, `chunk-b-${randomUUID()}`].sort() as [string, string];
    const registrations = Array.from({ length: 501 }, (_, index) => ({
      id: index.toString(16).padStart(64, '0'),
      token: `chunk-token-${index}`,
    }));
    const store: NotificationStore = {
      getMatchContext: async () => ({ users }),
      listPushTokens: async () => registrations,
      claimDispatch: async () => 'claimed',
      isDispatchAllowed: async () => true,
      deletePushToken: async () => undefined,
    };
    const sender = new RecordingSender();
    const dispatch = createNotificationDispatcher(store, sender);

    await dispatch(createdEvent(`${users[0]}_${users[1]}`, {
      eventId: 'chunked-with-larger-adapter-result',
      type: 'message',
      senderUid: users[0],
    }));

    assert.deepEqual(sender.messages.map((message) => message.tokens.length), [500, 1]);
  });
});

it('groups one recipient’s devices by locale, falls back for legacy tokens and prunes the right group', async () => {
  const { users, matchId } = await fixture();
  const pt = `bad-pt-${randomUUID()}`;
  const es = `es-${randomUUID()}`;
  const legacy = `legacy-${randomUUID()}`;
  const unsupported = `unsupported-${randomUUID()}`;
  for (const [token, locale] of [[pt, 'pt-BR'], [es, 'es-ES'], [legacy, null], [unsupported, 'zz-ZZ']] as const) {
    const id = await seedToken(users[0], token);
    if (locale) await firestore.doc(`users/${users[0]}/pushTokens/${id}`).update({ locale });
  }
  const sender = new RecordingSender();
  sender.response = (message) => ({ responses: message.tokens.map((token) => token === pt
    ? { success: false, error: { code: 'messaging/registration-token-not-registered' } }
    : { success: true }) });
  const dispatch = createNotificationDispatcher(new FirestoreNotificationStore(firestore), sender);
  await dispatch(createdEvent(matchId));
  assert.equal(sender.messages.length, 3);
  assert.equal(sender.messages.find((message) => message.tokens.includes(pt))?.notification?.title, 'Novo match');
  assert.equal(sender.messages.find((message) => message.tokens.includes(es))?.notification?.title, 'Nuevo match');
  const english = sender.messages.find((message) => message.tokens.includes(legacy));
  assert.equal(english?.notification?.title, 'New match');
  assert.ok(english?.tokens.includes(unsupported));
  assert.equal((await firestore.doc(`users/${users[0]}/pushTokens/${createHash('sha256').update(pt).digest('hex')}`).get()).exists, false);
  assert.equal((await firestore.doc(`users/${users[0]}/pushTokens/${createHash('sha256').update(es).digest('hex')}`).get()).exists, true);
  assert.equal(JSON.stringify(sender.messages).includes('Private Name'), false);
});

it('uses localized generic message copy without including the message body', async () => {
  const { users, matchId } = await fixture();
  const token = `pt-message-${randomUUID()}`;
  const id = await seedToken(users[1], token);
  await firestore.doc(`users/${users[1]}/pushTokens/${id}`).update({ locale: 'pt-BR' });
  const sender = new RecordingSender();
  await createNotificationDispatcher(new FirestoreNotificationStore(firestore), sender)(
    createdEvent(matchId, { type: 'message', senderUid: users[0], messageText: 'Private message body' }),
  );
  assert.equal(sender.messages[0]?.notification?.title, 'Nova mensagem');
  assert.equal(sender.messages[0]?.notification?.body, 'Você recebeu uma nova mensagem.');
  assert.equal(JSON.stringify(sender.messages).includes('Private message body'), false);
});

it('never sends twice to a token whose locale changes between locale groups', async () => {
  const { users, matchId } = await fixture();
  const moving = `moving-${randomUUID()}`;
  const fixed = `fixed-pt-${randomUUID()}`;
  const movingId = await seedToken(users[0], moving);
  const fixedId = await seedToken(users[0], fixed);
  await firestore.doc(`users/${users[0]}/pushTokens/${fixedId}`).update({ locale: 'pt-BR' });
  const sender = new RecordingSender();
  const send = sender.sendEachForMulticast.bind(sender);
  sender.sendEachForMulticast = async (message) => {
    const result = await send(message);
    if (message.tokens.includes(moving)) {
      await firestore.doc(`users/${users[0]}/pushTokens/${movingId}`).update({ locale: 'pt-BR' });
    }
    return result;
  };
  await createNotificationDispatcher(new FirestoreNotificationStore(firestore), sender)(createdEvent(matchId));
  assert.equal(sender.messages.flatMap((message) => message.tokens).filter((token) => token === moving).length, 1);
  assert.equal(sender.messages.flatMap((message) => message.tokens).filter((token) => token === fixed).length, 1);
});
