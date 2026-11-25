// Velocity alerts (spec §11): owners get one push per member per day per check,
// the same way report alerts reach them. The thresholds are integrity constants
// from the spec, not rule-set values: no earning rule may move them.

export type VelocityKind = 'daily_earn' | 'conversations_started';

/** 3x the engaged daily mean (600 Cravos / 30 days = 20). */
export const DAILY_EARN_ALERT_THRESHOLD = 60;
/** "starts over 5 conversations in a day". */
export const CONVERSATIONS_STARTED_ALERT_THRESHOLD = 5;

export function velocityBreaches(
  dailyEarnTotal: number,
  conversationsStartedToday: number,
): VelocityKind[] {
  const breaches: VelocityKind[] = [];
  if (dailyEarnTotal > DAILY_EARN_ALERT_THRESHOLD) breaches.push('daily_earn');
  if (conversationsStartedToday > CONVERSATIONS_STARTED_ALERT_THRESHOLD) {
    breaches.push('conversations_started');
  }
  return breaches;
}

/** Generic lock-screen copy: which check fired, never who or how much. */
export function velocityAlertBody(kind: VelocityKind): string {
  return kind === 'daily_earn'
    ? 'A member earned over 3x the engaged daily mean today.'
    : 'A member started over 5 conversations today.';
}
