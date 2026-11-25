// Per-pair counters must not store another member's raw uid (spec §11 account
// deletion: "per-pair counters on the other member store a salted hash of the
// pair"). Every counter bucket that is keyed by a pair uses this hash instead of
// the match id; the ledger (deleted with the owner's tree) keeps the readable id.
import { createHash } from 'node:crypto';

export function pairHash(salt: string, pairKey: string): string {
  return createHash('sha256').update(`${salt}:${pairKey}`).digest('hex').slice(0, 20);
}
