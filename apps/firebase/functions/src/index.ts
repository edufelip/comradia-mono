import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { getStorage } from 'firebase-admin/storage';
import { logger } from 'firebase-functions';
import * as functions from 'firebase-functions/v1';
import { onDocumentCreated, onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { onObjectFinalized } from 'firebase-functions/v2/storage';
import {
  createNotificationDispatcher,
  FirestoreNotificationStore,
  type CreatedNotificationEvent,
} from './notification-handler';

import { cleanupDeletedMatch } from './match-cleanup';
import { cleanupDeletedAccount, FirebaseAccountCleanupStore } from './account-cleanup';
import { isEventOlderThan } from './event-age';
import { enforcePhotoCap, FirebasePhotoCapStore } from './photo-cap';
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
    if (!event.data || isEventOlderThan(event.time, 6)) return;
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
    if (!event.data || isEventOlderThan(event.time, 6)) return;
    const input: CreatedNotificationEvent = {
      eventId: event.id,
      type: 'message',
      matchId: event.params.matchId,
      senderUid: event.data.get('from'),
    };
    await dispatch(input);
  },
);

export const cleanupOnAuthUserDeleted = functions
  .runWith({ failurePolicy: true })
  .region(DATABASE_REGION)
  .auth.user()
  .onDelete(async (user) => {
    await cleanupDeletedAccount(
      user.uid,
      new FirebaseAccountCleanupStore(getFirestore(app), getStorage(app).bucket()),
    );
  });

export const enforceProfilePhotoCap = onObjectFinalized(
  {
    region: 'us-east1',
    retry: true,
    minInstances: 0,
    maxInstances: 2,
  },
  async (event) => {
    if (isEventOlderThan(event.time, 6)) return;
    const name = event.data.name;
    const uid = typeof name === 'string' ? /^photos\/([^/]+)\/[^/]+$/.exec(name)?.[1] : undefined;
    if (!uid) return;
    await enforcePhotoCap(
      uid,
      name,
      event.data.contentType,
      new FirebasePhotoCapStore(getFirestore(app), getStorage(app).bucket()),
    );
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

export {
  gamCloseWeek,
  gamOnBlockCreated,
  gamOnMatchCreated,
  gamOnMatchDeleted,
  gamOnMessageCreated,
  gamOnProfileWritten,
  gamOnReportWritten,
} from './gamification/engine/functions';
