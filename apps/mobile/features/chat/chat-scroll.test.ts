import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { anchoredOffset, chatScrollAction, scrollIntentFor } from './chat-scroll';

const ids = (count: number) => Array.from({ length: count }, (_, index) => ({ id: `m${index}` }));

describe('scrollIntentFor', () => {
  it('shows the newest message when the first page lands', () => {
    assert.equal(scrollIntentFor([], ids(3)), 'latest');
  });

  it('shows the newest message when one arrives', () => {
    assert.equal(scrollIntentFor(ids(3), [...ids(3), { id: 'm3' }]), 'latest');
  });

  it('keeps the visible position when older messages prepend above it', () => {
    assert.equal(scrollIntentFor(ids(3), [...ids(2), ...ids(3)]), 'anchor');
  });

  it('does nothing when the same list settles again', () => {
    assert.equal(scrollIntentFor(ids(3), ids(3)), 'none');
    assert.equal(scrollIntentFor([], []), 'none');
  });

  it('stays with the newest message when a prepend and an arrival land together', () => {
    assert.equal(scrollIntentFor(ids(3), [...ids(2), ...ids(3), { id: 'm3' }]), 'latest');
  });
});

describe('anchoredOffset', () => {
  it('moves the viewport down by exactly what was prepended above it', () => {
    assert.equal(anchoredOffset(300, 1000, 1400), 700);
  });

  it('never scrolls above the top of the content', () => {
    assert.equal(anchoredOffset(0, 1000, 1400), 400);
    assert.equal(anchoredOffset(10, 1000, 900), 0);
  });
});

describe('chatScrollAction', () => {
  it('maps each intent to its viewport action', () => {
    assert.deepEqual(
      chatScrollAction({ intent: 'latest', offset: 0, previousHeight: 0, height: 100 }),
      {
        kind: 'latest',
      },
    );
    assert.deepEqual(
      chatScrollAction({ intent: 'anchor', offset: 300, previousHeight: 1000, height: 1400 }),
      { kind: 'anchor', y: 700 },
    );
    assert.deepEqual(
      chatScrollAction({ intent: 'none', offset: 300, previousHeight: 1000, height: 1400 }),
      {
        kind: 'none',
      },
    );
  });
});
