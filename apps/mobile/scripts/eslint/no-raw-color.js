// @ts-check
/**
 * Design-system guard: UI code must take colors from `getDsTheme()` (or `DsArt` for the
 * welcome artwork), never from a literal. The tokens live in `constants/design-system.ts`,
 * which this rule is not applied to. See docs/design-system.md.
 *
 * Flags hex (`#fff`, `#ffffff`, `#ffffff80`), the CSS color functions (`rgb()`, `hsl()`,
 * `hwb()`, `lab()`, `lch()`, `oklab()`, `oklch()`, `color()`, `color-mix()`) in string literals
 * and template strings, and a string that is exactly a named color (`'white'`, `'red'`). A `${token}22` alpha suffix on a token is fine and is not
 * matched. For a rare, justified exception use
 * `// eslint-disable-next-line comradia/no-raw-color -- <reason>`.
 */
const HEX = /(?<![0-9a-z_-])#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{4}|[0-9a-f]{3})(?![0-9a-z_-])/i;
const FUNCTIONAL = /(?<![0-9a-z_-])(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\(/i;
// Whole-string match only: words like 'red' inside copy or identifiers must not be flagged.
// `transparent` and `currentColor` are not palette colors and stay allowed.
const NAMED =
  /^(?:white|black|red|green|blue|yellow|orange|purple|pink|gray|grey|silver|gold|brown|cyan|magenta|teal|navy|maroon|olive|lime|aqua|fuchsia|coral|crimson|salmon|tomato|indigo|violet)$/i;

/** @param {string} text */
function findRawColor(text) {
  const hex = HEX.exec(text);
  if (hex) return hex[0];
  const functional = FUNCTIONAL.exec(text);
  if (functional) return functional[0];
  const trimmed = text.trim();
  return NAMED.test(trimmed) ? trimmed : null;
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow raw color literals in UI code; use design-system tokens.' },
    schema: [],
    messages: {
      rawColor:
        'Raw color "{{found}}": take colors from getDsTheme(scheme).color (see docs/design-system.md).',
    },
  },
  create(context) {
    /** @param {import('estree').Node} node @param {string} text */
    function check(node, text) {
      const found = findRawColor(text);
      if (found) context.report({ node, messageId: 'rawColor', data: { found } });
    }

    return {
      Literal(node) {
        if (typeof node.value === 'string') check(node, node.value);
      },
      TemplateElement(node) {
        check(node, node.value.cooked ?? node.value.raw);
      },
    };
  },
};

module.exports = { rule, findRawColor };
