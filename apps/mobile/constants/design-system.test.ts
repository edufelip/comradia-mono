import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DsTypography, getDsTheme, type DsColorScheme } from './design-system';

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const RGB_COLOR = /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(?:,\s*(?:0|1|0?\.\d+)\s*)?\)$/;

type Rgb = { r: number; g: number; b: number };

/** Parses the opaque hex/rgb colors used for text tokens (alpha is irrelevant for contrast). */
function parseRgb(color: string): Rgb {
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const expanded =
      hex.length === 3 || hex.length === 4
        ? hex
            .slice(0, 3)
            .split('')
            .map((char) => char + char)
            .join('')
        : hex.slice(0, 6);
    assert.equal(expanded.length, 6, `unsupported hex color: ${color}`);
    return {
      r: Number.parseInt(expanded.slice(0, 2), 16),
      g: Number.parseInt(expanded.slice(2, 4), 16),
      b: Number.parseInt(expanded.slice(4, 6), 16),
    };
  }

  const match = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/.exec(color);
  assert.ok(match, `unsupported rgb color: ${color}`);
  return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]) };
}

/** WCAG 2.x relative luminance. */
function relativeLuminance({ r, g, b }: Rgb): number {
  const channel = (value: number) => {
    const scaled = value / 255;
    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG 2.x contrast ratio between two opaque colors, always >= 1. */
function contrastRatio(foreground: string, background: string): number {
  const first = relativeLuminance(parseRgb(foreground));
  const second = relativeLuminance(parseRgb(background));
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

const SCHEMES: DsColorScheme[] = ['light', 'dark'];

describe('Comradia design-system tokens', () => {
  it('exposes solidarity crimson accents in light and dark themes', () => {
    const light = getDsTheme('light');
    const dark = getDsTheme('dark');

    assert.equal(light.color.accentPrimary, '#D92D3A');
    assert.equal(dark.color.accentPrimary, '#E05A47');
    assert.equal(DsTypography.title.fontFamily, 'Geist_700Bold');
  });
});

describe('design-system theme parity', () => {
  it('defines exactly the same color token keys in light and dark', () => {
    const [light, dark] = SCHEMES.map(getDsTheme);
    const lightKeys = Object.keys(light.color).sort();
    const darkKeys = Object.keys(dark.color).sort();

    assert.deepEqual(darkKeys, lightKeys);
    assert.equal(lightKeys.length, 35);
  });

  it('defines exactly the same blob token keys in light and dark', () => {
    const [light, dark] = SCHEMES.map(getDsTheme);

    assert.deepEqual(Object.keys(dark.blob).sort(), Object.keys(light.blob).sort());
    assert.deepEqual(Object.keys(light.blob).sort(), ['bottomRight', 'topLeft']);
  });

  it('uses only valid hex or rgba values for every theme color', () => {
    for (const scheme of SCHEMES) {
      const theme = getDsTheme(scheme);
      const values: [string, string][] = [
        ...Object.entries(theme.color),
        ...Object.entries(theme.blob).map(
          ([key, value]) => [`blob.${key}`, value] as [string, string],
        ),
      ];

      for (const [token, value] of values) {
        assert.equal(typeof value, 'string', `${scheme}.${token} must be a string`);
        assert.ok(
          HEX_COLOR.test(value) || RGB_COLOR.test(value),
          `${scheme}.${token} is not a valid hex/rgba color: ${value}`,
        );
      }
    }
  });
});

describe('design-system text contrast', () => {
  it('keeps textPrimary at WCAG AA (>= 4.5:1) on canvas in both themes', () => {
    for (const scheme of SCHEMES) {
      const { color } = getDsTheme(scheme);
      const ratio = contrastRatio(color.textPrimary, color.canvas);

      assert.ok(
        ratio >= 4.5,
        `${scheme} textPrimary on canvas is ${ratio.toFixed(2)}:1, expected >= 4.5:1`,
      );
    }
  });

  it('keeps textSecondary at >= 3:1 on canvas in both themes', () => {
    for (const scheme of SCHEMES) {
      const { color } = getDsTheme(scheme);
      const ratio = contrastRatio(color.textSecondary, color.canvas);

      assert.ok(
        ratio >= 3,
        `${scheme} textSecondary on canvas is ${ratio.toFixed(2)}:1, expected >= 3:1`,
      );
    }
  });

  it('computes known WCAG reference ratios with the helper', () => {
    // Sanity-check the helper itself: black on white is 21:1, white on white is 1:1.
    assert.equal(Math.round(contrastRatio('#000000', '#ffffff')), 21);
    assert.equal(contrastRatio('#ffffff', '#ffffff'), 1);
    assert.equal(Math.round(contrastRatio('rgba(0, 0, 0, 1)', '#ffffff')), 21);
  });
});
