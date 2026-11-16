import { FieldPath, type Firestore } from 'firebase-admin/firestore';

const PAGE_SIZE = 100;
const MAX_PAGES_PER_ATTEMPT = 20;

/**
 * Deletes orphaned messages only while their parent is absent. Reading that absence and
 * deleting each page in the SAME transaction fences a concurrent match recreation:
 * Firestore retries the transaction if the parent changes, then the existing parent wins.
 * Never deletes the parent itself or trusts client-side author permissions for cleanup.
 */
export async function cleanupDeletedMatch(
  firestore: Firestore,
  matchId: string,
  users: unknown,
): Promise<number> {
  if (!Array.isArray(users) || users.length !== 2) return 0;
  const [first, second] = users;
  if (
    typeof first !== 'string' || typeof second !== 'string' || !first || !second ||
    first >= second || /[\/\u0000]/.test(first + second) || matchId !== `${first}_${second}`
  ) return 0;

  const parent = firestore.doc(`matches/${matchId}`);
  let deleted = 0;
  for (let page = 0; page < MAX_PAGES_PER_ATTEMPT; page++) {
    const result = await firestore.runTransaction(async (transaction) => {
      const current = await transaction.get(parent);
      if (current.exists) return { count: 0, complete: true };
      const messages = await transaction.get(
        parent.collection('messages').orderBy(FieldPath.documentId()).limit(PAGE_SIZE),
      );
      for (const message of messages.docs) transaction.delete(message.ref);
      return { count: messages.size, complete: messages.size < PAGE_SIZE };
    });
    deleted += result.count;
    if (result.complete) return deleted;
  }
  // Progress has already committed. The retry starts at the first remaining page, so a
  // large conversation cannot make one invocation do unbounded work or lose its cursor.
  throw new Error('Match cleanup page budget reached; retry remaining messages');
}
