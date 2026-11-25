import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { highWaterMark, levelForHighWaterMark, nextLevelFor } from './level-for-lifetime';
import { GAM_LEVELS } from './model';

describe('high-water mark', () => {
  it('rises with lifetime net and never falls', () => {
    assert.equal(highWaterMark(0, 300), 300);
    assert.equal(highWaterMark(300, 120), 300);
    assert.equal(highWaterMark(2500, -40), 2500);
  });
});

describe('level for a lifetime high-water mark', () => {
  it('stays on Botão at zero and below', () => {
    assert.equal(levelForHighWaterMark(0), 'botao');
    assert.equal(levelForHighWaterMark(-40), 'botao');
  });

  it('crosses each threshold exactly at its value', () => {
    assert.equal(levelForHighWaterMark(299), 'botao');
    for (const level of GAM_LEVELS) {
      assert.equal(levelForHighWaterMark(level.threshold), level.id);
    }
    assert.equal(levelForHighWaterMark(300), 'flor');
    assert.equal(levelForHighWaterMark(1000), 'ramalhete');
    assert.equal(levelForHighWaterMark(2500), 'jardim');
    assert.equal(levelForHighWaterMark(5000), 'primavera');
  });

  it('never returns a level above the mark', () => {
    assert.equal(levelForHighWaterMark(4999), 'jardim');
    assert.equal(levelForHighWaterMark(999999), 'primavera');
  });
});

describe('next level', () => {
  it('is the first threshold above the value', () => {
    assert.deepEqual(nextLevelFor(1240), { id: 'jardim', threshold: 2500 });
    assert.deepEqual(nextLevelFor(0), { id: 'flor', threshold: 300 });
  });

  it('is null once every threshold is reached', () => {
    assert.equal(nextLevelFor(5000), null);
    assert.equal(nextLevelFor(999999), null);
  });
});
