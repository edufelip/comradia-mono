import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { after, describe, it } from 'node:test';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { MulticastMessage } from 'firebase-admin/messaging';
import { FirestoreNotificationStore, type FcmSender, type FcmSendResult } from '../src/notification-handler.js';
import { sendReportAlert } from '../src/report-alert.js';

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
if (!emulatorHost || !['127.0.0.1', 'localhost', '::1'].includes(emulatorHost.split(':')[0] ?? '')) {
  throw new Error('Functions integration tests require a local FIRESTORE_EMULATOR_HOST.');
}

const app = initializeApp({ projectId: 'demo-comradia' }, `report-alert-tests-${randomUUID()}`);
const firestore = getFirestore(app);

after(async () => {
  await deleteApp(app);
});

class RecordingSender implements FcmSender {
  readonly messages: MulticastMessage[] = [];

  async sendEachForMulticast(message: MulticastMessage): Promise<FcmSendResult> {
    this.messages.push(structuredClone(message));
    return { responses: message.tokens.map(() => ({ success: true })) };
  }
}

async function seedToken(uid: string, token: string) {
  const id = createHash('sha256').update(token).digest('hex');
  await firestore.doc(`users/${uid}/pushTokens/${id}`).set({
    token,
    platform: 'android',
    updatedAt: new Date(),
  });
}

const uniqueUid = (label: string) => `${label}-${randomUUID().replaceAll('-', '')}`;

describe('report owner alert', () => {
  it('sends to every listed owner with a generic payload and no details or names', async () => {
    const reporter = uniqueUid('reporter');
    const ownerA = uniqueUid('owner');
    const ownerB = uniqueUid('owner');
    const detailsText = `details-${randomUUID()}`;
    const reportId = `report-owner-alert-${randomUUID()}`;
    await seedToken(ownerA, `owner-a-token-${randomUUID()}`);
    await seedToken(ownerB, `owner-b-token-${randomUUID()}`);
    await firestore.doc(`reports/${randomUUID()}`).set({ reporter, target: 'someone', reason: 'spam', details: detailsText });
    const sender = new RecordingSender();

    await sendReportAlert(
      { reportId, reporter, reason: 'spam' },
      { store: new FirestoreNotificationStore(firestore), sender, alertUids: [ownerA, ownerB] },
    );

    assert.equal(sender.messages.length, 2);
    for (const message of sender.messages) {
      assert.equal(message.notification?.title, 'New report');
      assert.equal(message.notification?.body, 'Reason: spam');
      assert.deepEqual(message.data, { type: 'report', reportId });
      assert.equal(message.android?.notification?.channelId, 'matches-messages');
      const serialized = JSON.stringify(message);
      assert.equal(serialized.includes(detailsText), false);
      assert.equal(serialized.includes(reporter), false);
      assert.equal(serialized.includes(ownerA), false);
    }
  });

  it('skips the reporter even when the reporter is in the alert list', async () => {
    const reporter = uniqueUid('reporter');
    const owner = uniqueUid('owner');
    await seedToken(reporter, `reporter-token-${randomUUID()}`);
    await seedToken(owner, `owner-token-${randomUUID()}`);
    const sender = new RecordingSender();

    await sendReportAlert(
      { reportId: `report-skip-reporter-${randomUUID()}`, reporter, reason: 'hate' },
      { store: new FirestoreNotificationStore(firestore), sender, alertUids: [reporter, owner] },
    );

    assert.equal(sender.messages.length, 1);
    assert.equal(sender.messages[0]?.notification?.body, 'Reason: hate');
  });

  it('sends nothing when the list is empty', async () => {
    const reporter = uniqueUid('reporter');
    await seedToken(uniqueUid('owner'), `unlisted-token-${randomUUID()}`);
    const sender = new RecordingSender();

    await sendReportAlert(
      { reportId: `report-empty-list-${randomUUID()}`, reporter, reason: 'fake' },
      { store: new FirestoreNotificationStore(firestore), sender, alertUids: [] },
    );

    assert.equal(sender.messages.length, 0);
  });

  it('alerts once per report when the trigger is retried', async () => {
    const reporter = uniqueUid('reporter');
    const owner = uniqueUid('owner');
    await seedToken(owner, `retry-token-${randomUUID()}`);
    const sender = new RecordingSender();
    const deps = { store: new FirestoreNotificationStore(firestore), sender, alertUids: [owner] };
    const report = { reportId: `report-retry-${randomUUID()}`, reporter, reason: 'underage' };

    await sendReportAlert(report, deps);
    await sendReportAlert(report, deps);

    assert.equal(sender.messages.length, 1);
  });
});
