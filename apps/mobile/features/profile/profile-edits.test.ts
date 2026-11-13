import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildProfileEdits, validProfileEdits, type ProfileEdits } from './profile-edits';

const valid: ProfileEdits = {
  displayName: 'Ana',
  vibe: 'bookworm',
  lookingFor: 'everyone',
  unionMember: true,
  union: 'apeoesp',
  values: ['cycling', 'tenant_rights', 'bookshops_coffee'],
  promptId: 'perfect_sunday',
  promptAnswer: 'A nice walk.',
};
void describe('validProfileEdits', () => {
  void it('accepts valid profile edits and trimmed boundary values', () => {
    assert.equal(validProfileEdits(valid), true);
    assert.equal(
      validProfileEdits({
        ...valid,
        displayName: ' '.repeat(0) + 'A'.repeat(40),
        promptAnswer: 'a'.repeat(280),
      }),
      true,
    );
  });
  void it('rejects invalid fields and schema bounds', () => {
    for (const edit of [
      { ...valid, displayName: ' ' },
      { ...valid, displayName: 'a'.repeat(41) },
      { ...valid, vibe: 'invalid' },
      { ...valid, lookingFor: 'invalid' },
      { ...valid, unionMember: false },
      { ...valid, union: 'invalid' },
      { ...valid, values: ['cycling', 'cycling', 'tenant_rights'] },
      { ...valid, values: ['cycling', 'bad', 'tenant_rights'] },
      { ...valid, values: ['cycling', 'tenant_rights'] },
      { ...valid, values: [...valid.values, 'climate_outdoors', 'pets_parks', 'public_transit'] },
      { ...valid, promptId: 'bad' },
      { ...valid, promptAnswer: ' ' },
      { ...valid, promptAnswer: 'a'.repeat(281) },
    ] as ProfileEdits[])
      assert.equal(validProfileEdits(edit), false);
  });
});

void it('builds only editable fields, trimming text and copying values', () => {
  const input = {
    ...valid,
    displayName: '  Ana  ',
    promptAnswer: '  Hello  ',
    age: 99,
    photoPath: 'bad',
    createdAt: 123,
  };
  const result = buildProfileEdits(input);
  assert.deepEqual(result, { ...valid, displayName: 'Ana', promptAnswer: 'Hello' });
  assert.notEqual(result.values, input.values);
  assert.throws(() => buildProfileEdits({ ...valid, displayName: '' }));
});
