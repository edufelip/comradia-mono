import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { appCheckProviderOptions } from './app-check';

const attestation = {
  android: { provider: 'playIntegrity' },
  apple: { provider: 'appAttestWithDeviceCheckFallback' },
};

describe('appCheckProviderOptions', () => {
  it('uses the debug provider with the trimmed token when one is set', () => {
    assert.deepEqual(appCheckProviderOptions('  dev-token-123 \n'), {
      android: { provider: 'debug', debugToken: 'dev-token-123' },
      apple: { provider: 'debug', debugToken: 'dev-token-123' },
    });
  });

  it('uses the real attestation providers when the token is missing or blank', () => {
    assert.deepEqual(appCheckProviderOptions(undefined), attestation);
    assert.deepEqual(appCheckProviderOptions(''), attestation);
    assert.deepEqual(appCheckProviderOptions('   '), attestation);
  });
});
