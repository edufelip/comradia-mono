// The gate every Cravos admin callable passes: a signed-in admin with the gamAdmin
// custom claim. App Check is enforced one level up, by `enforceAppCheck: true` on the
// onCall options in src/index.ts, which rejects requests without a valid App Check
// token before this code runs. Kept as a pure function over the callable's auth data so
// tests can cover it without a Functions deployment.
import { HttpsError } from 'firebase-functions/v2/https';

/** The shape of `CallableRequest.auth` this guard needs (uid + decoded claims). */
export type GamAdminAuth = { uid: string; token: { [claim: string]: unknown } } | undefined;

/** Who is acting: the uid of a gamAdmin. Every write records it in gamAudit. */
export type GamAdminActor = { uid: string };

export function gamAdminActor(auth: GamAdminAuth): GamAdminActor {
  if (!auth || typeof auth.uid !== 'string' || auth.uid.length === 0) {
    throw new HttpsError('unauthenticated', 'Sign in to call a Cravos admin function.');
  }
  if (auth.token.gamAdmin !== true) {
    throw new HttpsError('permission-denied', 'The gamAdmin custom claim is required.');
  }
  return { uid: auth.uid };
}
