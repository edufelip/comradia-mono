import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  AUTH_EMULATOR_PORT,
  DEMO_PROJECT_ID,
  DISCOVERY_PAGE_SIZE,
  FIRESTORE_EMULATOR_PORT,
  emulatorHost,
} from './config';

// Read and written as a literal member expression: Expo inlines EXPO_PUBLIC_* that way,
// and the lint rule forbids dynamic access.
const originalEnv = process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST;

afterEach(() => {
  if (originalEnv === undefined) delete process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST;
  else process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST = originalEnv;
});

describe('emulatorHost', () => {
  it('trims the value', () => {
    assert.equal(emulatorHost('  127.0.0.1  '), '127.0.0.1');
    assert.equal(emulatorHost('10.0.2.2\n'), '10.0.2.2');
  });

  it('returns null for an empty or blank value', () => {
    assert.equal(emulatorHost(''), null);
    assert.equal(emulatorHost('   '), null);
    assert.equal(emulatorHost(undefined), null);
  });

  it('reads EXPO_PUBLIC_FIREBASE_EMULATOR_HOST when no argument is given', () => {
    process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST = ' 10.0.2.2 ';
    assert.equal(emulatorHost(), '10.0.2.2');

    process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST = '   ';
    assert.equal(emulatorHost(), null);
  });
});

describe('constants', () => {
  it('uses the demo project and the ports in firebase.json', () => {
    assert.equal(DEMO_PROJECT_ID, 'demo-comradia');
    assert.equal(AUTH_EMULATOR_PORT, 9099);
    assert.equal(FIRESTORE_EMULATOR_PORT, 8089);
  });

  it('asks for a page of profiles', () => {
    assert.equal(DISCOVERY_PAGE_SIZE, 50);
  });
});
