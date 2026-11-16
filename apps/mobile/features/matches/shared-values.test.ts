import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { sharedValues } from './shared-values';

describe('shared values', () => {
  it('keeps the values both cards list, in my order', () => {
    assert.deepEqual(
      sharedValues(['cycling', 'tenant_rights', 'pets_parks'], ['pets_parks', 'cycling']),
      ['cycling', 'pets_parks'],
    );
  });

  it('is empty when nothing is shared or my profile is not loaded', () => {
    assert.deepEqual(sharedValues(['cycling'], ['volunteering']), []);
    assert.deepEqual(sharedValues(undefined, ['cycling']), []);
    assert.deepEqual(sharedValues([], ['cycling']), []);
  });
});
