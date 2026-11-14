import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { createRunRoot, validateManifest } from './artifacts.mjs';
const app = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const manifestPath = resolve(app, '../../docs/qa/flow-checkpoints.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
validateManifest(manifest);
const options = process.argv.slice(2);
if (
  options.filter((a) => !a.startsWith('--')).length > 1 ||
  options.some((a) => a.startsWith('--') && !a.startsWith('--project='))
)
  throw new Error('Usage: test:atlas [checkpoint] [--project=mobile|tablet|web]');
const checkpoint = process.argv.slice(2).find((a) => !a.startsWith('--'));
const project = process.argv.slice(2).find((a) => a.startsWith('--project='));
if (project && !/^--project=(mobile|tablet|web)$/.test(project))
  throw new Error('Invalid atlas project');
if (
  checkpoint &&
  !manifest.flows
    .flatMap((f) => f.checkpoints)
    .some((c) => c.id === checkpoint && c.platforms.includes('web'))
)
  throw new Error('Unknown web checkpoint');
// Refuse an occupied port, including another atlas server; never reuse/kill its owner.
await new Promise((ok, fail) => {
  const s = createServer();
  s.once('error', (error) => {
    const owner = spawnSync('lsof', ['-nP', '-iTCP:8288', '-sTCP:LISTEN'], { encoding: 'utf8' });
    fail(
      new Error(
        `Atlas port 8288 unavailable: ${error.message}\n${owner.stdout || 'Owner unavailable; inspect the listener before retrying.'}`,
      ),
    );
  });
  s.listen(8288, '127.0.0.1', () => s.close(ok));
});
const root = createRunRoot(
  resolve(app, '.artifacts/flow-atlas'),
  new Date().toISOString().replace(/[:.]/g, '-') + '-' + randomUUID().slice(0, 8),
);
const git = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: app, encoding: 'utf8' });
if (git.status !== 0) throw new Error('Cannot record source SHA');
const dirty = spawnSync('git', ['status', '--porcelain'], { cwd: app, encoding: 'utf8' });
const run = {
  sourceSha: git.stdout.trim(),
  dirty: dirty.stdout.trim(),
  manifestSourceSha: manifest.sourceSha,
  checkpoint: checkpoint ?? null,
  project: project?.split('=')[1] ?? 'all',
  expectedScreenshots: manifest.flows
    .flatMap((f) => f.checkpoints)
    .filter((c) => c.platforms.includes('web') && (!checkpoint || c.id === checkpoint))
    .reduce(
      (count, c) =>
        count +
        c.viewports.filter((viewport) => !project || viewport === project.split('=')[1]).length,
      0,
    ),
  evidenceKind: 'synthetic-rendering-fixtures',
  status: 'running',
  startedAt: new Date().toISOString(),
};
const runnerPaths = [
  'metro.config.js',
  'playwright.atlas.config.ts',
  ...['artifacts.mjs', 'run.mjs'].map((f) => 'scripts/atlas/' + f),
  ...[
    'backend.web.ts',
    'scenarios.ts',
    'capture.spec.ts',
    'capture-layout.ts',
    'pick-photo.web.ts',
  ].map((f) => 'tests/atlas/' + f),
];
run.runnerSourceHashes = Object.fromEntries(
  runnerPaths.map((file) => {
    const bytes = readFileSync(resolve(app, file));
    return [file, createHash('sha256').update(bytes).digest('hex')];
  }),
);
writeFileSync(
  resolve(root, 'runner-source.json'),
  JSON.stringify(
    Object.fromEntries(runnerPaths.map((file) => [file, readFileSync(resolve(app, file), 'utf8')])),
    null,
    2,
  ),
);
writeFileSync(resolve(root, 'manifest.json'), JSON.stringify(manifest, null, 2));
writeFileSync(resolve(root, 'run.json'), JSON.stringify(run, null, 2));
const result = spawnSync(
  process.execPath,
  [
    resolve(app, 'node_modules/@playwright/test/cli.js'),
    'test',
    '--config=playwright.atlas.config.ts',
    ...(project ? [project] : []),
  ],
  {
    cwd: app,
    stdio: 'inherit',
    env: { ...process.env, COMRADIA_ATLAS_ROOT: root, COMRADIA_ATLAS_CHECKPOINT: checkpoint ?? '' },
  },
);
const reportPath = resolve(root, 'results.json');
try {
  const report = JSON.parse(readFileSync(reportPath, 'utf8'));
  run.stats = report.stats;
  const failures = [];
  const walk = (s, parents = []) => {
    const titles = [...parents, s.title];
    for (const child of s.suites ?? []) walk(child, titles);
    for (const spec of s.specs ?? [])
      for (const test of spec.tests ?? [])
        if (test.status !== 'expected')
          failures.push({
            checkpoint: titles.find((title) => /^\d\d-/.test(title)) ?? spec.title,
            project: test.projectName,
            status: test.status,
          });
  };
  for (const suite of report.suites ?? []) walk(suite);
  run.failures = failures;
} catch {
  run.reportError = 'Playwright did not produce a readable results.json';
}
run.status = result.status === 0 ? 'capture-finished' : 'capture-failed';
run.exitCode = result.status;
run.finishedAt = new Date().toISOString();
writeFileSync(resolve(root, 'run.json'), JSON.stringify(run, null, 2));
console.log(`Atlas artifacts: ${root}`);
process.exitCode = result.status ?? 1;
