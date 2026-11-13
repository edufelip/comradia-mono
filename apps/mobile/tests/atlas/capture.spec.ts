import { test, expect } from '@playwright/test';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expandScrollContents, captureBounds } from './capture-layout';
import { captureCheckpoint } from './scenarios';
const root = process.env.COMRADIA_ATLAS_ROOT!;
const manifest = JSON.parse(readFileSync(resolve(root, 'manifest.json'), 'utf8'));
for (const flow of manifest.flows) {
  for (const checkpoint of flow.checkpoints) {
    if (!checkpoint.platforms.includes('web')) continue;
    if (
      process.env.COMRADIA_ATLAS_CHECKPOINT &&
      checkpoint.id !== process.env.COMRADIA_ATLAS_CHECKPOINT
    )
      continue;
    test.describe(checkpoint.id, () => {
      const locale =
        checkpoint.id.endsWith('portuguese') || checkpoint.id.endsWith('localized-dark')
          ? 'pt-BR'
          : checkpoint.id.endsWith('spanish') || checkpoint.id.endsWith('localized-dark-es')
            ? 'es-ES'
            : 'en-US';
      test.use({ locale });
      test('capture', async ({ page }, info) => {
        test.skip(
          !checkpoint.viewports.includes(info.project.name),
          'Viewport excluded by checkpoint manifest',
        );
        // Seed browser time; verification advances a paused clock for stable countdowns.
        await page.clock.install({ time: new Date('2026-11-13T12:00:00.000Z') });
        if (checkpoint.id.startsWith('04-'))
          await page.clock.pauseAt(new Date('2026-11-13T12:00:01.000Z'));
        await page.route('**/*', async (route) => {
          const host = new URL(route.request().url()).hostname;
          if (host === '127.0.0.1' || host === 'localhost') return route.continue();
          return route.abort('blockedbyclient');
        });
        await captureCheckpoint(page, checkpoint);
        await page.evaluate(() => document.fonts.ready);
        await expect(page.locator('body')).toBeVisible();
        const expandedScroll = await expandScrollContents(page);
        await page
          .locator('img')
          .evaluateAll((images) =>
            Promise.all(
              images.map((img) =>
                img instanceof HTMLImageElement
                  ? img.decode().catch(() => undefined)
                  : Promise.resolve(),
              ),
            ),
          );
        const dir = resolve(root, flow.id, checkpoint.id);
        mkdirSync(dir, { recursive: true });
        const file = resolve(dir, `${info.project.name}.png`);
        const bounds = await captureBounds(page);
        await page.screenshot({
          path: file,
          fullPage: true,
          clip: bounds,
          animations: 'disabled',
          caret: 'hide',
        });
        await info.attach(checkpoint.id + '-' + info.project.name, {
          path: file,
          contentType: 'image/png',
        });
        writeFileSync(
          file.replace(/\.png$/, '.json'),
          JSON.stringify(
            {
              checkpointId: checkpoint.id,
              flowId: flow.id,
              viewport: info.project.name,
              dimensions: info.project.use.viewport,
              expected: checkpoint.expect,
              evidenceKind: 'synthetic-rendering-fixtures',
              locale,
              colorScheme: checkpoint.id.includes('dark') ? 'dark' : 'light',
              reducedMotion: true,
              baseline: 'unbaselined',
              expandedScroll,
              captureBounds: bounds,
              sourceSha: JSON.parse(readFileSync(resolve(root, 'run.json'), 'utf8')).sourceSha,
            },
            null,
            2,
          ),
        );
      });
    });
  }
}
