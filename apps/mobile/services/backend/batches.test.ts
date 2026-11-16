import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { chunk, DELETE_BATCH_SIZE } from './batches';

describe('chunk', () => {
  it('returns no groups for an empty list', () => {
    assert.deepEqual(chunk([], DELETE_BATCH_SIZE), []);
  });

  it('keeps a short list in one group', () => {
    assert.deepEqual(chunk(['a', 'b'], DELETE_BATCH_SIZE), [['a', 'b']]);
  });

  it('splits into consecutive groups of at most the size, in order', () => {
    assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  });

  it('splits exactly at the size without an empty trailing group', () => {
    assert.deepEqual(chunk([1, 2, 3, 4], 2), [
      [1, 2],
      [3, 4],
    ]);
  });

  it('splits a long list into batches of at most DELETE_BATCH_SIZE', () => {
    const items = Array.from({ length: 1000 }, (_, index) => index);
    const groups = chunk(items, DELETE_BATCH_SIZE);
    assert.deepEqual(
      groups.map((group) => group.length),
      [450, 450, 100],
    );
    assert.deepEqual(groups.flat(), items);
  });

  it('does not mutate its input', () => {
    const items = ['a', 'b', 'c'];
    chunk(items, 2);
    assert.deepEqual(items, ['a', 'b', 'c']);
  });

  it('rejects a size that would loop forever', () => {
    for (const size of [0, -1, 1.5, Number.NaN]) {
      assert.throws(() => chunk([1], size), RangeError);
    }
  });
});
