// @ts-check
/**
 * Design-system guard: UI code must take colors from `getDsTheme()` (or `DsArt` for the
 * welcome artwork), never from a literal. The tokens live in `constants/design-system.ts`,
 * which this rule is not applied to. See docs/design-system.md.
 *
 * Flags hex (`#fff`, `#ffffff`, `#ffffff80`), `rgb()/rgba()` and `hsl()/hsla()` in string
 * literals and template strings. A `${token}22` alpha suffix on a token is fine and is not
 * matched. For a rare, justified exception use
 * `// eslint-disable-next-line comradia/no-raw-color -- <reason>`.
 */
const HEX = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{4}|[0-9a-f]{3})(?![0-9a-z_-])/i;
const FUNCTIONAL = /\b(?:rgba?|hsla?)\(/i;

/** @param {string} text */
function findRawColor(text) {
  const hex = HEX.exec(text);
  if (hex) return hex[0];
  const functional = FUNCTIONAL.exec(text);
  return functional ? functional[0] : null;
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
