import { getApp, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { getStorage } from 'firebase-admin/storage';
import { logger } from 'firebase-functions';
import * as functions from 'firebase-functions/v1';
import { onCall } from 'firebase-functions/v2/https';
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

// Cravos admin callables (docs/gamification/admin.md). App Check is enforced on the
// platform side (enforceAppCheck: true) and gamAdminActor checks auth + the gamAdmin
// custom claim; every write appends to gamAudit.
import { gamAdminActor, type GamAdminActor } from './gamification/admin/guard';
import { gamFlags } from './gamification/admin/flags';
import { adjustmentAppend, adjustmentApprove, ledgerLookup } from './gamification/admin/ledger';
import {
  approvePublish,
  approveRollback,
  auditList,
  createDraft,
  getRuleSet,
  listRuleSets,
  requestPublish,
  requestRollback,
  updateDraft,
} from './gamification/admin/rulesets';
import { simulateFromStore } from './gamification/admin/simulate';

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
// ---------------------------------------------------------------------------
// Cravos admin callables (spec §9; docs/gamification/admin.md). Every callable: App Check
// enforced (invalid tokens are rejected before the handler), auth + gamAdmin claim, and
// every write appends to gamAudit.
// ---------------------------------------------------------------------------

const GAM_ADMIN_CALLABLE_OPTIONS = { region: DATABASE_REGION, enforceAppCheck: true } as const;

/** Wraps a Cravos admin handler: one auth gate, one Firestore, region + App Check. */
function gamAdminCallable<Return>(
  handler: (firestore: Firestore, actor: GamAdminActor, data: unknown) => Promise<Return>,
) {
  return onCall(GAM_ADMIN_CALLABLE_OPTIONS, async (request) => {
    const actor = gamAdminActor(request.auth);
    return handler(getFirestore(app), actor, request.data);
  });
}

export const gamListRuleSets = gamAdminCallable(listRuleSets);
export const gamGetRuleSet = gamAdminCallable(getRuleSet);
export const gamCreateDraft = gamAdminCallable(createDraft);
export const gamUpdateDraft = gamAdminCallable(updateDraft);
export const gamRequestPublish = gamAdminCallable(requestPublish);
export const gamApprovePublish = gamAdminCallable(approvePublish);
export const gamRequestRollback = gamAdminCallable(requestRollback);
export const gamApproveRollback = gamAdminCallable(approveRollback);
export const gamSimulate = gamAdminCallable(simulateFromStore);
export const gamLedgerLookup = gamAdminCallable(ledgerLookup);
export const gamAdjustmentAppend = gamAdminCallable(adjustmentAppend);
export const gamAdjustmentApprove = gamAdminCallable(adjustmentApprove);
export const gamAuditList = gamAdminCallable(auditList);

export const gamGetFlags = onCall(GAM_ADMIN_CALLABLE_OPTIONS, async (request) => {
  gamAdminActor(request.auth);
  return gamFlags(getApp());
});
