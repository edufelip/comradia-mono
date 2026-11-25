import assert from 'node:assert/strict';
import { it } from 'node:test';
import { editedSection, earningPreview } from '../src/editor.ts';

const draft = { version: 2, status: 'draft', earnRules: [
  { id: 'start', event: 'conversation.started', award: { amount: 30 }, caps: { perDay: 3 } },
], quests: [] };

it('edits one versioned section without mutating the draft and previews the proposed cap', () => {
  const text = JSON.stringify([{ id: 'start', event: 'conversation.started', award: { amount: 40 }, caps: { perDay: 2 } }]);
  const next = editedSection(draft, 'earnRules', text);
  assert.deepEqual(earningPreview(next), [
    { id: 'start', event: 'conversation.started', amount: 40, dailyMaximum: 80 },
  ]);
  assert.equal(earningPreview(draft)[0].amount, 30);
  assert.equal(next.version, 2);
  assert.deepEqual(next.quests, []);
});

it('rejects editing version metadata or replacing an array with a scalar', () => {
  assert.throws(() => editedSection(draft, 'version', '1'));
  assert.throws(() => editedSection(draft, 'earnRules', '1'));
  assert.throws(() => editedSection(draft, 'earnRules', '['));
});
