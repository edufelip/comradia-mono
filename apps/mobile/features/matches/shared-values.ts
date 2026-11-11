import type { ValueId } from '@/features/profile/profile-schema';

/**
 * The values both cards list, in the order the signed-in person chose them (S8 and S10
 * show what a pair has in common before any message is written).
 */
export function sharedValues(
  mine: readonly ValueId[] | undefined,
  theirs: readonly ValueId[],
): ValueId[] {
  if (!mine) return [];
  return mine.filter((value) => theirs.includes(value));
}
