import type { GamCelebration } from './model';
import type { GamDocument } from '@/services/gamification/types';

type Celebration = GamDocument<GamCelebration>;
const MERGE_MS = 2000;

export function pointToast(incoming: Celebration[], handled: ReadonlySet<string>) {
  const available = incoming.filter(({ id, kind }) => kind === 'toast' && !handled.has(id));
  const first = available.at(-1);
  if (first === undefined) return [];
  const firstAt = first.createdAt?.toMillis();
  if (first.amount === undefined || firstAt === undefined) return [first];
  return available.filter(
    (event) =>
      event.copyKey === first.copyKey &&
      event.amount !== undefined &&
      Math.abs((event.createdAt?.toMillis() ?? Infinity) - firstAt) <= MERGE_MS,
  );
}
