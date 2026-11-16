/** Ignore stale CloudEvents so TTL cleanup cannot make retried events send again. */
export function isEventOlderThan(eventTime: string | undefined, days: number, now = Date.now()): boolean {
  if (typeof eventTime !== 'string') return false;
  const timestamp = Date.parse(eventTime);
  if (!Number.isFinite(timestamp)) return false;
  return now - timestamp > days * 24 * 60 * 60 * 1000;
}
