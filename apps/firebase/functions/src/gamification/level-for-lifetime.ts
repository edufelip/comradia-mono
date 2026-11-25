// Mirror of apps/mobile/features/gamification/level-for-lifetime.ts: the engine also
// derives levels from the lifetime high-water mark. The parity test runs both copies
// over the same values.

import { GAM_LEVELS, type GamLevel, type GamLevelId, type GamLevelRule } from './model';

/** The new high-water mark: it only rises, so a clawback never demotes a level. */
export function highWaterMark(previous: number, lifetimeNet: number): number {
  return Math.max(previous, lifetimeNet);
}

/** The level a member is on: the highest one whose threshold the mark has reached. */
export function levelForHighWaterMark(mark: number): GamLevelId {
  let level: GamLevelId = GAM_LEVELS[0].id;
  for (const candidate of GAM_LEVELS) {
    if (mark >= candidate.threshold) level = candidate.id;
  }
  return level;
}

/** The next level to show progress toward, or null at the top. */
export function nextLevelFor(lifetimeNet: number): GamLevel | null {
  return GAM_LEVELS.find((level) => level.threshold > lifetimeNet) ?? null;
}

/** Evaluate a published ladder without taking away an already reached level. */
export function levelFromRules(mark: number, previous: GamLevelId, levels: readonly GamLevelRule[]): GamLevelId {
  const previousIndex = levels.findIndex(({ id }) => id === previous);
  let index = Math.max(0, previousIndex);
  for (let next = index + 1; next < levels.length; next += 1) {
    if (levels[next].threshold <= mark) index = next;
  }
  return levels[index]?.id ?? previous;
}
