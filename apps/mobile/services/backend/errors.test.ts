import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BackendError, toBackendError, type BackendErrorCode } from './errors';

/** Every key of FIREBASE_CODES in errors.ts, with the code it must map to. */
const MAPPINGS: [string, BackendErrorCode][] = [
  ['auth/invalid-phone-number', 'invalid_phone'],
  ['auth/missing-phone-number', 'invalid_phone'],
  ['auth/invalid-verification-code', 'invalid_code'],
  ['auth/missing-verification-code', 'invalid_code'],
  ['auth/code-expired', 'code_expired'],
  ['auth/session-expired', 'code_expired'],
  ['auth/too-many-requests', 'too_many_requests'],
  ['auth/quota-exceeded', 'too_many_requests'],
  ['auth/network-request-failed', 'network'],
  ['auth/popup-closed-by-user', 'cancelled'],
  ['auth/cancelled-popup-request', 'cancelled'],
  ['auth/user-cancelled', 'cancelled'],
  // Google Sign-In and Apple cancellations.
  ['SIGN_IN_CANCELLED', 'cancelled'],
  ['12501', 'cancelled'],
  ['ERR_REQUEST_CANCELED', 'cancelled'],
  ['ERR_CANCELED', 'cancelled'],
];

describe('toBackendError', () => {
  for (const [firebaseCode, expected] of MAPPINGS) {
    it(`maps ${firebaseCode} to ${expected}`, () => {
      const error = toBackendError({ code: firebaseCode });
      assert.equal(error.code, expected);
      assert.equal(error.name, 'BackendError');
      assert.equal(error.message, expected);
    });
  }

  it('falls back to unknown for an unmapped code', () => {
    assert.equal(toBackendError({ code: 'auth/something-new' }).code, 'unknown');
    // The lookup is exact: no prefix matching or trimming.
    assert.equal(toBackendError({ code: ' auth/code-expired ' }).code, 'unknown');
    assert.equal(toBackendError({ code: 'AUTH/CODE-EXPIRED' }).code, 'unknown');
  });

  it('falls back to unknown for values that are not objects with a code', () => {
    for (const value of [null, undefined, 'auth/too-many-requests', 42, true, [], {}]) {
      const error = toBackendError(value);
      assert.ok(error instanceof BackendError);
      assert.equal(error.code, 'unknown');
    }
  });

  it('stringifies a non-string code before looking it up', () => {
    assert.equal(toBackendError({ code: 12501 }).code, 'cancelled');
    assert.equal(toBackendError({ code: null }).code, 'unknown');
  });

  it('passes a BackendError through unchanged', () => {
    const original = new BackendError('too_many_requests', new Error('cause'));
    assert.equal(toBackendError(original), original);
  });

  it('keeps the original error as the cause', () => {
    const cause = Object.assign(new Error('boom'), { code: 'auth/network-request-failed' });
    assert.equal(toBackendError(cause).cause, cause);
  });

  it('is not confused by an Error whose message looks like a code', () => {
    assert.equal(toBackendError(new Error('auth/code-expired')).code, 'unknown');
  });
});
