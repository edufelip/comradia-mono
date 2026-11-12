import { after, before, beforeEach, describe, it } from 'node:test';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { testEnvironment } from './helpers';

let env: RulesTestEnvironment;
let alice: ReturnType<RulesTestEnvironment['authenticatedContext']>;
let bob: ReturnType<RulesTestEnvironment['authenticatedContext']>;
let signedOut: ReturnType<RulesTestEnvironment['unauthenticatedContext']>;

const JPEG = new Uint8Array(1024);
const JPEG_TYPE = { contentType: 'image/jpeg' };

before(async () => {
  env = await testEnvironment('storage');
  alice = env.authenticatedContext('alice');
  bob = env.authenticatedContext('bob');
  signedOut = env.unauthenticatedContext();
});

after(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearStorage();
});

/**
 * Wraps the upload in a native promise: `assertFails` on the raw upload task did not see
 * the permission error reliably.
 */
type Context = ReturnType<RulesTestEnvironment['authenticatedContext']>;

async function upload(
  context: Context,
  path: string,
  bytes: Uint8Array,
  meta: { contentType: string },
) {
  await context.storage().ref(path).put(bytes, meta);
}

/** Writes a file with the rules bypassed, to set up read, overwrite and delete tests. */
function seed(path: string) {
  return env.withSecurityRulesDisabled(async (context) => {
    await context.storage().ref(path).put(JPEG, JPEG_TYPE);
  });
}

describe('portrait upload', () => {
  it('allows the owner to upload a small JPEG to their own folder', async () => {
    await assertSucceeds(upload(alice, 'photos/alice/abc123.jpg', JPEG, JPEG_TYPE));
  });

  it('denies another user uploading into alice’s folder', async () => {
    await assertFails(upload(bob, 'photos/alice/abc123.jpg', JPEG, JPEG_TYPE));
  });

  it('denies a signed-out upload', async () => {
    await assertFails(upload(signedOut, 'photos/alice/abc123.jpg', JPEG, JPEG_TYPE));
  });

  it('denies a content type other than image/jpeg', async () => {
    await assertFails(upload(alice, 'photos/alice/abc123.jpg', JPEG, { contentType: 'image/png' }));
  });

  it('denies a file over 5 MB', async () => {
    const tooBig = new Uint8Array(5 * 1024 * 1024 + 1);
    await assertFails(upload(alice, 'photos/alice/abc123.jpg', tooBig, JPEG_TYPE));
  });

  it('denies a file name that is not a .jpg id', async () => {
    await assertFails(upload(alice, 'photos/alice/abc.png', JPEG, JPEG_TYPE));
  });

  it('denies a path outside photos/{uid}/', async () => {
    await assertFails(upload(alice, 'other/alice.jpg', JPEG, JPEG_TYPE));
  });

  it('denies overwriting an existing portrait', async () => {
    await seed('photos/alice/abc123.jpg');
    await assertFails(upload(alice, 'photos/alice/abc123.jpg', JPEG, JPEG_TYPE));
  });
});

describe('portrait read', () => {
  it('allows another signed-in user to read a portrait', async () => {
    await seed('photos/alice/abc123.jpg');
    await assertSucceeds(bob.storage().ref('photos/alice/abc123.jpg').getMetadata());
  });

  it('denies a signed-out read', async () => {
    await seed('photos/alice/abc123.jpg');
    await assertFails(signedOut.storage().ref('photos/alice/abc123.jpg').getMetadata());
  });
});

describe('portrait delete', () => {
  it('allows the owner to delete their portrait', async () => {
    await seed('photos/alice/abc123.jpg');
    await assertSucceeds(alice.storage().ref('photos/alice/abc123.jpg').delete());
  });

  it('denies another user deleting it', async () => {
    await seed('photos/alice/abc123.jpg');
    await assertFails(bob.storage().ref('photos/alice/abc123.jpg').delete());
  });
});
