import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { logger } from 'firebase-functions';
import { onDocumentCreated, onDocumentDeleted } from 'firebase-functions/v2/firestore';
import {
  createNotificationDispatcher,
  FirestoreNotificationStore,
  type CreatedNotificationEvent,
} from './notification-handler';

import { cleanupDeletedMatch } from './match-cleanup';
export { notifyOnReportCreated } from './report-alert';

const DATABASE_REGION = 'southamerica-east1';
const app = initializeApp();
const dispatch = createNotificationDispatcher(
  new FirestoreNotificationStore(getFirestore(app)),
  getMessaging(app),
  (type) => logger.error('FCM send failed after notification claim', { type }),
);

export const notifyOnMatchCreated = onDocumentCreated(
  {
    document: 'matches/{matchId}',
    region: DATABASE_REGION,
    retry: true,
    minInstances: 0,
    maxInstances: 2,
  },
  async (event) => {
    if (!event.data) return;
    const input: CreatedNotificationEvent = {
      eventId: event.id,
      type: 'match',
      matchId: event.params.matchId,
    };
    await dispatch(input);
  },
);

export const notifyOnMessageCreated = onDocumentCreated(
  {
    document: 'matches/{matchId}/messages/{messageId}',
    region: DATABASE_REGION,
    retry: true,
    minInstances: 0,
    maxInstances: 2,
  },
  async (event) => {
    if (!event.data) return;
    const input: CreatedNotificationEvent = {
      eventId: event.id,
      type: 'message',
      matchId: event.params.matchId,
      senderUid: event.data.get('from'),
    };
    await dispatch(input);
  },
);

export const cleanupOnMatchDeleted = onDocumentDeleted(
  {
    document: 'matches/{matchId}',
    region: DATABASE_REGION,
    retry: true,
    minInstances: 0,
    maxInstances: 2,
  },
  async (event) => {
    if (!event.data) return;
    await cleanupDeletedMatch(getFirestore(app), event.params.matchId, event.data.get('users'));
  },
);
