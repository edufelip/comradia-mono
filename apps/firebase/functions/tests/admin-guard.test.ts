import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { HttpsError } from 'firebase-functions/v2/https';
import { gamAdminActor, type GamAdminAuth } from '../src/gamification/admin/guard.js';

/** assert.rejects matcher: an HttpsError with the given code. */
function httpsError(code: string): (error: unknown) => boolean {
  return (error) => error instanceof HttpsError && error.code === code;
}

describe('gamAdminActor', () => {
  it('rejects an unauthenticated request', () => {
    assert.throws(() => gamAdminActor(undefined), httpsError('unauthenticated'));
    const emptyUid: GamAdminAuth = { uid: '', token: { gamAdmin: true } };
    assert.throws(() => gamAdminActor(emptyUid), httpsError('unauthenticated'));
  });

  it('rejects a signed-in user without the gamAdmin claim', () => {
    const auth: GamAdminAuth = { uid: 'admin-1', token: { } };
    assert.throws(() => gamAdminActor(auth), httpsError('permission-denied'));
  });

  it('rejects a claim that is not exactly true', () => {
    assert.throws(
      () => gamAdminActor({ uid: 'admin-1', token: { gamAdmin: 'true' } }),
      httpsError('permission-denied'),
    );
    assert.throws(
      () => gamAdminActor({ uid: 'admin-1', token: { gamAdmin: 1 } }),
      httpsError('permission-denied'),
    );
  });

  it('returns the uid of a gamAdmin', () => {
    const actor = gamAdminActor({ uid: 'admin-1', token: { gamAdmin: true } });
    assert.deepEqual(actor, { uid: 'admin-1' });
  });
});
