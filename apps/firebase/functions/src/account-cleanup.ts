import type { Firestore } from 'firebase-admin/firestore';
import type { Bucket } from '@google-cloud/storage';

const PAGE_SIZE = 300;

export interface AccountSwipe {
  targetUid: string;
  direction: string;
}

export interface AccountCleanupStore {
  listSwipes(uid: string): Promise<AccountSwipe[]>;
  listBlocks(uid: string): Promise<string[]>;
  deleteProfile(uid: string): Promise<void>;
  deleteReceivedLikes(uid: string): Promise<void>;
  deleteLike(uid: string, targetUid: string): Promise<void>;
  deleteBlock(uid: string, blockerUid: string): Promise<void>;
  deleteUserTree(uid: string): Promise<void>;
  deleteMatches(uid: string): Promise<void>;
  deletePhotos(uid: string): Promise<void>;
}

/** Runs safely after any subset of client-side account cleanup has already completed. */
export async function cleanupDeletedAccount(uid: string, store: AccountCleanupStore): Promise<void> {
  // Save relationship ids before recursiveDelete removes the source collections.
  const [swipes, blockedUids] = await Promise.all([store.listSwipes(uid), store.listBlocks(uid)]);
  await store.deleteProfile(uid);
  await store.deleteReceivedLikes(uid);
  await Promise.all([
    ...swipes
      .filter(({ direction }) => direction === 'like')
      .map(({ targetUid }) => store.deleteLike(uid, targetUid)),
    ...blockedUids.map((blockerUid) => store.deleteBlock(uid, blockerUid)),
  ]);
  await store.deleteUserTree(uid);
  await store.deleteMatches(uid);
  await store.deletePhotos(uid);
}

async function deleteQueryPages(
  firestore: Firestore,
  queryFactory: () => FirebaseFirestore.Query,
): Promise<void> {
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  while (true) {
    const query = queryFactory().limit(PAGE_SIZE);
    const page = await (cursor ? query.startAfter(cursor) : query).get();
    if (page.empty) return;
    const batch = firestore.batch();
    for (const document of page.docs) batch.delete(document.ref);
    await batch.commit();
    cursor = page.docs[page.docs.length - 1];
    if (page.size < PAGE_SIZE) return;
  }
}

async function readQueryPages(queryFactory: () => FirebaseFirestore.Query): Promise<FirebaseFirestore.QueryDocumentSnapshot[]> {
  const documents: FirebaseFirestore.QueryDocumentSnapshot[] = [];
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  while (true) {
    const query = queryFactory().limit(PAGE_SIZE);
    const page = await (cursor ? query.startAfter(cursor) : query).get();
    documents.push(...page.docs);
    if (page.empty || page.size < PAGE_SIZE) return documents;
    cursor = page.docs[page.docs.length - 1];
  }
}

export class FirebaseAccountCleanupStore implements AccountCleanupStore {
  constructor(private readonly firestore: Firestore, private readonly bucket: Bucket) {}

  async listSwipes(uid: string): Promise<AccountSwipe[]> {
    const documents = await readQueryPages(() => this.firestore.collection(`users/${uid}/swipes`));
    return documents.map((document) => ({ targetUid: document.id, direction: document.get('direction') }));
  }

  async listBlocks(uid: string): Promise<string[]> {
    const documents = await readQueryPages(() => this.firestore.collection(`users/${uid}/blocks`));
    return documents.map(({ id }) => id);
  }

  async deleteProfile(uid: string): Promise<void> {
    await this.firestore.doc(`profiles/${uid}`).delete();
  }

  async deleteReceivedLikes(uid: string): Promise<void> {
    await deleteQueryPages(this.firestore, () => this.firestore.collection(`likes/${uid}/from`));
  }

  async deleteLike(uid: string, targetUid: string): Promise<void> {
    await this.firestore.doc(`likes/${targetUid}/from/${uid}`).delete();
  }

  async deleteBlock(uid: string, blockerUid: string): Promise<void> {
    await this.firestore.doc(`blocks/${blockerUid}/by/${uid}`).delete();
  }

  async deleteUserTree(uid: string): Promise<void> {
    // Remove the account first so delayed award handlers cannot recreate either projection.
    await this.firestore.recursiveDelete(this.firestore.doc(`users/${uid}`));
    await Promise.all(['gamification', 'gamShadow', 'gamEvents', 'gamPreferences'].map((root) =>
      this.firestore.recursiveDelete(this.firestore.doc(`${root}/${uid}`)),
    ));
  }

  async deleteMatches(uid: string): Promise<void> {
    await deleteQueryPages(this.firestore, () => this.firestore.collection('matches').where('users', 'array-contains', uid));
  }

  async deletePhotos(uid: string): Promise<void> {
    let pageToken: string | undefined;
    do {
      const [files, nextQuery] = await this.bucket.getFiles({
        prefix: `photos/${uid}/`,
        autoPaginate: false,
        maxResults: PAGE_SIZE,
        ...(pageToken && { pageToken }),
      });
      await Promise.all(files.map(async (file) => {
        try {
          await file.delete();
        } catch (error) {
          if ((error as { code?: number }).code !== 404) throw error;
        }
      }));
      pageToken = nextQuery.pageToken;
    } while (pageToken);
  }
}
