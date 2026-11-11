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
