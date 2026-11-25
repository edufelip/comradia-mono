// Calendar math for the Cravos engine. Weeks run Monday 00:00 to Sunday 23:59 in
// the rule set's timezone (spec §6: America/Sao_Paulo). All functions are pure so
// the tests can pin them without the emulator.

const WEEKDAY_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

function parts(ms: number, timeZone: string, options: Intl.DateTimeFormatOptions): string[] {
  return new Intl.DateTimeFormat('en-US', { timeZone, ...options }).format(new Date(ms)).split('/');
}

/** YYYY-MM-DD of the instant in the zone (en-CA gives ISO-shaped dates). */
export function isoDateInZone(ms: number, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms));
}

/** Hour (0–23) and weekday name of the instant in the zone. */
export function hourAndWeekdayInZone(ms: number, timeZone: string): { hour: number; weekday: string } {
  const [weekday] = parts(ms, timeZone, { weekday: 'short' });
  const [hour] = parts(ms, timeZone, { hour: 'numeric', hour12: false });
  return { hour: Number(hour) % 24, weekday: weekday ?? '' };
}

function utcMidnight(isoDate: string): number {
  const [year, month, day] = isoDate.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

/** Days between two ISO dates (b - a), ignoring zones (both are zone-local). */
export function daysBetweenIsoDates(a: string, b: string): number {
  return Math.round((utcMidnight(b) - utcMidnight(a)) / 86_400_000);
}

function addIsoDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return isoDateInZone(shifted.getTime(), 'UTC');
}

/** The YYYY-MM-DD of the Monday that starts the week containing `ms` in the zone. */
export function weekStartOf(ms: number, timeZone: string): string {
  const today = isoDateInZone(ms, timeZone);
  const [weekday] = parts(ms, timeZone, { weekday: 'short' });
  const index = WEEKDAY_EN.indexOf((weekday ?? '') as (typeof WEEKDAY_EN)[number]);
  if (index < 0) throw new Error(`Could not read the weekday for ${today}`);
  // Monday-based: Monday..Sunday map back 0..6 days.
  const back = (index + 6) % 7;
  return back === 0 ? today : addIsoDays(today, -back);
}

/** The week that ended at the last Sunday 23:59 before `ms` (the week a Monday-03:00 close run settles). */
export function lastClosedWeekStart(ms: number, timeZone: string): string {
  return addIsoDays(weekStartOf(ms, timeZone), -7);
}

/** A Monday-00:00 instant (UTC ms) for an ISO week start in the zone. */
export function weekStartInstant(isoWeek: string, timeZone: string): number {
  const guess = utcMidnight(isoWeek);
  // Hour 00 in the zone is at most a day away from UTC midnight; scan back to the
  // instant whose zone-local date is exactly the wanted Monday at hour 0.
  for (let offset = -86_400_000; offset <= 86_400_000; offset += 3_600_000) {
    const candidate = guess + offset;
    const { hour } = hourAndWeekdayInZone(candidate, timeZone);
    if (hour === 0 && isoDateInZone(candidate, timeZone) === isoWeek) return candidate;
  }
  throw new Error(`No local midnight found for week ${isoWeek} in ${timeZone}`);
}

/** True when the whole day `isoWeek`-based week [weekStart, weekStart+7d) lies inside [from, until] (ISO dates). */
export function weekCoveredByPause(weekStart: string, fromIso: string, untilIso: string): boolean {
  return fromIso <= weekStart && addIsoDays(weekStart, 6) <= untilIso;
}
