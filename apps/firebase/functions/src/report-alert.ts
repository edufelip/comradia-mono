import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { logger } from 'firebase-functions';
import { defineList } from 'firebase-functions/params';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import {
  FirestoreNotificationStore,
  isInvalidTokenError,
  MAX_TOKENS_PER_FCM_CALL,
  type FcmSender,
  type FcmSendResult,
  type PushTokenRegistration,
} from './notification-handler';
import { reportAlertMessage, reportAlertRecipients } from './report-alert-logic';

/** Comma-separated Firebase Auth uids. Set per project in functions/.env.<projectId>. */
const REPORT_ALERT_UIDS = defineList('REPORT_ALERT_UIDS', { default: [] });

export interface ReportAlertStore {
  listPushTokens(uid: string): Promise<PushTokenRegistration[]>;
  claimReportAlert(reportId: string, recipientUid: string): Promise<boolean>;
  deletePushToken(uid: string, tokenId: string): Promise<void>;
}

export interface ReportAlertDependencies {
  store: ReportAlertStore;
  sender: FcmSender;
  alertUids: readonly string[];
  onSendFailure?: () => void;
}

export interface ReportAlertInput {
  reportId: string;
  reporter: unknown;
  reason: unknown;
}

export async function sendReportAlert(report: ReportAlertInput, deps: ReportAlertDependencies): Promise<void> {
  const message = reportAlertMessage(report.reportId, report.reason);
  for (const uid of reportAlertRecipients(deps.alertUids, report.reporter)) {
    // Claimed before the FCM call so a retried trigger never alerts twice (same tradeoff as matches).
    if (!await deps.store.claimReportAlert(report.reportId, uid)) continue;

    const tokens = await deps.store.listPushTokens(uid);
    for (let start = 0; start < tokens.length; start += MAX_TOKENS_PER_FCM_CALL) {
      const chunk = tokens.slice(start, start + MAX_TOKENS_PER_FCM_CALL);
      let result: FcmSendResult;
      try {
        result = await deps.sender.sendEachForMulticast({ ...message, tokens: chunk.map(({ token }) => token) });
      } catch {
        deps.onSendFailure?.();
        continue;
      }
      const invalid = chunk.filter((_, index) => isInvalidTokenError(result.responses[index]?.error?.code));
      await Promise.allSettled(invalid.map(({ id }) => deps.store.deletePushToken(uid, id)));
    }
  }
}

export const notifyOnReportCreated = onDocumentCreated(
  {
    document: 'reports/{reportId}',
    region: 'southamerica-east1',
    retry: true,
    minInstances: 0,
    maxInstances: 2,
  },
  async (event) => {
    if (!event.data) return;
    // defineList().value() throws when the variable is absent, so check for it first.
    const alertUids = process.env.REPORT_ALERT_UIDS === undefined ? [] : REPORT_ALERT_UIDS.value();
    if (alertUids.length === 0) {
      logger.info('Report alert skipped: REPORT_ALERT_UIDS is empty.');
      return;
    }
    const reportId = event.params.reportId;
    await sendReportAlert(
      { reportId, reporter: event.data.get('reporter'), reason: event.data.get('reason') },
      {
        store: new FirestoreNotificationStore(getFirestore()),
        sender: getMessaging(),
        alertUids,
        onSendFailure: () => logger.error('FCM send failed for report alert after claim', { reportId }),
      },
    );
  },
);
