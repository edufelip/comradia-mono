import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { enforcePhotoCap, type PhotoCapStore, type PhotoObject } from '../src/photo-cap.js';

function photo(name: string, createdAt: number, contentType = 'image/jpeg'): PhotoObject {
  return { name, createdAt, contentType };
}

function fakeStore(photos: PhotoObject[], referencedPath: string | null = null) {
  const deleted: string[] = [];
  const store: PhotoCapStore = {
    async listPhotos() { return photos; },
    async getProfilePhotoPath() { return referencedPath; },
    async readFirstBytes() { return new Uint8Array([0xff, 0xd8, 0xff]); },
    async deletePhoto(name) { deleted.push(name); photos = photos.filter((item) => item.name !== name); },
  };
  return { store, deleted };
}

describe('photo upload cap', () => {
  it('deletes the oldest unreferenced photos until three remain', async () => {
    const { store, deleted } = fakeStore([
      photo('photos/u/old.jpg', 1), photo('photos/u/kept.jpg', 2),
      photo('photos/u/new.jpg', 3), photo('photos/u/current.jpg', 4),
    ], 'photos/u/kept.jpg');

    await enforcePhotoCap('u', 'photos/u/current.jpg', 'image/jpeg', store);

    assert.deepEqual(deleted, ['photos/u/old.jpg']);
  });

  it('deletes non-JPEG uploads without checking folder size', async () => {
    const { store, deleted } = fakeStore([], null);
    await enforcePhotoCap('u', 'photos/u/bad.png', 'image/png', store);
    assert.deepEqual(deleted, ['photos/u/bad.png']);
  });

  it('deletes files with a non-JPEG signature', async () => {
    const { store, deleted } = fakeStore([]);
    store.readFirstBytes = async () => new Uint8Array([0, 0, 0]);
    await enforcePhotoCap('u', 'photos/u/fake.jpg', 'image/jpeg', store);
    assert.deepEqual(deleted, ['photos/u/fake.jpg']);
  });

  it('skips the signature check when ranged reads are unavailable', async () => {
    const { store, deleted } = fakeStore([
      photo('photos/u/1.jpg', 1), photo('photos/u/2.jpg', 2), photo('photos/u/3.jpg', 3),
    ]);
    store.readFirstBytes = async () => undefined;
    await enforcePhotoCap('u', 'photos/u/3.jpg', 'image/jpeg', store);
    assert.deepEqual(deleted, []);
  });
});
