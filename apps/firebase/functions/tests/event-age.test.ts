import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isEventOlderThan } from '../src/event-age.js';

describe('trigger event age', () => {
  it('rejects events older than the configured age', () => {
    const now = Date.parse('2026-11-15T12:00:00.000Z');
    assert.equal(isEventOlderThan('2026-11-09T11:59:59.999Z', 6, now), true);
  });

  it('accepts events within the age and events without a valid timestamp', () => {
    const now = Date.parse('2026-11-15T12:00:00.000Z');
    assert.equal(isEventOlderThan('2026-11-09T12:00:00.000Z', 6, now), false);
    assert.equal(isEventOlderThan(undefined, 6, now), false);
    assert.equal(isEventOlderThan('not-a-time', 6, now), false);
  });
});
