import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DsTypography, getDsTheme } from './design-system';

describe('Comradia design-system tokens', () => {
  it('exposes solidarity crimson accents in light and dark themes', () => {
    const light = getDsTheme('light');
    const dark = getDsTheme('dark');

    assert.equal(light.color.accentPrimary, '#D92D3A');
    assert.equal(dark.color.accentPrimary, '#E05A47');
    assert.equal(DsTypography.title.fontFamily, 'Geist_700Bold');
  });
});
