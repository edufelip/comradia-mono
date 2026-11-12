import assert from 'node:assert/strict';
import { test } from 'node:test';
import { phoneFailureSummary } from './phone-diagnostics';

void test('retains only the symbolic Firebase auth code and recognized error class', () => {
  assert.deepEqual(
    phoneFailureSummary({ code: 'auth/internal-error', name: 'NativeFirebaseError' }),
    { sdkCode: 'auth/internal-error', errorType: 'NativeFirebaseError' },
  );
});
void test('identifies a JavaScript failure without inventing a provider code', () => {
  assert.deepEqual(phoneFailureSummary(new TypeError('private payload')), {
    sdkCode: null,
    errorType: 'TypeError',
  });
});
void test('omits arbitrary code, names, message, phone, credentials and verification contents', () => {
  const summary = phoneFailureSummary({
    name: 'private-name',
    code: 'private-code',
    message: 'private-message',
    phone: 'private-phone',
    credential: 'private-credential',
  });
  assert.deepEqual(summary, { sdkCode: null, errorType: 'Error' });
  assert.equal(JSON.stringify(summary).includes('private'), false);
});
void test('cannot mask the original failure when an error property getter throws', () => {
  assert.deepEqual(
    phoneFailureSummary({
      get code() {
        throw new Error('private');
      },
    }),
    { sdkCode: null, errorType: 'Error' },
  );
});
