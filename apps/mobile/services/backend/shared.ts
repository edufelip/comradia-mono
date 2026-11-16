import type { DiscoveryProfile, PublicProfile } from '@/features/profile/profile-schema';

const PROFILE_KEYS = [
  'displayName',
  'age',
  'vibe',
  'lookingFor',
  'unionMember',
  'union',
  'values',
  'promptId',
  'promptAnswer',
] as const;

/** Keeps only the public card fields (drops Firestore timestamps). */
export function toPublicProfile(data: Record<string, unknown>): PublicProfile {
  const out: Record<string, unknown> = {};
  for (const key of PROFILE_KEYS) out[key] = data[key];
  // Profiles written before photos existed have no `photoPath`.
  out.photoPath = typeof data.photoPath === 'string' ? data.photoPath : null;
  return out as PublicProfile;
}

/** Discovery shows everyone except me and anyone I already swiped. */
export function filterDiscovery(
  uid: string,
  docs: { id: string; data: Record<string, unknown> }[],
  swipedIds: Set<string>,
): DiscoveryProfile[] {
  return docs
    .filter((d) => d.id !== uid && !swipedIds.has(d.id))
    .map((d) => ({ id: d.id, ...toPublicProfile(d.data) }));
}

/** Fetches enough oldest-first pages to fill one visible deck, with a hard request cap. */
/**
 * Pages profiles oldest-first until the deck fills. `resume` is the cursor after the last page
 * that held nothing new (everything swiped), so the next load can start there instead of at
 * the oldest profile again.
 */
export async function collectDiscoveryCandidates(
  uid: string,
  pageSize: number,
  maxPages: number,
  fetchPage: (cursor: unknown) => Promise<{
    docs: { id: string; data: Record<string, unknown> }[];
    cursor: unknown;
  }>,
  fetchSwipedIds: (ids: string[]) => Promise<Set<string>>,
  start?: unknown,
): Promise<{ candidates: DiscoveryProfile[]; resume: unknown }> {
  const candidates: DiscoveryProfile[] = [];
  let cursor = start;
  let resume = start;
  for (let page = 0; page < maxPages && candidates.length < pageSize; page += 1) {
    const result = await fetchPage(cursor);
    if (result.docs.length === 0) break;
    const swiped = await fetchSwipedIds(result.docs.map((doc) => doc.id));
    candidates.push(...filterDiscovery(uid, result.docs, swiped));
    cursor = result.cursor;
    // shortcut: an unswiped profile hidden by a block holds the cursor at its page; the
    // 5-page scan still reaches past it.
    if (candidates.length === 0) resume = cursor;
    if (result.docs.length < pageSize) break;
  }
  return { candidates: candidates.slice(0, pageSize), resume };
}

/** Runs bounded async work without starting every task at once. */
export async function mapWithConcurrency<T>(
  values: readonly T[],
  concurrency: number,
  task: (value: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (next < values.length) {
      const index = next++;
      await task(values[index]);
    }
  });
  await Promise.all(workers);
}

/** Returns one cached profile request per uid for the lifetime of the adapter session. */
export function cachedProfile<T>(
  cache: Map<string, Promise<T | null>>,
  uid: string,
  read: () => Promise<T | null>,
): Promise<T | null> {
  const cached = cache.get(uid);
  if (cached) return cached;
  const request = read().catch((error: unknown) => {
    const code = (error as { code?: unknown } | null)?.code;
    if (code === 'permission-denied' || code === 'firestore/permission-denied') return null;
    cache.delete(uid);
    throw error;
  });
  cache.set(uid, request);
  return request;
}

/** Removes cached partner cards for matches no longer present in a live snapshot. */
export function invalidateDisappearedProfiles<T>(
  cache: Map<string, T>,
  previousIds: ReadonlySet<string>,
  currentIds: ReadonlySet<string>,
): void {
  for (const uid of previousIds) if (!currentIds.has(uid)) cache.delete(uid);
}

/** Processes a query in fixed-size pages while preserving the caller's page order. */
export async function processQueryPages<T>(
  pageSize: number,
  fetchPage: (cursor: unknown) => Promise<{
    items: T[];
    cursor: unknown;
  }>,
  processPage: (items: T[]) => Promise<void>,
): Promise<void> {
  let cursor: unknown;
  while (true) {
    const page = await fetchPage(cursor);
    if (page.items.length === 0) return;
    await processPage(page.items);
    if (page.items.length < pageSize || page.cursor === undefined) return;
    cursor = page.cursor;
  }
}

export const MESSAGE_MAX = 1000;
export const MESSAGE_PAGE_SIZE = 200;

/** One id per pair, whoever liked first: the two uids sorted and joined by `_`. */
export function matchIdFor(a: string, b: string): string {
  return a < b ? `${a}_${b}` : `${b}_${a}`;
}

/** Stable create-only report id; one reporter can report a target once. */
export function reportIdFor(reporterUid: string, targetUid: string): string {
  return `${reporterUid}_${targetUid}`;
}

/** Repairs mutual likes independently so one stale or blocked pair cannot abort the rest. */
export async function reconcileLikePairs(
  targetIds: readonly string[],
  likedByIds: ReadonlySet<string>,
  blockedUids: ReadonlySet<string>,
  ensureMatch: (targetUid: string) => Promise<void>,
): Promise<void> {
  for (const targetUid of targetIds) {
    if (!likedByIds.has(targetUid) || blockedUids.has(targetUid)) continue;
    try {
      await ensureMatch(targetUid);
    } catch {
      // Continue after a stale pair or concurrent match creation.
    }
  }
}

/** The uid in a match id that is not `uid`. */
export function otherUid(matchId: string, uid: string): string {
  const [a, b] = matchId.split('_');
  return a === uid ? b : a;
}
