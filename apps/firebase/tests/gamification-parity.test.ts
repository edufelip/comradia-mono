import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  GAM_ACHIEVEMENTS,
  GAM_ACHIEVEMENT_KINDS,
  GAM_CELEBRATION_KINDS,
  GAM_EARN_EVENTS,
  GAM_LEDGER_KINDS,
  GAM_LEVELS,
} from '../../mobile/features/gamification/model';
import {
  highWaterMark,
  levelForHighWaterMark,
  nextLevelFor,
} from '../../mobile/features/gamification/level-for-lifetime';
import {
  GAM_ACHIEVEMENTS as SERVER_ACHIEVEMENTS,
  GAM_ACHIEVEMENT_KINDS as SERVER_ACHIEVEMENT_KINDS,
  GAM_CELEBRATION_KINDS as SERVER_CELEBRATION_KINDS,
  GAM_EARN_EVENTS as SERVER_EARN_EVENTS,
  GAM_LEDGER_KINDS as SERVER_LEDGER_KINDS,
  GAM_LEVELS as SERVER_LEVELS,
} from '../functions/src/gamification/model';
import {
  highWaterMark as engineHighWaterMark,
  levelForHighWaterMark as engineLevelForHighWaterMark,
  nextLevelFor as engineNextLevelFor,
} from '../functions/src/gamification/level-for-lifetime';

/**
 * The engine deploys without the mobile app, so apps/firebase/functions/src/gamification
 * duplicates the contract in apps/mobile/features/gamification. This test, in the spirit
 * of schema-parity.test.ts, keeps the two copies equal.
 */
describe('gamification contract parity between mobile and functions', () => {
  it('lists the same ledger kinds in the same order', () => {
    assert.deepEqual(SERVER_LEDGER_KINDS, GAM_LEDGER_KINDS);
  });

  it('lists the same earn events in the same order', () => {
    assert.deepEqual(SERVER_EARN_EVENTS, GAM_EARN_EVENTS);
  });

  it('lists the same celebration kinds', () => {
    assert.deepEqual(SERVER_CELEBRATION_KINDS, GAM_CELEBRATION_KINDS);
  });

  it('keeps the same level ladder, ids and thresholds', () => {
    assert.deepEqual([...SERVER_LEVELS], [...GAM_LEVELS]);
  });

  it('lists the same achievement kinds and catalog', () => {
    assert.deepEqual(SERVER_ACHIEVEMENT_KINDS, GAM_ACHIEVEMENT_KINDS);
    assert.deepEqual([...SERVER_ACHIEVEMENTS], [...GAM_ACHIEVEMENTS]);
  });
});

describe('level helpers agree between mobile and functions', () => {
  const marks = [-100, 0, 1, 299, 300, 999, 1000, 2499, 2500, 4999, 5000, 12500];

  it('derives the same level and next level for every mark', () => {
    for (const mark of marks) {
      assert.equal(engineLevelForHighWaterMark(mark), levelForHighWaterMark(mark));
      assert.deepEqual(engineNextLevelFor(mark) ?? null, nextLevelFor(mark) ?? null);
    }
  });

  it('keeps the high-water mark equally on both sides', () => {
    const pairs: Array<[number, number]> = [
      [0, 300],
      [2500, -40],
      [120, 120],
    ];
    for (const [previous, lifetimeNet] of pairs) {
      assert.equal(engineHighWaterMark(previous, lifetimeNet), highWaterMark(previous, lifetimeNet));
    }
  });
});
