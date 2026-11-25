import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DsAchievementTier,
  DsArt,
  DsBorder,
  DsCategoryColor,
  DsFontFamily,
  DsIconSize,
  DsLayout,
  DsRadius,
  DsSpace,
  DsTypography,
  getDsTheme,
  type DsColorScheme,
} from './design-system';

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
    assert.equal(lightKeys.length, 38);
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

/** Composites a translucent token over an opaque one, as the screen does. */
function over(foreground: string, background: string): string {
  const hex = foreground.slice(1);
  const alpha = hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1;
  const top = parseRgb(foreground);
  const bottom = parseRgb(background);
  const mix = (a: number, b: number) =>
    Math.round(a * alpha + b * (1 - alpha))
      .toString(16)
      .padStart(2, '0');
  return `#${mix(top.r, bottom.r)}${mix(top.g, bottom.g)}${mix(top.b, bottom.b)}`;
}

type Token = keyof ReturnType<typeof getDsTheme>['color'];

/** Every text-on-background pair the guideline allows, with the ratio it must meet. */
const TEXT_PAIRS: [Token, Token | `${Token}@${Token}`, number][] = [
  ['textPrimary', 'canvas', 4.5],
  ['textPrimary', 'surface', 4.5],
  ['textPrimary', 'surfaceMuted', 4.5],
  ['textSecondary', 'canvas', 4.5],
  ['textSecondary', 'surface', 4.5],
  ['textSecondary', 'surfaceMuted', 4.5],
  ['textTertiary', 'canvas', 4.5],
  ['textTertiary', 'surface', 4.5],
  ['textTertiary', 'surfaceMuted', 4.5],
  ['accentText', 'canvas', 4.5],
  ['accentText', 'surface', 4.5],
  ['accentText', 'surfaceMuted', 4.5],
  ['accentText', 'accentPrimarySoft@surface', 4.5],
  ['onAccent', 'accentPrimary', 4.5],
  ['onActionPrimary', 'actionPrimary', 4.5],
  ['danger', 'canvas', 4.5],
  ['danger', 'surface', 4.5],
  ['danger', 'dangerSoft@surface', 4.5],
  ['warning', 'warningSoft@canvas', 4.5],
  ['success', 'successSoft', 4.5],
  ['success', 'canvas', 4.5],
  ['disabledText', 'disabledSurface', 4.5],
  ['readOnlyText', 'surfaceWarning', 4.5],
  // Shapes and icons need 3:1 (WCAG 1.4.11).
  ['accentPrimary', 'canvas', 3],
  ['accentPrimary', 'surface', 3],
  ['focusRing', 'canvas', 3],
  ['focusRing', 'surface', 3],
  ['switchThumb', 'accentPrimary', 3],
];

describe('design-system text contrast', () => {
  it('meets the guideline ratio for every allowed text and shape pair in both themes', () => {
    for (const scheme of SCHEMES) {
      const { color } = getDsTheme(scheme);

      for (const [foreground, background, minimum] of TEXT_PAIRS) {
        const [backgroundToken, underlay] = background.split('@') as [Token, Token | undefined];
        const resolvedBackground = underlay
          ? over(color[backgroundToken], color[underlay])
          : color[backgroundToken];
        const ratio = contrastRatio(
          over(color[foreground], resolvedBackground),
          resolvedBackground,
        );

        assert.ok(
          ratio >= minimum,
          `${scheme} ${foreground} on ${background} is ${ratio.toFixed(2)}:1, expected >= ${minimum}:1`,
        );
      }
    }
  });

  it('computes known WCAG reference ratios with the helper', () => {
    // Sanity-check the helper itself: black on white is 21:1, white on white is 1:1.
    assert.equal(Math.round(contrastRatio('#000000', '#ffffff')), 21);
    assert.equal(contrastRatio('#ffffff', '#ffffff'), 1);
    assert.equal(Math.round(contrastRatio('rgba(0, 0, 0, 1)', '#ffffff')), 21);
  });

  it('composites translucent colors over their underlay', () => {
    assert.equal(over('#ffffff80', '#000000'), '#808080');
    assert.equal(over('#123456', '#ffffff'), '#123456');
  });
});

