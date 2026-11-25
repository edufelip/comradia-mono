import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Timestamp } from 'firebase-admin/firestore';
import type { GamLot } from '../src/gamification/model.js';
import { EXPIRY_NOTICE_DAYS, expiryNoticeDue, lotsToExpire } from '../src/gamification/redemption/expiry.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW_MS = 100 * DAY_MS;
const now = Timestamp.fromMillis(NOW_MS);

function lot(overrides: Partial<GamLot> = {}): GamLot {
  return {
    amount: 30,
    earnedAt: Timestamp.fromMillis(NOW_MS - 30 * DAY_MS),
    expiresAt: Timestamp.fromMillis(NOW_MS + 300 * DAY_MS),
    sourceLedgerId: 'conversation_started:ab12_cd34:ab12',
    noticeAt: null,
    ...overrides,
  };
}

describe('lotsToExpire', () => {
  it('returns only lots past expiry that still hold Cravos, oldest first', () => {
    const first = lot({ amount: 10, expiresAt: Timestamp.fromMillis(NOW_MS - 2 * DAY_MS) });
    const second = lot({ amount: 5, expiresAt: Timestamp.fromMillis(NOW_MS - DAY_MS) });
    const future = lot({ amount: 40, expiresAt: Timestamp.fromMillis(NOW_MS + DAY_MS) });
    assert.deepEqual(lotsToExpire([future, second, first], now), [first, second]);
  });

  it('skips spent tombstones and unexpired lots', () => {
    const tombstone = lot({ amount: 0, expiresAt: Timestamp.fromMillis(NOW_MS - DAY_MS) });
    const future = lot({ amount: 40, expiresAt: Timestamp.fromMillis(NOW_MS + DAY_MS) });
    assert.deepEqual(lotsToExpire([tombstone, future], now), []);
  });

  it('includes a lot expiring exactly now', () => {
    const edge = lot({ expiresAt: Timestamp.fromMillis(NOW_MS) });
    assert.deepEqual(lotsToExpire([edge], now), [edge]);
  });
});

describe('expiryNoticeDue', () => {
  it('returns unexpired lots inside the window that were never noticed', () => {
    const due = lot({ expiresAt: Timestamp.fromMillis(NOW_MS + 29 * DAY_MS) });
    const farOut = lot({ expiresAt: Timestamp.fromMillis(NOW_MS + 31 * DAY_MS) });
    const noticed = lot({ expiresAt: Timestamp.fromMillis(NOW_MS + 5 * DAY_MS), noticeAt: Timestamp.fromMillis(NOW_MS - DAY_MS) });
    assert.deepEqual(expiryNoticeDue([due, farOut, noticed], now), [due]);
  });

  it('skips spent tombstones and already-expired lots', () => {
    const tombstone = lot({ amount: 0, expiresAt: Timestamp.fromMillis(NOW_MS + 5 * DAY_MS) });
    const expired = lot({ expiresAt: Timestamp.fromMillis(NOW_MS - DAY_MS) });
    assert.deepEqual(expiryNoticeDue([tombstone, expired], now), []);
  });

  it(`includes a lot exactly ${EXPIRY_NOTICE_DAYS} days out, but not one expiring now`, () => {
    const edge = lot({ expiresAt: Timestamp.fromMillis(NOW_MS + EXPIRY_NOTICE_DAYS * DAY_MS) });
    const expiredEdge = lot({ expiresAt: Timestamp.fromMillis(NOW_MS) });
    assert.deepEqual(expiryNoticeDue([edge], now), [edge]);
    assert.deepEqual(expiryNoticeDue([expiredEdge], now), []);
  });
});
