import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cleanupDeletedAccount, type AccountCleanupStore } from '../src/account-cleanup.js';

function fakeStore(): AccountCleanupStore & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async listSwipes(uid) { calls.push(`swipes:${uid}`); return [{ targetUid: 'liked', direction: 'like' }, { targetUid: 'passed', direction: 'pass' }]; },
    async listBlocks(uid) { calls.push(`blocks:${uid}`); return ['blocked']; },
    async deleteProfile(uid) { calls.push(`profile:${uid}`); },
    async deleteReceivedLikes(uid) { calls.push(`receivedLikes:${uid}`); },
    async deleteLike(uid, targetUid) { calls.push(`like:${targetUid}:${uid}`); },
    async deleteBlock(uid, targetUid) { calls.push(`block:${targetUid}:${uid}`); },
    async deleteUserTree(uid) { calls.push(`userTree:${uid}`); },
    async deleteMatches(uid) { calls.push(`matches:${uid}`); },
    async deletePhotos(uid) { calls.push(`photos:${uid}`); },
  };
}

describe('deleted account cleanup', () => {
  it('reads relationships before user-tree deletion and removes all user-owned data', async () => {
    const store = fakeStore();
    await cleanupDeletedAccount('gone', store);

    assert.ok(store.calls.indexOf('swipes:gone') < store.calls.indexOf('userTree:gone'));
    assert.ok(store.calls.indexOf('blocks:gone') < store.calls.indexOf('userTree:gone'));
    assert.deepEqual(store.calls, [
      'swipes:gone', 'blocks:gone', 'profile:gone', 'receivedLikes:gone',
      'like:liked:gone', 'block:blocked:gone', 'userTree:gone', 'matches:gone', 'photos:gone',
    ]);
  });

  it('is safe when the client already removed all user data', async () => {
    const store = fakeStore();
    store.listSwipes = async () => [];
    store.listBlocks = async () => [];
    await cleanupDeletedAccount('already-clean', store);
    assert.deepEqual(store.calls, [
      'profile:already-clean', 'receivedLikes:already-clean', 'userTree:already-clean',
      'matches:already-clean', 'photos:already-clean',
    ]);
  });
});