describe('design-system scales', () => {
  it('keeps spacing, radius and layout values ascending and positive', () => {
    const spaces = Object.values(DsSpace);
    assert.deepEqual(
      [...spaces].sort((a, b) => a - b),
      spaces,
    );
    assert.ok(spaces.every((value) => value > 0));

    const radii = Object.values(DsRadius);
    assert.deepEqual(
      [...radii].sort((a, b) => a - b),
      radii,
    );
    assert.equal(DsRadius.pill, 9999);
  });

  it('keeps every control at least the minimum touch target', () => {
    assert.ok(DsLayout.minTouchTarget >= 44);
    assert.ok(DsLayout.controlHeight >= DsLayout.minTouchTarget);
    assert.ok(DsLayout.fieldHeight >= DsLayout.minTouchTarget);
    assert.ok(DsLayout.breakpointTablet < DsLayout.breakpointDesktop);
  });

  it('exposes border widths and icon sizes in ascending order', () => {
    assert.ok(DsBorder.hairline < DsBorder.strong && DsBorder.strong < DsBorder.focus);
    assert.ok(DsIconSize.sm < DsIconSize.md && DsIconSize.md < DsIconSize.lg);
  });
});

describe('design-system typography scale', () => {
  it('gives every text style a font family from DsFontFamily and a line height above its size', () => {
    const families = new Set<string>(Object.values(DsFontFamily));

    for (const [name, style] of Object.entries(DsTypography)) {
      assert.ok(
        style.fontFamily && families.has(style.fontFamily),
        `${name} has an unknown family`,
      );
      assert.ok(
        (style.lineHeight ?? 0) > (style.fontSize ?? 0),
        `${name} line height must exceed its font size`,
      );
    }
  });

  it('keeps text typed into fields at 15px or more', () => {
    assert.ok((DsTypography.input.fontSize ?? 0) >= 15);
  });
});

describe('design-system art palette', () => {
  it('uses valid hex colors for every illustration value', () => {
    const values = [
      DsArt.sunCore,
      DsArt.sunEdge,
      ...DsArt.faces.flatMap((face) => [face.background, face.shirt, face.skin]),
    ];

    for (const value of values) assert.match(value, HEX_COLOR);
  });

  it('keeps category accents as opaque 6-digit hex so a two-digit alpha suffix stays valid', () => {
    for (const value of Object.values(DsCategoryColor)) assert.match(value, /^#[0-9a-fA-F]{6}$/);
  });
});

describe('design-system achievement tiers', () => {
  it('uses valid opaque 6-digit hex for every tier shade', () => {
    for (const tier of Object.values(DsAchievementTier)) {
      const values = [
        tier.base,
        tier.rimLight,
        tier.rimDark,
        tier.face.light,
        tier.face.dark,
        tier.glyphInk.light,
        tier.glyphInk.dark,
        tier.highlightArc,
        tier.ink,
      ];

      for (const value of values) assert.match(value, /^#[0-9a-fA-F]{6}$/);
    }
  });

  it('keeps text on a tier fill readable: ink passes AA on every metal in both schemes', () => {
    for (const scheme of SCHEMES) {
      for (const [name, tier] of Object.entries(DsAchievementTier)) {
        const ratio = contrastRatio(tier.ink, tier.base);

        assert.ok(
          ratio >= 4.5,
          `${scheme} ink on ${name} tier is ${ratio.toFixed(2)}:1, expected >= 4.5:1`,
        );
      }
    }
  });

  it('keeps the medal glyph visible against its face in both schemes (UI contrast 3:1)', () => {
    for (const scheme of SCHEMES) {
      for (const [name, tier] of Object.entries(DsAchievementTier)) {
        const ratio = contrastRatio(tier.glyphInk[scheme], tier.face[scheme]);

        assert.ok(
          ratio >= 3,
          `${scheme} glyphInk on ${name} face is ${ratio.toFixed(2)}:1, expected >= 3:1`,
        );
      }
    }
  });
});
