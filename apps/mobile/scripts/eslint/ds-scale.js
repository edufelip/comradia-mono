// @ts-check
/**
 * Design-system guard for scales: spacing, radius, border width and text metrics in style
 * objects must come from the tokens in `constants/design-system.ts`, not from literals.
 * Companion to `no-raw-color`. See docs/design-system.md.
 *
 * - padding*, margin*, gap: a number must be 0 or a `DsSpace` value.
 * - border*Radius: 0 or a `DsRadius` value.
 * - border*Width: 0 or a `DsBorder` value.
 * - fontSize, lineHeight, letterSpacing, fontWeight, fontFamily: no literal at all; spread a
 *   `DsTypography` style (and override only the color).
 *
 * Values computed at runtime (`width * 0.36`) and token references are never flagged. For a
 * justified exception (artwork, a measured size) use
 * `// eslint-disable-next-line comradia/ds-scale -- <reason>`.
 * The allowed lists must equal the tokens; `ds-scale.test.ts` checks that.
 */
const SPACE = [0, 4, 8, 12, 16, 20, 24, 32];
const RADIUS = [0, 12, 16, 20, 9999];
const BORDER = [0, 1, 1.5, 3];

const SPACING_KEY =
  /^(?:padding|margin)(?:Top|Bottom|Left|Right|Horizontal|Vertical|Start|End)?$|^(?:gap|rowGap|columnGap)$/;
const RADIUS_KEY =
  /^border(?:(?:Top|Bottom)(?:Left|Right|Start|End)|Start(?:Start|End)|End(?:Start|End))?Radius$/;
const BORDER_KEY = /^border(?:Top|Bottom|Left|Right|Start|End)?Width$/;
const TEXT_KEY = /^(?:fontSize|lineHeight|letterSpacing|fontWeight|fontFamily)$/;

/** @param {import('estree').Property} node */
function keyName(node) {
  if (node.computed) return null;
  if (node.key.type === 'Identifier') return node.key.name;
  if (node.key.type === 'Literal' && typeof node.key.value === 'string') return node.key.value;
  return null;
}

/** @param {import('estree').Node} value @returns {number | string | null} */
function literalValue(value) {
  if (
    value.type === 'Literal' &&
    (typeof value.value === 'number' || typeof value.value === 'string')
  ) {
    return value.value;
  }
  if (
    value.type === 'UnaryExpression' &&
    (value.operator === '-' || value.operator === '+') &&
    value.argument.type === 'Literal' &&
    typeof value.argument.value === 'number'
  ) {
    return value.operator === '-' ? -value.argument.value : value.argument.value;
  }
  return null;
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: { description: 'Require design-system scales for spacing, radius, borders and text.' },
    schema: [],
    messages: {
      space: '{{key}}: {{value}} is not on the spacing scale ({{allowed}}). Use DsSpace.',
      radius: '{{key}}: {{value}} is not a radius token ({{allowed}}). Use DsRadius.',
      border: '{{key}}: {{value}} is not a border width token ({{allowed}}). Use DsBorder.',
      text: '{{key}}: literal text metrics are not allowed. Spread a DsTypography style.',
    },
  },
  create(context) {
    return {
      Property(node) {
        const key = keyName(node);
        if (!key) return;
        const value = literalValue(/** @type {import('estree').Node} */ (node.value));
        if (value === null) return;

        if (SPACING_KEY.test(key)) {
          if (typeof value === 'number' && !SPACE.includes(Math.abs(value))) {
            context.report({
              node,
              messageId: 'space',
              data: { key, value: String(value), allowed: SPACE.join(', ') },
            });
          }
        } else if (RADIUS_KEY.test(key)) {
          if (typeof value === 'number' && !RADIUS.includes(value)) {
            context.report({
              node,
              messageId: 'radius',
              data: { key, value: String(value), allowed: RADIUS.join(', ') },
            });
          }
        } else if (BORDER_KEY.test(key)) {
          if (typeof value === 'number' && !BORDER.includes(value)) {
            context.report({
              node,
              messageId: 'border',
              data: { key, value: String(value), allowed: BORDER.join(', ') },
            });
          }
        } else if (TEXT_KEY.test(key)) {
          context.report({ node, messageId: 'text', data: { key } });
        }
      },
    };
  },
};

module.exports = { rule, SPACE, RADIUS, BORDER };
