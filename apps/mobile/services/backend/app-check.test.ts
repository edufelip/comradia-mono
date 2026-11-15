import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { appCheckProviderOptions, shouldInitializeWebAppCheck } from './app-check';

const attestation = {
  android: { provider: 'playIntegrity' },
  apple: { provider: 'appAttestWithDeviceCheckFallback' },
};

describe('appCheckProviderOptions', () => {
  it('uses the debug provider with the trimmed token when one is set', () => {
    assert.deepEqual(appCheckProviderOptions('  dev-token-123 \n', 'dev'), {
      android: { provider: 'debug', debugToken: 'dev-token-123' },
      apple: { provider: 'debug', debugToken: 'dev-token-123' },
    });
  });

  it('uses the real attestation providers when the token is missing or blank', () => {
    assert.deepEqual(appCheckProviderOptions(undefined, 'dev'), attestation);
    assert.deepEqual(appCheckProviderOptions('', 'dev'), attestation);
    assert.deepEqual(appCheckProviderOptions('   ', 'dev'), attestation);
  });
});

it('ignores a debug token for production and unknown variants', () => {
  for (const variant of ['prod', undefined, 'unexpected']) {
    assert.deepEqual(appCheckProviderOptions('dev-token-123', variant), attestation);
  }
});

describe('shouldInitializeWebAppCheck', () => {
  it('requires a non-empty site key and skips all emulator hosts', () => {
    assert.equal(shouldInitializeWebAppCheck(null, 'site-key'), true);
    assert.equal(shouldInitializeWebAppCheck(null, '  site-key  '), true);
    assert.equal(shouldInitializeWebAppCheck(null, undefined), false);
    assert.equal(shouldInitializeWebAppCheck(null, '  '), false);
    assert.equal(shouldInitializeWebAppCheck('127.0.0.1', 'site-key'), false);
  });
});
