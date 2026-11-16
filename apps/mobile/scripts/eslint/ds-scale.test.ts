import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';
import { Linter } from 'eslint';
import { DsBorder, DsRadius, DsSpace } from '../../constants/design-system';

const require = createRequire(import.meta.url);
const { rule, SPACE, RADIUS, BORDER } = require('./ds-scale.js') as {
  rule: import('eslint').Rule.RuleModule;
  SPACE: number[];
  RADIUS: number[];
  BORDER: number[];
};

function lint(code: string) {
  return new Linter().verify(
    code,
    [
      {
        files: ['**/*.js'],
        plugins: { comradia: { rules: { 'ds-scale': rule } } },
        rules: { 'comradia/ds-scale': 'error' },
        languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
      },
    ],
    'sample.js',
  );
}

describe('comradia/ds-scale', () => {
  it('keeps its allowed lists equal to the design-system tokens', () => {
    assert.deepEqual(SPACE, [0, ...Object.values(DsSpace)]);
    assert.deepEqual(RADIUS, [0, ...Object.values(DsRadius)]);
    assert.deepEqual(BORDER, [0, ...Object.values(DsBorder)]);
  });

  it('flags spacing that is off the scale, including negatives', () => {
    for (const code of [
      'const s = { padding: 14 };',
      'const s = { paddingHorizontal: 22 };',
      'const s = { marginTop: -6 };',
      'const s = { gap: 10 };',
      "const s = { 'rowGap': 6 };",
    ]) {
      assert.equal(lint(code).length, 1, code);
    }
  });

  it('allows spacing on the scale, tokens, computed values and auto', () => {
    for (const code of [
      'const s = { padding: 16, gap: 8, margin: 0, marginTop: -8 };',
      'const s = { padding: DsSpace.md };',
      'const s = { paddingTop: insets.top + 16 };',
      "const s = { marginTop: 'auto' };",
      'const s = { width: 22, height: 14, top: 6 };',
    ]) {
      assert.deepEqual(lint(code), [], code);
    }
  });

  it('flags radius and border widths that are not tokens', () => {
    for (const code of [
      'const s = { borderRadius: 11 };',
      'const s = { borderTopLeftRadius: 22 };',
      'const s = { borderWidth: 2 };',
      'const s = { borderBottomWidth: 0.5 };',
    ]) {
      assert.equal(lint(code).length, 1, code);
    }
    for (const code of [
      'const s = { borderRadius: 16, borderWidth: 1.5, borderLeftWidth: 0 };',
      'const s = { borderRadius: 9999 };',
      'const s = { borderRadius: width / 2 };',
    ]) {
      assert.deepEqual(lint(code), [], code);
    }
  });

  it('flags literal text metrics and allows spread tokens and computed sizes', () => {
    for (const code of [
      'const s = { fontSize: 15 };',
      "const s = { fontWeight: '600' };",
      "const s = { fontFamily: 'Geist_700Bold' };",
      'const s = { lineHeight: 20 };',
      'const s = { letterSpacing: -1 };',
    ]) {
      assert.equal(lint(code).length, 1, code);
    }
    for (const code of [
      'const s = { ...DsTypography.body, color: c };',
      'const s = { fontSize: Math.max(14, width * 0.36) };',
      'const s = { fontFamily: DsFontFamily.bold };',
    ]) {
      assert.deepEqual(lint(code), [], code);
    }
  });

  it('can be silenced with a reasoned disable comment', () => {
    const code =
      '// eslint-disable-next-line comradia/ds-scale -- emoji glyph size\nconst s = { fontSize: 17 };';
    assert.deepEqual(lint(code), []);
  });
});
