import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRunRoot, checkpointPath } from './artifacts.mjs';
test('a fresh root is exclusive and a checkpoint cannot escape it', () => {
  const base = mkdtempSync(join(tmpdir(), 'comradia-atlas-'));
  try {
    const root = createRunRoot(base, 'fixture');
    assert.throws(() => createRunRoot(base, 'fixture'));
    assert.equal(
      checkpointPath(root, '01-entry', '01-entry.ready', 'mobile'),
      join(root, '01-entry', '01-entry.ready', 'mobile.png'),
    );
    for (const bad of ['../escape', 'a/b', '..', ''])
      assert.throws(() => checkpointPath(root, bad, 'ready', 'mobile'));
  } finally {
    rmSync(base, { recursive: true });
  }
});

test('Metro fixture alias is opt-in and normal resolution stays unchanged', async () => {
  const { readFileSync } = await import('node:fs');
  const { runInNewContext } = await import('node:vm');
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const source = readFileSync(new URL('../../metro.config.js', import.meta.url), 'utf8');
  for (const enabled of [false, true]) {
    const module = { exports: {} };
    runInNewContext(source, {
      module,
      __dirname: '/fixture/app',
      process: { env: { COMRADIA_ATLAS: enabled ? '1' : '0' } },
      require: (id) =>
        id === 'expo/metro-config' ? { getDefaultConfig: () => ({ resolver: {} }) } : require(id),
    });
    const resolver = module.exports.resolver.resolveRequest;
    if (!enabled) assert.equal(resolver, undefined);
    else {
      assert.equal(
        resolver({}, '@/services/backend', 'web').filePath,
        '/fixture/app/tests/atlas/backend.web.ts',
      );
      assert.equal(
        resolver({ resolveRequest: () => 'unchanged' }, 'ordinary-module', 'web'),
        'unchanged',
      );
    }
  }
});

test('manifest paths and duplicate checkpoint IDs are rejected before a run', async () => {
  const { validateManifest } = await import('./artifacts.mjs');
  const manifest = {
    viewports: { mobile: { width: 390, height: 844 } },
    flows: [
      {
        id: 'flow',
        checkpoints: [{ id: 'flow.ready', platforms: ['web'], viewports: ['mobile'] }],
      },
    ],
  };
  assert.equal(validateManifest(manifest).length, 1);
  assert.throws(() =>
    validateManifest({ ...manifest, flows: [{ id: '../outside', checkpoints: [] }] }),
  );
  assert.throws(
    () => validateManifest({ ...manifest, flows: [...manifest.flows, ...manifest.flows] }),
    /Duplicate flow ID/,
  );
  assert.throws(
    () =>
      validateManifest({
        ...manifest,
        flows: [...manifest.flows, { ...manifest.flows[0], id: 'other-flow' }],
      }),
    /Duplicate checkpoint ID/,
  );
  assert.throws(
    () => validateManifest({ ...manifest, viewports: { mobile: { width: 0, height: 844 } } }),
    /Invalid viewport/,
  );
  assert.throws(
    () =>
      validateManifest({
        ...manifest,
        flows: [
          {
            ...manifest.flows[0],
            checkpoints: [{ ...manifest.flows[0].checkpoints[0], viewports: ['missing'] }],
          },
        ],
      }),
    /Unknown viewport/,
  );
});
