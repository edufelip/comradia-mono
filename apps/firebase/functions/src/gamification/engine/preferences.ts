import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { isoDateInZone } from './weeks';

const WEEK_MS = 7 * 86_400_000;

export async function updatePreferences(
  db: Firestore, uid: string, input: unknown, maxPauseWeeks: number, timezone: string, nowMs = Date.now(),
) {
  if (typeof input !== 'object' || input === null ||
    Object.keys(input).some((key) => !['optedOut', 'pauseWeeks'].includes(key))) {
    throw new HttpsError('invalid-argument', 'Provide optedOut or pauseWeeks.');
  }
  const optedOut = 'optedOut' in input ? input.optedOut : undefined;
  const pauseWeeks = 'pauseWeeks' in input ? input.pauseWeeks : undefined;
  if ((optedOut === undefined && pauseWeeks === undefined) ||
    (optedOut !== undefined && typeof optedOut !== 'boolean') ||
    (pauseWeeks !== undefined && (typeof pauseWeeks !== 'number' || !Number.isInteger(pauseWeeks) ||
      pauseWeeks < 0 || pauseWeeks > maxPauseWeeks))) {
    throw new HttpsError('invalid-argument', 'Invalid Cravos preference.');
  }

  await db.runTransaction(async (tx) => {
    const ref = db.doc(`gamPreferences/${uid}`);
    const [account, previous, projection] = await tx.getAll(
      db.doc(`users/${uid}`), ref, db.doc(`gamification/${uid}`),
    );
    if (!account.exists) throw new HttpsError('failed-precondition', 'Finish setting up your profile first.');
    const pausedUntil = typeof pauseWeeks === 'number'
      ? pauseWeeks === 0 ? null : Timestamp.fromMillis(nowMs + pauseWeeks * WEEK_MS) : undefined;
    tx.set(ref, {
      ...(optedOut !== undefined ? { optedOut } : {}),
      ...(pausedUntil !== undefined ? { pausedUntil } : {}),
    }, { merge: true });
    if (pausedUntil !== undefined && projection.exists) tx.update(projection.ref, { 'streak.pausedUntil': pausedUntil });
    if (optedOut === true && previous.get('optedOut') !== true) {
      tx.set(db.doc(`gamMetrics/${isoDateInZone(nowMs, timezone)}`), {
        gam_program_opted_out: FieldValue.increment(1),
      }, { merge: true });
    }
  });
  return { ok: true };
}
