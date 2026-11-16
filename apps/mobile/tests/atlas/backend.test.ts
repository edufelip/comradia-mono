import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backend, atlasController } from './backend.web';
test('held operations remain pending until released; failures are one-shot', async () => {
  atlasController.hold('getProfile');
  let finished = false;
  const pending = backend.getProfile('test-user').then((value) => {
    finished = true;
    return value;
  });
  await Promise.resolve();
  assert.equal(finished, false);
  atlasController.release('getProfile');
  assert.equal((await pending)?.displayName, 'Ana');
  atlasController.fail('getProfile', 'network');
  await assert.rejects(backend.getProfile('test-user'));
  assert.equal((await backend.getProfile('test-user'))?.displayName, 'Ana');
});
