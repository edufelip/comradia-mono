import {
  DsAchievementTier,
  DsArt,
  DsBorder,
  DsCategoryColor,
  DsFontFamily,
  DsIconSize,
  DsLayout,
  DsRadius,
  DsShadow,
  DsSpace,
  DsTypography,
  getDsTheme,
  type DsColorScheme,
} from '../../constants/design-system';
import { DS_MOTION } from '../../constants/motion';

/**
 * Renders docs/design-system-specimen.html from the real tokens, so the page cannot drift
 * from the code: `specimen.test.ts` fails when the committed file differs from this output.
 * Regenerate with `yarn ds:specimen`.
 */

const kebab = (name: string) => name.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

type Rgb = [number, number, number];

function toRgb(color: string): Rgb | null {
  if (!color.startsWith('#')) return null;
  const hex = color.slice(1);
  const full =
    hex.length <= 4 ? [...hex.slice(0, 3)].map((char) => char + char).join('') : hex.slice(0, 6);
  return [0, 2, 4].map((offset) => Number.parseInt(full.slice(offset, offset + 2), 16)) as Rgb;
}

function luminance([r, g, b]: Rgb): number {
  const channel = (value: number) => {
    const scaled = value / 255;
    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast of two opaque hex colors, or null when either carries transparency. */
export function contrast(foreground: string, background: string): number | null {
  const first = toRgb(foreground);
  const second = toRgb(background);
  if (!first || !second || foreground.length > 7 || background.length > 7) return null;
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter! + 0.05) / (darker! + 0.05);
}

const CONTRAST_PAIRS: [string, string, string][] = [
  ['textPrimary', 'canvas', 'Body and headings'],
  ['textPrimary', 'surface', 'Text on a card'],
  ['textSecondary', 'canvas', 'Supporting text'],
  ['textSecondary', 'surfaceMuted', 'Supporting text on a muted fill'],
  ['textTertiary', 'canvas', 'Hints, placeholders, step counters'],
  ['textTertiary', 'surfaceMuted', 'Hints on a muted fill'],
  ['accentText', 'canvas', 'Accent text and links'],
  ['accentText', 'surface', 'Accent text on a card'],
  ['accentPrimary', 'canvas', 'Accent fills, borders and icons (3:1 needed)'],
  ['onActionPrimary', 'actionPrimary', 'Primary button label'],
  ['onAccent', 'accentPrimary', 'Label on an accent fill (chip, accent button)'],
  ['success', 'canvas', 'Success text'],
  ['danger', 'canvas', 'Error text'],
  ['warning', 'warningSoft', 'Offline banner'],
  ['focusRing', 'canvas', 'Keyboard focus ring (3:1 needed)'],
];

const COLOR_GROUPS: [string, string[]][] = [
  [
    'Canvas and surfaces',
    ['canvas', 'shell', 'surface', 'surfaceMuted', 'surfaceElevated', 'surfaceWarning'],
  ],
  [
    'Text',
    ['textPrimary', 'textSecondary', 'textTertiary', 'readOnlyText', 'onAccent', 'onActionPrimary'],
  ],
  [
    'Brand accent',
    [
      'accentPrimary',
      'accentText',
      'accentPrimaryHover',
      'accentPrimarySoft',
      'accentWarm',
      'accentWarmSoft',
      'accentCyan',
      'accentCyanSoft',
    ],
  ],
  ['Action', ['actionPrimary', 'switchThumb']],
  [
    'Status',
    ['success', 'successSoft', 'warning', 'warningSoft', 'danger', 'dangerSoft', 'dangerBorder'],
  ],
  ['Lines and focus', ['border', 'borderStrong', 'focusRing']],
  ['Disabled', ['disabledSurface', 'disabledText', 'disabledBorder']],
  ['Overlays', ['overlayNeutral', 'overlaySoft', 'overlayStrong']],
];

function schemeVars(scheme: DsColorScheme): string {
  const theme = getDsTheme(scheme);
  const colors = Object.entries(theme.color).map(([key, value]) => `--c-${kebab(key)}: ${value};`);
  const blobs = Object.entries(theme.blob).map(([key, value]) => `--blob-${kebab(key)}: ${value};`);
  return [...colors, ...blobs].join('\n  ');
}

function px(value: number | undefined): string {
  return `${value ?? 0}px`;
}

function typeRule(name: string): string {
  const style = DsTypography[name as keyof typeof DsTypography];
  const family = Object.entries(DsFontFamily).find(([, value]) => value === style.fontFamily)?.[0];
  const mono =
    family === 'mono' ? "'Geist Mono', ui-monospace, monospace" : "'Geist', system-ui, sans-serif";
  return [
    `font-family:${mono}`,
    `font-size:${px(style.fontSize)}`,
    `line-height:${px(style.lineHeight)}`,
    `font-weight:${style.fontWeight ?? 400}`,
    style.letterSpacing ? `letter-spacing:${style.letterSpacing}px` : '',
    style.textTransform ? `text-transform:${style.textTransform}` : '',
  ]
    .filter(Boolean)
    .join(';');
}

const TYPE_USAGE: Record<string, string> = {
  hero: 'The one large moment (welcome headline, match celebration)',
  heading: 'Section and sheet headings',
  bodyLarge: 'Chat messages, profile answers',
  label: 'Bold label of a card or field',
  display: 'Onboarding and auth headline',
  title: 'Screen title in tabs',
  screenTitle: 'Top bar title',
  cardTitle: 'Card and row title',
  body: 'Default reading text',
  input: 'Text typed into a field',
  caption: 'Metadata, helper text, banners',
  button: 'Button labels',
  chip: 'Chip and tag labels',
  eyebrow: 'Step counter, kicker',
  micro: 'Badges, tiny counters',
  figure: 'Big numbers',
};

const ICONS = {
  back: 'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z',
  cloudOff:
    'M19.35 10.04C18.67 6.59 15.64 4 12 4c-1.48 0-2.85.43-4.01 1.17l1.46 1.46C10.21 6.23 11.08 6 12 6c3.04 0 5.5 2.46 5.5 5.5v.5H19c1.66 0 3 1.34 3 3 0 1.13-.64 2.11-1.56 2.62l1.45 1.45C23.16 18.16 24 16.68 24 15c0-2.64-2.05-4.78-4.65-4.96zM3 5.27l2.75 2.74C2.56 8.15 0 10.77 0 14c0 3.31 2.69 6 6 6h11.73l2 2L21 20.73 4.27 4 3 5.27zM7.73 10l8 8H6c-2.21 0-4-1.79-4-4s1.79-4 4-4h1.73z',
  favorite:
    'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
  close:
    'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
  localFlorist:
    'M12 22a9 9 0 0 0 9-9 9 9 0 0 0-9 9zM5.6 10.25a2.5 2.5 0 0 0 3.92 2.06l-.02.19a2.5 2.5 0 0 0 5 0l-.02-.19c.4.28.89.44 1.42.44a2.5 2.5 0 0 0 2.5-2.5c0-1-.59-1.85-1.43-2.25.84-.4 1.43-1.25 1.43-2.25a2.5 2.5 0 0 0-3.92-2.06l.02-.19a2.5 2.5 0 0 0-5 0l.02.19c-.4-.28-.89-.44-1.42-.44a2.5 2.5 0 0 0-2.5 2.5c0 1 .59 1.85 1.43 2.25-.84.4-1.43 1.25-1.43 2.25zM12 5.5a2.5 2.5 0 0 1 0 5 2.5 2.5 0 0 1 0-5zM3 13a9 9 0 0 0 9 9 9 9 0 0 0-9-9z',
  forum:
    'M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z',
  verified:
    'M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z',
};

function icon(path: string, size: number = DsIconSize.md): string {
  return `<svg aria-hidden="true" viewBox="0 0 24 24" width="${size}" height="${size}" fill="currentColor"><path d="${path}"/></svg>`;
}

/** The medal as `DsMedal` draws it: rim gradient, inner bevel, tinted face, highlight arc, glyph. */
function medalSketch(
  tier: 'bronze' | 'silver' | 'gold',
  scheme: DsColorScheme,
  glyph: string,
  size: number,
  locked = false,
): string {
  const shades = DsAchievementTier[tier];
  const id = `specimen-medal-${tier}-${scheme}`;
  const glyphSize = Math.round(size * (52 / 132));
  return `<div class="medal-figure${locked ? ' locked' : ''}">
    <div class="medal-art" style="width:${size}px;height:${size}px">
      <svg aria-hidden="true" viewBox="0 0 132 132" width="${size}" height="${size}">
        <defs>
          <linearGradient id="${id}-rim" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="${shades.rimLight}"/><stop offset=".5" stop-color="${shades.base}"/><stop offset="1" stop-color="${shades.rimDark}"/>
          </linearGradient>
          <linearGradient id="${id}-bevel" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="${shades.rimDark}"/><stop offset="1" stop-color="${shades.rimLight}"/>
          </linearGradient>
        </defs>
        <circle cx="66" cy="66" r="62" fill="url(#${id}-rim)"/>
        <circle cx="66" cy="66" r="51" fill="url(#${id}-bevel)"/>
        <circle cx="66" cy="66" r="48" fill="${shades.face[scheme]}"/>
        <path d="M30 44 A42 42 0 0 1 88 24" fill="none" stroke="${shades.highlightArc}" stroke-opacity="${scheme === 'dark' ? 0.12 : 0.5}" stroke-width="3" stroke-linecap="round"/>
      </svg>
      <span class="medal-glyph" style="color:${shades.glyphInk[scheme]}">${icon(glyph, glyphSize)}</span>
    </div>
    <figcaption><code>${tier}</code></figcaption>
  </div>`;
}

function cravosSection(): string {
  const arcOffset = (2 * Math.PI * 27 * 0.25).toFixed(2);
  const confettiColors = [
    'var(--c-accent-primary)',
    'var(--c-accent-warm)',
    DsAchievementTier.gold.base,
    'var(--c-success)',
    'var(--c-accent-cyan)',
  ];
  const pieces = Array.from({ length: 14 }, (_, index) => {
    const left = 110 + Math.sin(index * 2.7) * 60 + index * 4;
    const top = 20 + ((index * 37) % 70);
    return `<i style="left:${Math.round(left)}px;top:${top}px;width:${4 + (index % 3)}px;height:${6 + (index % 4)}px;background:${confettiColors[index % confettiColors.length]};transform:rotate(${(index * 47) % 360}deg)"></i>`;
  }).join('');
  const medals = (scheme: DsColorScheme) =>
    (['bronze', 'silver', 'gold'] as const)
      .map((tier) =>
        medalSketch(
          tier,
          scheme,
          tier === 'gold' ? ICONS.verified : tier === 'silver' ? ICONS.forum : ICONS.localFlorist,
          56,
        ),
      )
      .join('');

  return `
      <h3>Cravos reward moments</h3>
      <div class="row wrap">
        <div class="kv-demo">
          <b>DsProgressBar</b>
          <div class="reward-bar" role="progressbar" aria-valuemin="0" aria-valuemax="2500" aria-valuenow="1240" aria-label="Progresso até Jardim"><b style="width:49.6%"></b></div>
          <small>8 pt pill, surfaceMuted track, accent fill; eases in over 360 ms.</small>
        </div>
        <div class="kv-demo">
          <b>DsProgressRing</b>
          <div class="reward-ring">
            <svg aria-hidden="true" viewBox="0 0 64 64" width="64" height="64">
              <circle cx="32" cy="32" r="27" fill="none" style="stroke:var(--c-surface-muted)" stroke-width="6"/>
              <circle cx="32" cy="32" r="27" fill="none" style="stroke:var(--c-accent-primary)" stroke-width="6" stroke-linecap="round" stroke-dasharray="169.65" stroke-dashoffset="${arcOffset}"/>
            </svg>
            <span>5/6</span>
          </div>
          <small>Decorative streak ring; the card copy announces the streak.</small>
        </div>
        <div class="kv-demo">
          <b>DsCountUp</b>
          <div style="${typeRule('figure')}">1.240</div>
          <small>Counts from the last seen value over 600 ms (tabular digits, final value spoken).</small>
        </div>
      </div>

      <h4>DsMedal · light face</h4>
      <div class="medals">${medals('light')}${medalSketch('bronze', 'light', ICONS.forum, 56, true)}</div>
      <h4>DsMedal · dark face</h4>
      <div class="medals">${medals('dark')}</div>

      <h4>DsConfetti</h4>
      <div class="confetti-demo" aria-hidden="true">${pieces}</div>
      <small>40 pieces rise and fade over 900 ms from the origin; nothing under Reduce Motion.</small>

      <h4>DsRewardToast</h4>
      <div class="notice tone-info reward" role="status">
        <span class="notice-icon" aria-hidden="true">${icon(ICONS.localFlorist)}</span>
        <div class="notice-content"><b>+30 Cravos</b><small>Conversa iniciada com Maya</small></div>
        <button class="reward-close" type="button" aria-label="Fechar aviso">${icon(ICONS.close, DsIconSize.md)}</button>
      </div>
      <small>DsNotice overlay with the flower glyph, a DsCountUp title, ten petals behind the flower and the close button on the title line.</small>`;
}

function colorSection(): string {
  const light = getDsTheme('light').color as Record<string, string>;
  const dark = getDsTheme('dark').color as Record<string, string>;
  const groups = COLOR_GROUPS.map(
    ([title, keys]) => `
      <h3>${title}</h3>
      <div class="swatches">${keys
        .map(
          (key) => `
        <div class="swatch">
          <div class="chip-color" style="background:var(--c-${kebab(key)})"></div>
          <code>${key}</code>
          <small>light ${escapeHtml(light[key]!)}<br />dark ${escapeHtml(dark[key]!)}</small>
        </div>`,
        )
        .join('')}</div>`,
  ).join('');

  const rows = CONTRAST_PAIRS.map(([fg, bg, use]) => {
    const cell = (colors: Record<string, string>) => {
      const ratio = contrast(colors[fg]!, colors[bg]!);
      if (ratio === null) return '<td>n/a</td>';
      const cls = ratio >= 4.5 ? 'pass' : ratio >= 3 ? 'warn' : 'fail';
      return `<td class="${cls}">${ratio.toFixed(2)}:1</td>`;
    };
    return `<tr><td><code>${fg}</code> on <code>${bg}</code><br /><small>${use}</small></td>${cell(light)}${cell(dark)}</tr>`;
  }).join('');

  return `
    <section id="color">
      <h2>Color</h2>
      <p>Always read colors from <code>getDsTheme(scheme).color</code>, never a literal. Swatches follow the theme toggle above.</p>
      ${groups}
      <h3>Contrast of key pairs</h3>
      <p>Green: 4.5:1 or more (AA text). Amber: 3:1 to 4.5:1, large or bold text and UI only. Red: below 3:1.</p>
      <table class="contrast"><thead><tr><th>Pair</th><th>Light</th><th>Dark</th></tr></thead><tbody>${rows}</tbody></table>
      <h3>Fixed palettes (same in both themes)</h3>
      <div class="swatches">${Object.entries(DsCategoryColor)
        .map(
          ([key, value]) =>
            `<div class="swatch"><div class="chip-color" style="background:${value}"></div><code>DsCategoryColor.${key}</code><small>${value}</small></div>`,
        )
        .join('')}${DsArt.faces
        .flatMap((face, index) =>
          [
            ['background', face.background],
            ['shirt', face.shirt],
            ['skin', face.skin],
          ].map(
            ([part, value]) =>
              `<div class="swatch"><div class="chip-color" style="background:${value}"></div><code>DsArt.faces[${index}].${part}</code><small>${value}</small></div>`,
          ),
        )
        .join('')}${Object.entries(DsAchievementTier)
        .flatMap(([tier, shades]) =>
          (
            [
              ['base', shades.base],
              ['rimLight', shades.rimLight],
              ['rimDark', shades.rimDark],
              ['face.light', shades.face.light],
              ['face.dark', shades.face.dark],
              ['glyphInk.light', shades.glyphInk.light],
              ['glyphInk.dark', shades.glyphInk.dark],
            ] as const
          ).map(
            ([part, value]) =>
              `<div class="swatch"><div class="chip-color" style="background:${value}"></div><code>DsAchievementTier.${tier}.${part}</code><small>${value}</small></div>`,
          ),
        )
        .join('')}</div>
    </section>`;
}

function typographySection(): string {
  const rows = Object.keys(DsTypography)
    .map((name) => {
      const style = DsTypography[name as keyof typeof DsTypography];
      return `
      <div class="type-row">
        <div class="type-meta"><code>${name}</code><small>${style.fontSize}/${style.lineHeight} · ${
          Object.entries(DsFontFamily).find(([, value]) => value === style.fontFamily)?.[0]
        }${style.letterSpacing ? ` · ${style.letterSpacing}` : ''}<br />${TYPE_USAGE[name] ?? ''}</small></div>
        <div class="type-sample" style="${typeRule(name)}">${name === 'figure' ? '1,284' : 'Where solidarity meets romance'}</div>
      </div>`;
    })
    .join('');
  return `
    <section id="type">
      <h2>Typography</h2>
      <p>One family, Geist, in three loaded weights (400, 500, 700) plus Geist Mono 500. Spell every text style from <code>DsTypography</code>; a bare <code>Text</code> falls back to the system font.</p>
      ${rows}
    </section>`;
}

function scalesSection(): string {
  const space = Object.entries(DsSpace)
    .map(
      ([key, value]) =>
        `<div class="scale-row"><code>${key}</code><span class="bar" style="width:${value * 4}px"></span><small>${value}</small></div>`,
    )
    .join('');
  const radius = Object.entries(DsRadius)
    .map(
      ([key, value]) =>
        `<div class="radius-box" style="border-radius:${Math.min(value, 44)}px"><code>${key}</code><small>${value}</small></div>`,
    )
    .join('');
  const layout = Object.entries(DsLayout)
    .map(([key, value]) => `<tr><td><code>${key}</code></td><td>${value}</td></tr>`)
    .join('');
  const border = Object.entries(DsBorder)
    .map(([key, value]) => `<tr><td><code>${key}</code></td><td>${value}</td></tr>`)
    .join('');
  const icons = Object.entries(DsIconSize)
    .map(
      ([key, value]) =>
        `<div class="icon-demo">${icon(ICONS.favorite, value)}<code>${key}</code><small>${value}</small></div>`,
    )
    .join('');
  const shadows = Object.entries(DsShadow)
    .map(([key, value]) => {
      const offset = (value.shadowOffset ?? { width: 0, height: 0 }) as {
        width: number;
        height: number;
      };
      const css = value.shadowRadius
        ? `box-shadow:${offset.width}px ${offset.height}px ${value.shadowRadius}px rgba(0,0,0,${value.shadowOpacity});`
        : '';
      return `<div class="shadow-box" style="${css}"><code>${key}</code></div>`;
    })
    .join('');
  return `
    <section id="scales">
      <h2>Space, radius, borders, layout, icons, shadow</h2>
      <h3>Spacing (<code>DsSpace</code>)</h3>${space}
      <h3>Radius (<code>DsRadius</code>)</h3><div class="radii">${radius}</div>
      <h3>Layout (<code>DsLayout</code>)</h3><table class="kv"><tbody>${layout}</tbody></table>
      <h3>Border widths (<code>DsBorder</code>)</h3><table class="kv"><tbody>${border}</tbody></table>
      <h3>Icon sizes (<code>DsIconSize</code>)</h3><div class="icons">${icons}</div>
      <h3>Shadow (<code>DsShadow</code>)</h3><div class="shadows">${shadows}</div>
    </section>`;
}

function motionSection(): string {
  const bars = Object.entries(DS_MOTION.duration)
    .map(
      ([key, value]) => `
      <div class="motion-row"><code>${key}</code><small>${value} ms</small>
        <div class="motion-track"><span class="motion-dot" style="--d:${value}ms"></span></div></div>`,
    )
    .join('');
  return `
    <section id="motion">
      <h2>Motion</h2>
      <p>Cubic ease-out <code>[${DS_MOTION.easing.easeOut.join(', ')}]</code>, no springs or bounce. Reduced motion removes the movement (here too).</p>
      <button class="replay" type="button" onclick="document.getElementById('motion').classList.remove('play');void document.getElementById('motion').offsetWidth;document.getElementById('motion').classList.add('play')">Replay</button>
      ${bars}
    </section>`;
}

function componentsSection(): string {
  const variants = ['primary', 'secondary', 'outline', 'ghost']
    .map((variant) => `<button class="pill ${variant}" type="button">${variant}</button>`)
    .join('');
  const progress = `<div class="progress"><button class="round small" type="button" aria-label="Back">${icon(ICONS.back)}</button><div><small class="eyebrow">Step 2 of 3</small><div class="segs"><i class="on"></i><i class="cur"></i><i></i></div></div></div>`;
  return `
    <section id="components">
      <h2>Components</h2>
      <p>Every primitive in <code>components/ds</code>, drawn with the same tokens. All take <code>scheme</code> and <code>testID</code>.</p>

      <h3>DsPillButton</h3>
      <div class="row">${variants}</div>
      <div class="row"><button class="pill primary" type="button" disabled>disabled</button><button class="pill outline" type="button" disabled>disabled</button><button class="pill primary selected" type="button">selected</button><button class="pill secondary selected" type="button">selected</button></div>
      <div class="row"><button class="pill primary accent" type="button">Accent fill (onAccent)</button></div>

      <h3>DsIconButton · DsBackButton</h3>
      <div class="row"><button class="round" type="button" aria-label="Favorite">${icon(ICONS.favorite)}</button><button class="round small" type="button" aria-label="Back">${icon(ICONS.back)}</button></div>

      <h3>DsCard</h3>
      <div class="cards">
        <div class="card"><b>default</b><br /><small>surface</small></div>
        <div class="card muted"><b>muted</b><br /><small>surfaceMuted</small></div>
        <div class="card warning"><b>warning</b><br /><small>surfaceWarning</small></div>
      </div>

      <h3>DsChip</h3>
      <div class="row"><span class="chipx">🌿 Climate</span><span class="chipx on">📚 Bookshops</span><span class="chipx off">🚲 Cycling</span></div>

      <h3>DsSwitch</h3>
      <div class="row"><span class="switch"><i></i></span><span class="switch on"><i></i></span></div>

      <h3>DsSelectCard</h3>
      <div class="cards two">
        <div class="opt"><span class="tile" style="background:${DsCategoryColor.forest}22">🌿</span><b>Outdoorsy</b><small>Trails, bikes, picnics</small></div>
        <div class="opt on" style="border-color:${DsCategoryColor.crimson};background:${DsCategoryColor.crimson}22"><span class="tile" style="background:${DsCategoryColor.crimson}22">🎨</span><b>Creative</b><small>Zines, gigs, murals</small></div>
      </div>

      <h3>DsTextField</h3>
      <div class="fields">
        <div class="fieldwrap"><label>Phone number</label><div class="field"><span class="prefix">🇧🇷 +55</span><i class="sep"></i><input aria-label="Phone" placeholder="(11) 91234-5678" /></div><small>We text you a code.</small></div>
        <div class="fieldwrap"><label>Display name</label><div class="field error"><input aria-label="Name" value="A" readonly /></div><small class="err" role="alert">${icon(ICONS.cloudOff, DsIconSize.sm)} Use at least two letters.</small></div>
        <div class="fieldwrap"><label>City</label><div class="field disabled"><input aria-label="City" value="São Paulo" disabled /></div></div>
      </div>

      <h3>DsStepProgress</h3>
      ${progress}

      <h3>DsSectionHeader · DsDivider</h3>
      <div class="card"><div class="sechead"><small class="eyebrow">Recent</small><button class="link" type="button">See all</button></div><hr class="divider" /><div class="sechead"><b>Your matches</b></div></div>

      <h3>DsListRow</h3>
      <div class="card list">
        <div class="lrow"><span class="avatar s">A</span><div class="ltext"><b>Alex</b><small>Fancy a walk on Saturday?</small></div><small>2m</small><i class="dot"></i></div>
        <hr class="divider inset" />
        <div class="lrow"><span class="avatar s">M</span><div class="ltext"><b>Maya</b><small>You matched on mutual aid</small></div><small>1d</small></div>
      </div>

      <h3>DsAvatar</h3>
      <div class="row"><span class="avatar xs">A</span><span class="avatar s">A</span><span class="avatar">A</span><span class="avatar arch">M</span><span class="avatar presence">J</span></div>

      <h3>DsNotice</h3>
      <div class="notices">
        <div class="notice tone-info"><b>It's a match!</b><div class="row"><button class="pill primary sm" type="button">View</button><button class="pill ghost sm" type="button">Dismiss</button></div></div>
        <div class="notice tone-warning"><b>Photo upload failed</b><small>Check your connection and try again.</small></div>
      </div>

      <h3>DsEmptyState</h3>
      <div class="card empty"><b>No matches yet</b><p>Keep exploring, someone will like you back.</p><button class="pill primary sm" type="button">Go to Discover</button></div>

      <h3>DsSheet</h3>
      <div class="sheetdemo"><div class="scrim"></div><div class="sheet"><i class="grab"></i><div class="sheethead"><b>Filters</b><button class="link" type="button">Done</button></div><p>Age range, distance and values.</p><button class="pill primary" type="button">Apply</button></div></div>

      <h3>DsOfflineBanner</h3>
      <div class="banner" role="alert">${icon(ICONS.cloudOff, DsIconSize.sm)}<span>You are offline. Some things may be out of date.</span></div>

      <h3>DsSkeletonCard</h3>
      <div class="card skeleton" aria-label="Loading"><i class="bar t"></i><i class="bar"></i><i class="bar s"></i></div>
${cravosSection()}
    </section>`;
}

function patternSection(): string {
  return `
    <section id="patterns">
      <h2>Pattern: onboarding step</h2>
      <p>Gutter ${DsLayout.screenGutter}, progress row, <code>display</code> title, <code>body</code> lede in <code>textSecondary</code>, content, CTA docked at the bottom.</p>
      <div class="phone">
        <div class="progress"><button class="round small" type="button" aria-label="Back">${icon(ICONS.back)}</button><div><small class="eyebrow">Step 2 of 3</small><div class="segs"><i class="on"></i><i class="cur"></i><i></i></div></div></div>
        <h1 class="display">What are you into?</h1>
        <p class="lede">Pick up to five. They show on your card.</p>
        <div class="row wrap"><span class="chipx on">🌿 Climate</span><span class="chipx">🚋 Transit</span><span class="chipx">☕ Coffee</span><span class="chipx">🎬 Film</span><span class="chipx">🌱 Gardens</span></div>
        <div class="phone-foot"><button class="pill primary accent" type="button">Continue</button></div>
      </div>
    </section>`;
}

const CSS = `
:root, :root[data-theme="light"] {
  ${schemeVars('light')}
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    ${schemeVars('dark')}
    color-scheme: dark;
  }
}
:root[data-theme="dark"] {
  ${schemeVars('dark')}
  color-scheme: dark;
}
:root {
  --r-sm:${DsRadius.sm}px; --r-lg:${DsRadius.lg}px; --r-xxl:${DsRadius.xxl}px; --r-pill:${DsRadius.pill}px;
  --ease:cubic-bezier(${DS_MOTION.easing.easeOut.join(',')});
  --gutter:${DsLayout.screenGutter}px;
}
@font-face{font-family:'Geist';font-weight:400;src:url('../apps/website/fonts/Geist_400Regular.ttf') format('truetype');font-display:swap}
@font-face{font-family:'Geist';font-weight:500;src:url('../apps/website/fonts/Geist_500Medium.ttf') format('truetype');font-display:swap}
@font-face{font-family:'Geist';font-weight:700;src:url('../apps/website/fonts/Geist_700Bold.ttf') format('truetype');font-display:swap}
*{box-sizing:border-box;margin:0}
body{background:var(--c-canvas);color:var(--c-text-primary);font:400 14px/20px 'Geist',system-ui,sans-serif}
code{font-family:'Geist Mono',ui-monospace,monospace;font-size:12px;background:var(--c-surface-muted);padding:1px 6px;border-radius:6px}
small{color:var(--c-text-secondary);font-size:12px;line-height:16px;display:block}
em{font-style:normal;font-size:11px;font-weight:500;color:var(--c-accent-text);margin-left:6px}
header.top{position:sticky;top:0;z-index:5;background:var(--c-canvas);border-bottom:1px solid var(--c-border)}
.bar-row{max-width:1040px;margin:0 auto;padding:12px var(--gutter);display:flex;gap:16px;align-items:center;flex-wrap:wrap}
.bar-row b{font-weight:700;font-size:16px;margin-right:auto}
nav{display:flex;gap:4px;flex-wrap:wrap}
nav a{color:var(--c-text-secondary);text-decoration:none;padding:6px 10px;border-radius:var(--r-pill)}
nav a:hover{background:var(--c-surface-muted);color:var(--c-text-primary)}
.theme{display:flex;border:1px solid var(--c-border-strong);border-radius:var(--r-pill);overflow:hidden}
.theme button{all:unset;cursor:pointer;padding:6px 12px;font-weight:500}
.theme button[aria-pressed="true"]{background:var(--c-action-primary);color:var(--c-on-action-primary)}
:focus-visible{outline:3px solid var(--c-focus-ring);outline-offset:3px}
main{max-width:1040px;margin:0 auto;padding:32px var(--gutter) 96px}
section{margin-top:56px}
h1.page{font-size:30px;line-height:34px;letter-spacing:-1px;font-weight:700}
h2{font-size:24px;line-height:30px;font-weight:700;margin-bottom:8px}
h3{font-size:16px;line-height:22px;font-weight:700;margin:28px 0 10px}
p{color:var(--c-text-secondary);max-width:68ch;margin-bottom:8px}
.lead{font-size:16px;line-height:24px}
.swatches{display:grid;grid-template-columns:repeat(auto-fill,minmax(168px,1fr));gap:12px}
.swatch{background:var(--c-surface);border:1px solid var(--c-border);border-radius:var(--r-lg);padding:10px}
.chip-color{height:52px;border-radius:var(--r-sm);border:1px solid var(--c-border);margin-bottom:8px}
table{border-collapse:collapse;width:100%;background:var(--c-surface);border:1px solid var(--c-border);border-radius:var(--r-lg)}
th,td{text-align:left;padding:8px 12px;border-bottom:1px solid var(--c-border);vertical-align:top}
td.pass{color:var(--c-success);font-weight:500}td.warn{color:var(--c-warning);font-weight:500}td.fail{color:var(--c-danger);font-weight:500}
table.kv{max-width:420px}
.type-row{display:grid;grid-template-columns:200px 1fr;gap:16px;align-items:baseline;padding:12px 0;border-bottom:1px solid var(--c-border)}
.type-sample{overflow-wrap:anywhere}
.scale-row{display:flex;align-items:center;gap:12px;margin:6px 0}.scale-row code{width:48px}.bar{height:12px;background:var(--c-accent-primary);border-radius:6px;display:block}
.radii,.icons,.shadows,.row,.cards{display:flex;gap:12px;flex-wrap:wrap;align-items:center}
.radius-box{width:96px;height:72px;background:var(--c-surface);border:1px solid var(--c-border-strong);padding:8px}
.icon-demo{display:flex;flex-direction:column;align-items:center;gap:4px;color:var(--c-accent-text)}
.shadow-box{width:120px;height:72px;border-radius:var(--r-lg);background:var(--c-surface-elevated);padding:8px}
.motion-row{display:grid;grid-template-columns:80px 64px 1fr;gap:12px;align-items:center;margin:10px 0}
.motion-track{height:12px;background:var(--c-surface-muted);border-radius:6px;position:relative}
.motion-dot{position:absolute;left:0;top:0;width:12px;height:12px;border-radius:6px;background:var(--c-accent-primary)}
#motion.play .motion-dot{animation:slide var(--d) var(--ease) forwards}
@keyframes slide{to{left:calc(100% - 12px)}}
.replay,.pill,.round{font:inherit;cursor:pointer}
.replay{padding:8px 16px;border-radius:var(--r-pill);border:1.5px solid var(--c-border-strong);background:transparent;color:var(--c-text-primary);margin:8px 0}
.pill{min-height:46px;padding:0 18px;border-radius:var(--r-pill);border:1px solid transparent;font-weight:500;display:inline-flex;align-items:center;justify-content:center;gap:8px;transition:transform 120ms var(--ease),opacity 120ms var(--ease)}
.pill:active{transform:scale(.97);opacity:.94}
.pill.sm{min-height:44px}
.pill.primary{background:var(--c-action-primary);color:var(--c-on-action-primary)}
.pill.primary.accent{background:var(--c-accent-primary);color:var(--c-on-accent)}
.pill.secondary{background:var(--c-surface-muted);color:var(--c-text-primary)}
.pill.outline{background:transparent;border:1.5px solid var(--c-border-strong);color:var(--c-text-primary)}
.pill.ghost{background:transparent;color:var(--c-text-primary)}
.pill.primary.selected{background:var(--c-accent-primary);color:var(--c-on-action-primary)}
.pill.secondary.selected{background:var(--c-accent-primary-soft);border:1.5px solid var(--c-accent-primary);color:var(--c-accent-text)}
.pill:disabled{background:var(--c-disabled-surface);border:1px solid var(--c-disabled-border);color:var(--c-disabled-text);cursor:not-allowed}
.pill.outline:disabled{background:transparent}
.round{width:42px;height:42px;border-radius:var(--r-pill);background:var(--c-surface);color:var(--c-text-primary);border:0;display:grid;place-items:center}
.round.small{width:36px;height:36px}
.card{background:var(--c-surface);border-radius:var(--r-lg);padding:${DsSpace.lg}px;min-width:160px}
.card.muted{background:var(--c-surface-muted)}.card.warning{background:var(--c-surface-warning)}
.cards.two .opt{flex:1;min-width:150px}
.banner{display:flex;align-items:center;gap:${DsSpace.sm}px;background:var(--c-warning-soft);color:var(--c-warning);border-radius:${DsRadius.sm}px;padding:10px ${DsSpace.md}px;font-size:12px;font-weight:500}
.skeleton{display:grid;gap:12px;max-width:320px;animation:pulse 1.6s ease-in-out infinite alternate}
.skeleton .bar{height:14px;background:var(--c-surface-muted);border-radius:var(--r-sm)}.skeleton .bar.t{height:20px;width:45%}.skeleton .bar.s{width:70%}
@keyframes pulse{to{opacity:.5}}
.chipx{border:1.5px solid var(--c-border);background:var(--c-surface);border-radius:var(--r-pill);padding:10px 14px;font:500 13px/18px 'Geist',sans-serif}
.chipx.on{background:var(--c-accent-primary);border-color:var(--c-accent-primary);color:var(--c-on-accent)}
.chipx.off{background:var(--c-disabled-surface);border-color:var(--c-disabled-border);color:var(--c-disabled-text)}
.switch{width:44px;height:26px;border-radius:var(--r-pill);background:var(--c-disabled-border);padding:3px;display:inline-block}
.switch i{display:block;width:20px;height:20px;border-radius:10px;background:var(--c-switch-thumb);box-shadow:0 2px 3px rgba(0,0,0,.3);transition:transform 120ms var(--ease)}
.switch.on{background:var(--c-accent-primary)}.switch.on i{transform:translateX(18px)}
.opt{background:var(--c-surface);border:1.5px solid var(--c-border);border-radius:var(--r-xxl);padding:14px;min-height:96px}
.opt .tile{display:grid;place-items:center;width:34px;height:34px;border-radius:11px;margin-bottom:10px;font-size:17px}
.opt b{font-size:13.5px;line-height:18px;display:block}.opt small{font-size:11px;line-height:15px;margin-top:2px}
.field{display:flex;align-items:center;min-height:52px;background:var(--c-surface);border:1px solid var(--c-border-strong);border-radius:var(--r-lg);max-width:360px}
.field:focus-within{border-color:var(--c-accent-primary)}
.field .prefix{white-space:nowrap;padding:0 14px;font-weight:500;color:var(--c-text-secondary)}.field .sep{width:1px;height:24px;background:var(--c-border)}
.field input{all:unset;flex:1;padding:12px 14px;font:400 15px/20px 'Geist',sans-serif;color:var(--c-text-primary);min-height:26px}
.field input::placeholder{color:var(--c-text-tertiary)}
.progress{display:flex;align-items:center;gap:12px;margin-bottom:16px}.progress>div{flex:1}
.eyebrow{${typeRule('eyebrow')};color:var(--c-text-tertiary)}
.segs{display:flex;gap:6px;margin-top:6px}.segs i{flex:1;height:4px;border-radius:var(--r-pill);background:var(--c-surface-muted)}.segs i.on{background:var(--c-accent-primary)}
.segs i.cur{background:linear-gradient(90deg,var(--c-accent-primary) 100%,transparent 0)}
.notice{max-width:360px;display:grid;gap:12px}
.avatar{width:56px;height:56px;border-radius:9999px;background:var(--c-accent-primary-soft);color:var(--c-accent-text);display:grid;place-items:center;font:700 20px/1 'Geist',sans-serif}
.avatar.arch{border-radius:28px 28px 16px 16px;height:72px}
.fields{display:flex;gap:16px;flex-wrap:wrap}.fieldwrap{width:min(100%,280px);display:grid;gap:6px}
.fieldwrap label{font:700 13px/18px 'Geist',sans-serif}
.field.error{border:1.5px solid var(--c-danger)}.field.disabled{background:var(--c-disabled-surface);border-color:var(--c-disabled-border)}.field.disabled input{color:var(--c-disabled-text)}
small.err{color:var(--c-danger);display:flex;gap:6px;align-items:center}
.sechead{display:flex;justify-content:space-between;align-items:center;padding:8px 0}
.link{all:unset;cursor:pointer;color:var(--c-accent-text);font-weight:500;padding:12px 4px}
.divider{border:0;height:1px;background:var(--c-border);margin:0}.divider.inset{margin-left:56px}
.card.list{padding:0 16px;max-width:420px}.lrow{display:flex;align-items:center;gap:12px;min-height:64px}.ltext{flex:1}.ltext b{font:700 16px/22px 'Geist',sans-serif;display:block}
.dot{width:8px;height:8px;border-radius:9999px;background:var(--c-accent-primary)}
.avatar.xs{width:32px;height:32px;font-size:14px}.avatar.s{width:40px;height:40px;font-size:16px}
.avatar.presence{position:relative}.avatar.presence::after{content:'';position:absolute;right:2px;bottom:2px;width:12px;height:12px;border-radius:9999px;background:var(--c-success);border:2px solid var(--c-canvas)}
.notices{display:grid;gap:12px;max-width:380px}.notice{border-radius:var(--r-lg);padding:16px;display:grid;gap:8px;box-shadow:0 10px 24px rgba(0,0,0,.12)}
.notice.tone-info{background:var(--c-accent-primary-soft)}.notice.tone-warning{background:var(--c-warning-soft)}.notice.tone-warning b{color:var(--c-warning)}
.card.empty{max-width:360px;display:grid;gap:8px}.card.empty p{margin:0}
.sheetdemo{position:relative;max-width:420px;height:240px;border-radius:var(--r-lg);overflow:hidden;background:var(--c-canvas);border:1px solid var(--c-border)}
.scrim{position:absolute;inset:0;background:var(--c-overlay-neutral)}
.sheet{position:absolute;left:0;right:0;bottom:0;background:var(--c-surface-elevated);border-radius:var(--r-xxl) var(--r-xxl) 0 0;padding:12px 20px 20px;display:grid;gap:8px}
.grab{width:40px;height:4px;border-radius:9999px;background:var(--c-border-strong);justify-self:center}.sheethead{display:flex;justify-content:space-between;align-items:center}.sheethead b{font:700 20px/26px 'Geist',sans-serif}
.wrap{align-items:flex-start}
.phone{width:min(100%,360px);min-height:620px;background:var(--c-canvas);border:1px solid var(--c-border-strong);border-radius:36px;padding:28px var(--gutter) 22px;display:flex;flex-direction:column;box-shadow:0 10px 24px rgba(0,0,0,.12);margin-top:12px}
.display{${typeRule('display')}}.lede{margin:8px 0 18px}
.phone-foot{margin-top:auto;padding-top:16px}.phone-foot .pill{width:100%}
@media (max-width:640px){.type-row{grid-template-columns:1fr;gap:4px}}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}
h4{font-size:13px;line-height:18px;font-weight:700;margin:20px 0 6px;color:var(--c-text-primary)}
.kv-demo{display:flex;flex-direction:column;gap:8px;max-width:280px}
.kv-demo b{color:var(--c-text-primary)}
.reward-bar{height:8px;border-radius:var(--r-pill);background:var(--c-surface-muted);overflow:hidden}
.reward-bar>b{display:block;height:100%;border-radius:var(--r-pill);background:var(--c-accent-primary)}
.reward-ring{position:relative;width:64px;height:64px}
.reward-ring svg{transform:rotate(-90deg)}
.reward-ring span{position:absolute;inset:0;display:grid;place-items:center;font:700 13px/18px 'Geist',sans-serif;color:var(--c-text-primary)}
.medals{display:flex;gap:16px;flex-wrap:wrap;align-items:flex-end;margin:8px 0}
.medal-figure{display:flex;flex-direction:column;align-items:center;gap:4px;color:var(--c-text-primary)}
.medal-figure.locked{opacity:.4}
.medal-art{position:relative}
.medal-glyph{position:absolute;inset:0;display:grid;place-items:center}
.confetti-demo{position:relative;width:280px;height:120px;border:1px dashed var(--c-border-strong);border-radius:var(--r-lg);overflow:hidden;margin:8px 0}
.confetti-demo i{position:absolute;border-radius:2px}
.notice.reward{display:flex;gap:12px;align-items:flex-start;position:relative;max-width:380px}
.notice-icon{flex:none;width:24px;height:24px;color:var(--c-accent-text)}
.notice-content{display:flex;flex-direction:column;gap:8px;flex:1;min-width:0;padding-right:24px}
.notice-content b{font:700 16px/22px 'Geist',sans-serif;color:var(--c-text-primary)}
.reward-close{all:unset;position:absolute;top:9px;right:8px;width:44px;height:44px;display:grid;place-items:center;border-radius:var(--r-pill);color:var(--c-text-secondary);cursor:pointer}
.reward-close:focus-visible{outline:3px solid var(--c-accent-primary);outline-offset:-3px}
`;

const SCRIPT = `
(function () {
  var root = document.documentElement;
  var buttons = document.querySelectorAll('.theme button');
  function apply(mode) {
    if (mode === 'system') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', mode);
    buttons.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.mode === mode)); });
  }
  var saved = 'system';
  try { saved = localStorage.getItem('ds-theme') || 'system'; } catch (e) {}
  apply(saved);
  buttons.forEach(function (b) {
    b.addEventListener('click', function () {
      apply(b.dataset.mode);
      try { localStorage.setItem('ds-theme', b.dataset.mode); } catch (e) {}
    });
  });
  document.getElementById('motion').classList.add('play');
})();
`;

export function renderSpecimen(): string {
  return `<!doctype html>
<!-- Generated by apps/mobile/scripts/design-system/specimen.ts from constants/design-system.ts. Do not edit by hand: run \`yarn ds:specimen\` from apps/mobile. -->
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light dark" />
<title>Comradia Design System</title>
<style>${CSS}</style>
</head>
<body>
<header class="top"><div class="bar-row">
  <b>Comradia design system</b>
  <nav aria-label="Sections"><a href="#color">Color</a><a href="#type">Type</a><a href="#scales">Scales</a><a href="#motion">Motion</a><a href="#components">Components</a><a href="#patterns">Patterns</a></nav>
  <div class="theme" role="group" aria-label="Theme"><button type="button" data-mode="system" aria-pressed="true">System</button><button type="button" data-mode="light" aria-pressed="false">Light</button><button type="button" data-mode="dark" aria-pressed="false">Dark</button></div>
</div></header>
<main>
  <h1 class="page">Design system specimen</h1>
  <p class="lead">Every token and primitive of the app, rendered from <code>apps/mobile/constants/design-system.ts</code>. The rules for using them are in <code>docs/design-system.md</code>.</p>
  ${colorSection()}
  ${typographySection()}
  ${scalesSection()}
  ${motionSection()}
  ${componentsSection()}
  ${patternSection()}
</main>
<script>${SCRIPT}</script>
</body>
</html>
`;
}
