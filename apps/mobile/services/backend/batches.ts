/**
 * Firestore allows at most 500 writes per batch. Account deletion writes in bulk, so keep
 * a margin below the limit.
 */
export const DELETE_BATCH_SIZE = 450;

/** Splits `items` into consecutive groups of at most `size` items (empty input → no groups). */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (!Number.isInteger(size) || size < 1) throw new RangeError('size must be a positive integer');
  const groups: T[][] = [];
  for (let start = 0; start < items.length; start += size) {
    groups.push(items.slice(start, start + size));
  }
  return groups;
}
