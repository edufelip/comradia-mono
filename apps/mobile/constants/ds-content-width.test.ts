import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveDsContentLayout, resolveWebWidthCap } from './ds-content-width';

test('workspace is full width under 768, like wide between 768 and 1023', () => {
  assert.deepEqual(resolveDsContentLayout(390, 'workspace'), {
    alignSelf: 'center',
    maxWidth: undefined,
  });
  assert.deepEqual(resolveDsContentLayout(900, 'workspace'), resolveDsContentLayout(900, 'wide'));
  assert.equal(resolveDsContentLayout(900, 'workspace').maxWidth, 680);
});

test('workspace at 1024 and up is capped at 1360, left-aligned, with 28px side padding', () => {
  for (const viewport of [1024, 1440, 2560]) {
    assert.deepEqual(resolveDsContentLayout(viewport, 'workspace'), {
      alignSelf: 'flex-start',
      maxWidth: 1360,
      paddingHorizontal: 28,
    });
  }
});

test('the existing widths keep their caps and stay centred', () => {
  assert.equal(resolveDsContentLayout(1440, 'form').maxWidth, 600);
  assert.equal(resolveDsContentLayout(1440, 'wide').maxWidth, 1040);
  assert.equal(resolveDsContentLayout(1440, 'content').maxWidth, 880);
  assert.equal(resolveDsContentLayout(1440, 'full').maxWidth, undefined);
  assert.equal(resolveDsContentLayout(1440, 'wide').alignSelf, 'center');
});

test('web width cap applies from 768 on web only', () => {
  assert.equal(resolveWebWidthCap('web', 390, 600), undefined);
  assert.equal(resolveWebWidthCap('web', 767, 600), undefined);
  assert.equal(resolveWebWidthCap('web', 768, 600), 600);
  assert.equal(resolveWebWidthCap('ios', 1024, 600), undefined);
});
