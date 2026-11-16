import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { captureCheckpoint } from './scenarios';
import { captureBounds, expandScrollContents } from './capture-layout';
import { DICTIONARIES, type SupportedLocale, type TranslationKey } from '../../localization/core';
const cases: [string, TranslationKey][] = [
  ['02-welcome.default', 'welcome.cta_start'],
  ['03-registration.default', 'auth.title'],
  ['05-onboarding-basics.union', 'onboarding.vibe.title'],
  ['06-onboarding-values.maximum', 'onboarding.values.title'],
  ['07-onboarding-starter.default', 'onboarding.starter.title'],
  ['09-discovery-filters.default', 'discover.filters.title'],
  ['10-match.ready', 'match.title'],
  ['11-matches.ready', 'matches.title'],
  ['12-chat.history', 'chat.safety'],
  ['13-profile.edit-invalid', 'profile.edit.title'],
  ['14-safety.report-draft', 'safety.title'],
];
for (const [id, key] of cases)
  test(id, async ({ page }, info) => {
    const locale = info.project.use.locale as SupportedLocale;
    await page.clock.install({ time: new Date('2026-11-13T12:00:00Z') });
    await page.route('**/*', (r) =>
      ['localhost', '127.0.0.1'].includes(new URL(r.request().url()).hostname)
        ? r.continue()
        : r.abort(),
    );
    await captureCheckpoint(page, {
      id,
      setup: 'localized synthetic fixture',
      expect: 'localized UI',
      platforms: ['web'],
      viewports: ['mobile', 'tablet', 'web'],
    });
    const expected = DICTIONARIES[locale][key] + (key === 'welcome.cta_start' ? ' →' : '');
    await expect(page.getByText(expected, { exact: true }).first()).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const expandedScroll = await expandScrollContents(page);
    const bounds = await captureBounds(page);
    const dir = resolve(process.env.COMRADIA_ATLAS_ROOT!, 'languages', info.project.name);
    mkdirSync(dir, { recursive: true });
    const file = resolve(dir, id + '.png');
    await page.screenshot({
      path: file,
      fullPage: true,
      clip: bounds,
      animations: 'disabled',
      caret: 'hide',
    });
    writeFileSync(
      file.replace(/\.png$/, '.json'),
      JSON.stringify(
        {
          locale,
          checkpoint: id,
          viewport: info.project.use.viewport,
          expandedScroll,
          captureBounds: bounds,
          evidenceKind: 'synthetic-rendering-fixtures',
          baseline: 'unbaselined',
        },
        null,
        2,
      ),
    );
    await info.attach(id, { path: file, contentType: 'image/png' });
  });
