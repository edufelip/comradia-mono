// Levels from lifetime net Cravos (spec §5): computed from a high-water mark, so they
// never drop. Pure helpers, mirrored in apps/firebase/functions/src/gamification/.

import { GAM_LEVELS, type GamLevel, type GamLevelId } from './model';

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

/** The next level to show progress toward ("1.240 de 2.500 para Jardim"), or null at the top. */
export function nextLevelFor(lifetimeNet: number): GamLevel | null {
  return GAM_LEVELS.find((level) => level.threshold > lifetimeNet) ?? null;
}
