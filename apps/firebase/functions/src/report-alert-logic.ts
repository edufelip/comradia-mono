import type { MulticastMessage } from 'firebase-admin/messaging';

// Mirrors `ReportReason` in apps/mobile/services/backend/types.ts and `firestore.rules`.
const REPORT_REASONS = new Set(['harassment', 'hate', 'fake', 'spam', 'underage', 'other']);

/** Owner uids to alert, trimmed and deduplicated, without the person who filed the report. */
export function reportAlertRecipients(alertUids: readonly string[], reporterUid: unknown): string[] {
  const uids = new Set(alertUids.map((uid) => uid.trim()).filter((uid) => uid.length > 0));
  return [...uids].filter((uid) => uid !== reporterUid);
}

/**
 * Owner-only alert. Lock screens are visible to others, so only the fixed reason label is shown.
 * Free-text details, names and uids never go into the payload.
 */
export function reportAlertMessage(reportId: string, reason: unknown): Omit<MulticastMessage, 'tokens'> {
  const label = typeof reason === 'string' && REPORT_REASONS.has(reason) ? reason : 'unknown';
  return {
    notification: { title: 'New report', body: `Reason: ${label}` },
    data: { type: 'report', reportId },
    android: { notification: { channelId: 'matches-messages' } },
    apns: { payload: { aps: { sound: 'default' } } },
  };
}
