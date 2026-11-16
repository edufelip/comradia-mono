import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';
import { Linter } from 'eslint';

const require = createRequire(import.meta.url);
const { rule, findRawColor } = require('./no-raw-color.js') as {
  rule: import('eslint').Rule.RuleModule;
  findRawColor: (text: string) => string | null;
};

function lint(code: string) {
  const linter = new Linter();
  return linter.verify(
    code,
    [
      {
        files: ['**/*.js'],
        plugins: { comradia: { rules: { 'no-raw-color': rule } } },
        rules: { 'comradia/no-raw-color': 'error' },
        languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
      },
    ],
    'sample.js',
  );
}

describe('comradia/no-raw-color', () => {
  it('flags hex colors of every length', () => {
    for (const color of ['#fff', '#FFFA', '#ffffff', '#ffffff80']) {
      const messages = lint(`const style = { color: '${color}' };`);
      assert.equal(messages.length, 1, color);
      assert.equal(messages[0]?.ruleId, 'comradia/no-raw-color');
    }
  });

  it('flags named colors and modern color functions', () => {
    for (const color of ['white', 'Red', 'oklch(0.7 0.1 20)', 'color-mix(in srgb, red, blue)']) {
      assert.equal(lint(`const c = '${color}';`).length, 1, color);
    }
  });

  it('does not flag words that merely contain a color name or a # inside an identifier', () => {
    for (const text of ['white space', 'redo', 'page#add', 'transparent', 'currentColor']) {
      assert.equal(lint(`const c = '${text}';`).length, 0, text);
    }
  });

  it('flags rgb, rgba, hsl and hsla', () => {
    for (const color of ['rgb(0, 0, 0)', 'rgba(0,0,0,.3)', 'hsl(0 0% 0%)', 'hsla(0, 0%, 0%, 1)']) {
      assert.equal(lint(`const c = '${color}';`).length, 1, color);
    }
  });

  it('flags a color inside a template string and inside an SVG attribute value', () => {
    assert.equal(lint('const c = `1px solid #d92d3a`;').length, 1);
    assert.equal(lint("setAttribute('stop-color', '#fff');").length, 1);
  });

  it('allows tokens, alpha suffixes on tokens, transparent and non-color hashes', () => {
    for (const code of [
      'const c = theme.color.accentPrimary;',
      'const c = `${accent}22`;',
      "const c = 'transparent';",
      "const url = '/matches#top';",
      "const id = 'item-#12345678-extra';",
      "const issue = '#1234567';",
      'const n = 0xffffff;',
    ]) {
      assert.deepEqual(lint(code), [], code);
    }
  });

  it('can be silenced with a disable comment that carries a reason', () => {
    const code =
      "// eslint-disable-next-line comradia/no-raw-color -- browser chrome\nconst c = '#fff';";
    assert.deepEqual(lint(code), []);
  });

  it('findRawColor returns the offending text', () => {
    assert.equal(findRawColor('border: 1px solid #D92D3A'), '#D92D3A');
    assert.equal(findRawColor('plain text'), null);
  });
});
