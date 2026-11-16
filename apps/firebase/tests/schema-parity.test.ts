import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  LOOKING_FOR,
  PROMPT_IDS,
  UNIONS,
  VALUE_IDS,
  VIBES,
} from '../../mobile/features/profile/profile-schema';
import { RULES } from './helpers';

/**
 * Read an option list straight out of firestore.rules: the rules cannot import the
 * app's TypeScript, so the two lists are copies that this test keeps equal.
 */
function rulesList(name: string): string[] {
  const body = new RegExp(`function ${name}\\(\\)\\s*\\{\\s*return \\[([\\s\\S]*?)\\];`).exec(RULES);
  assert.ok(body, `${name}() not found in firestore.rules`);
  return [...body[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
}

const CASES: [string, readonly string[]][] = [
  ['vibes', VIBES],
  ['lookingFor', LOOKING_FOR],
  ['valueIds', VALUE_IDS],
  ['unions', UNIONS],
  ['promptIds', PROMPT_IDS],
];

describe('firestore.rules option lists match profile-schema.ts', () => {
  for (const [fn, exported] of CASES) {
    it(`${fn}() matches ${exported.length} exported ids in order`, () => {
      assert.ok(exported.length > 0, 'exported list must not be empty');
      assert.deepEqual(rulesList(fn), [...exported]);
    });
  }

  it('has no duplicated ids', () => {
    for (const [fn] of CASES) {
      const ids = rulesList(fn);
      assert.equal(new Set(ids).size, ids.length, `${fn}() has duplicates`);
    }
  });
});
