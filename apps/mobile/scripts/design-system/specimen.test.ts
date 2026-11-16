import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';
import { DsTypography, getDsTheme } from '../../constants/design-system';
import { contrast, renderSpecimen } from './specimen';

const SPECIMEN_PATH = resolve(__dirname, '../../../../docs/design-system-specimen.html');

describe('design-system specimen', () => {
  it('matches the committed docs/design-system-specimen.html (run `yarn ds:specimen` to refresh)', () => {
    assert.equal(readFileSync(SPECIMEN_PATH, 'utf8'), renderSpecimen());
  });

  it('shows every color token and every text style', () => {
    const html = renderSpecimen();

    for (const key of Object.keys(getDsTheme('light').color)) {
      assert.ok(html.includes(`<code>${key}</code>`), `missing color token ${key}`);
    }
    for (const name of Object.keys(DsTypography)) {
      assert.ok(html.includes(`<code>${name}</code>`), `missing text style ${name}`);
    }
  });

  it('defines both themes, so the toggle and the system setting work', () => {
    const html = renderSpecimen();

    assert.match(html, /:root\[data-theme="dark"\]/);
    assert.match(html, /prefers-color-scheme: dark/);
  });

  it('computes WCAG contrast and skips colors with transparency', () => {
    assert.equal(Math.round(contrast('#000000', '#ffffff') ?? 0), 21);
    assert.equal(contrast('#ffffff80', '#000000'), null);
  });
});
