// Cravos redemption (docs/gamification/README.md §10, docs/gamification/redemption.md).
// redeem() spends Cravos on one catalog item: one Firestore transaction checks the
// catalog, eligibility and stock, takes lots oldest first (FIFO), writes one `redeem`
// ledger entry per lot consumed, decrements stock and leaves a pending receipt.
// Fulfilment then claims one single-use code from the server-only partner pool
// (catalogCodes) and marks the receipt fulfilled — or fails and refunds everything.
// Amounts are signed: `redeem` and `expire` are negative, `refund` positive, so the
// projection balance is always `balance += amount`. Spending never touches lifetimeNet.

import { createHash } from 'node:crypto';
import {
  FieldValue,
  Timestamp,
  type DocumentData,
  type DocumentSnapshot,
  type Firestore,
  type Transaction,
} from 'firebase-admin/firestore';
import {
  GAM_LEVELS,
  type CatalogItemDoc,
  type GamCatalogItem,
  type GamCelebration,
  type GamLedgerEntry,
  type GamLot,
  type GamRedemption,
  type LotDoc,
} from '../model';

export const REDEEM_MIN_ACCOUNT_AGE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const FLOR_INDEX = GAM_LEVELS.findIndex((level) => level.id === 'flor');

const ITEM_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const REDEEM_TOAST_COPY_KEY = 'gam.toast.redeemed';

// ---------------------------------------------------------------------------
// Request, result and errors.
// ---------------------------------------------------------------------------

export type RedeemRequest = { uid: string; itemId: string; idempotencyKey: string };

/** The toast the app shows after a redemption; copy comes from localization. */
export type GamRedemptionCelebration = Pick<GamCelebration, 'kind' | 'copyKey' | 'amount'>;

export type RedeemResult = {
  redemptionId: string;
  code: string;
  celebrations: GamRedemptionCelebration[];
};

/** `failed-precondition` reasons the app maps to member-facing copy. */
export type GamRedeemFailureReason =
  | 'disabled'
  | 'not_eligible_age'
  | 'not_eligible_level'
  | 'open_report'
  | 'insufficient_balance'
  | 'out_of_stock';

export class RedeemError extends Error {
  constructor(readonly reason: GamRedeemFailureReason, message: string) {
    super(message);
    this.name = 'RedeemError';
  }
}

/** Bad request shape (or unknown item id): maps to `invalid-argument`. */
export class InvalidRedeemRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidRedeemRequestError';
  }
}

export type RedemptionDeps = {
  firestore: Firestore;
  /** Reads the gam_redemption flag. Off by default; redemption fails closed. */
  isRedemptionEnabled: () => Promise<boolean>;
  /** Injectable for edge tests; production uses Timestamp.now(). */
  now?: () => Timestamp;
};

// ---------------------------------------------------------------------------
// Input parsing.
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseRedeemRequest(uid: string, data: unknown): RedeemRequest {
  if (typeof uid !== 'string' || uid.length === 0) {
    throw new InvalidRedeemRequestError('redeem requires a signed-in member.');
  }
  if (!isRecord(data)) {
    throw new InvalidRedeemRequestError('redeem expects { itemId, idempotencyKey }.');
  }
  const { itemId, idempotencyKey } = data;
  if (typeof itemId !== 'string' || !ITEM_ID_PATTERN.test(itemId)) {
    throw new InvalidRedeemRequestError('redeem.itemId must be 1-64 of A-Z a-z 0-9 _ -');
  }
  if (typeof idempotencyKey !== 'string' || !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
    throw new InvalidRedeemRequestError('redeem.idempotencyKey must be 1-128 of A-Z a-z 0-9 _ -');
  }
  return { uid, itemId, idempotencyKey };
}

// ---------------------------------------------------------------------------
// FIFO lot allocation (pure).
// ---------------------------------------------------------------------------

export type LotConsumption = { id: string; lot: GamLot; taken: number };

/** Plans spending `price` Cravos from unspent lots, oldest earned first. Returns null
 *  when the lots cannot cover the price (expired lots are not spendable). */
export function allocateFifoLots(lots: LotDoc[], price: number): LotConsumption[] | null {
  const spendable = lots
    .filter((lot) => lot.amount > 0)
    .sort((a, b) => a.earnedAt.toMillis() - b.earnedAt.toMillis() || (a.id < b.id ? -1 : 1));
  let remaining = price;
  const plan: LotConsumption[] = [];
  for (const lot of spendable) {
    if (remaining === 0) break;
    const taken = Math.min(lot.amount, remaining);
    remaining -= taken;
    plan.push({ id: lot.id, lot, taken });
  }
  return remaining === 0 ? plan : null;
}

// ---------------------------------------------------------------------------
// Document readers: validate server-written docs loudly instead of casting.
// ---------------------------------------------------------------------------

function fieldError(path: string, problem: string): Error {
  return new Error(`gamification redemption: ${path} ${problem}`);
}

function readNumber(data: DocumentData, field: string, path: string): number {
  const value = data[field];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw fieldError(path, `${field} must be a finite number`);
  }
  return value;
}

function readInt(data: DocumentData, field: string, path: string, min: number): number {
  const value = readNumber(data, field, path);
  if (!Number.isInteger(value) || value < min) {
    throw fieldError(path, `${field} must be an integer >= ${min}`);
  }
  return value;
}

function readString(data: DocumentData, field: string, path: string): string {
  const value = data[field];
  if (typeof value !== 'string' || value.length === 0) {
    throw fieldError(path, `${field} must be a non-empty string`);
  }
  return value;
}

function readTimestamp(data: DocumentData, field: string, path: string): Timestamp {
  const value = data[field];
  if (!(value instanceof Timestamp)) {
    throw fieldError(path, `${field} must be a Firestore timestamp`);
  }
  return value;
}

function readStringList(data: DocumentData, field: string, path: string): string[] {
  const value = data[field];
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw fieldError(path, `${field} must be a list of strings`);
  }
  return value;
}

export function readCatalogItem(document: DocumentSnapshot): CatalogItemDoc {
  if (!document.exists) throw fieldError(`catalog/${document.id}`, 'does not exist');
  const data = document.data();
  if (data === undefined) throw fieldError(`catalog/${document.id}`, 'has no data');
  const path = `catalog/${document.id}`;
  const kind = data.kind;
  if (kind !== 'partner_funded' && kind !== 'app_perk' && kind !== 'drop' && kind !== 'give') {
    throw fieldError(path, 'kind must be a catalog kind');
  }
  const stock = data.stock;
  if (stock !== null && (typeof stock !== 'number' || !Number.isInteger(stock) || stock < 0)) {
    throw fieldError(path, 'stock must be null or an integer >= 0');
  }
  const partner = data.partner;
  if (partner !== null && typeof partner !== 'string') {
    throw fieldError(path, 'partner must be null or a string');
  }
  return {
    id: document.id,
    title: readString(data, 'title', path),
    description: readString(data, 'description', path),
    priceCravos: readInt(data, 'priceCravos', path, 1),
    kind,
    partner,
    stock,
    active: data.active === true,
  };
}

export function readLot(document: DocumentSnapshot): LotDoc {
  if (!document.exists) throw fieldError(`lots/${document.id}`, 'does not exist');
  const data = document.data();
  if (data === undefined) throw fieldError(`lots/${document.id}`, 'has no data');
  const path = `lots/${document.id}`;
  const noticeAt = data.noticeAt;
  if (noticeAt !== undefined && noticeAt !== null && !(noticeAt instanceof Timestamp)) {
    throw fieldError(path, 'noticeAt must be null or a timestamp');
  }
  return {
    id: document.id,
    amount: readInt(data, 'amount', path, 0),
    earnedAt: readTimestamp(data, 'earnedAt', path),
    expiresAt: readTimestamp(data, 'expiresAt', path),
    sourceLedgerId: readString(data, 'sourceLedgerId', path),
    ...(noticeAt !== undefined ? { noticeAt } : {}),
  };
}

type ProjectionView = { balance: number; levelId: string };

function readProjection(snapshot: DocumentSnapshot): ProjectionView {
  if (!snapshot.exists) return { balance: 0, levelId: GAM_LEVELS[0].id };
  const data = snapshot.data();
  if (data === undefined) throw fieldError(`gamification/${snapshot.id}`, 'has no data');
  return { balance: readNumber(data, 'balance', `gamification/${snapshot.id}`), levelId: readString(data, 'levelId', `gamification/${snapshot.id}`) };
}

function readRedemption(snapshot: DocumentSnapshot): GamRedemption {
  if (!snapshot.exists) throw fieldError('redemptions/<id>', 'does not exist');
  const data = snapshot.data();
  if (data === undefined) throw fieldError(`redemptions/${snapshot.id}`, 'has no data');
  const path = `redemptions/${snapshot.id}`;
  const status = data.status;
  if (status !== 'pending' && status !== 'fulfilled' && status !== 'failed') {
    throw fieldError(path, 'status must be pending, fulfilled or failed');
  }
  const code = data.code;
  if (code !== null && typeof code !== 'string') {
    throw fieldError(path, 'code must be null or a string');
  }
  const fulfilledAt = data.fulfilledAt;
  if (fulfilledAt !== null && !(fulfilledAt instanceof Timestamp)) {
    throw fieldError(path, 'fulfilledAt must be null or a timestamp');
  }
  return {
    uid: readString(data, 'uid', path),
    itemId: readString(data, 'itemId', path),
    status,
    cravos: readInt(data, 'cravos', path, 1),
    redeemEntryIds: readStringList(data, 'redeemEntryIds', path),
    code,
    createdAt: readTimestamp(data, 'createdAt', path),
    fulfilledAt,
  };
}

/** A ledger entry as written by this module (createdAt is the server-timestamp sentinel). */
type NewLedgerEntry = Omit<GamLedgerEntry, 'createdAt'> & { createdAt: FieldValue };

function readLedgerEntry(document: DocumentSnapshot): GamLedgerEntry & { id: string; lotExpiresAt: Timestamp } {
  if (!document.exists) throw fieldError(`ledger/${document.id}`, 'does not exist');
  const data = document.data();
  if (data === undefined) throw fieldError(`ledger/${document.id}`, 'has no data');
  const path = `ledger/${document.id}`;
  if (data.kind !== 'redeem') throw fieldError(path, 'must be a redeem entry to be refundable');
  const amount = readNumber(data, 'amount', path);
  if (amount >= 0) throw fieldError(path, 'a redeem entry needs a negative amount');
  const source = data.source;
  if (!isRecord(source)) throw fieldError(path, 'source must be an object');
  const lotPath = readString(source, 'path', `${path}.source`);
  const lot = data.lot;
  if (!isRecord(lot)) throw fieldError(path, 'lot must be an object');
  return {
    id: document.id,
    track: 'cravos',
    kind: 'redeem',
    amount,
    ruleId: readString(data, 'ruleId', path),
    ruleSetVersion: readInt(data, 'ruleSetVersion', path, 0),
    source: {
      event: readString(source, 'event', `${path}.source`),
      path: lotPath,
      eventId: readString(source, 'eventId', `${path}.source`),
    },
    lot: { expiresAt: readTimestamp(lot, 'expiresAt', `${path}.lot`) },
    lotExpiresAt: readTimestamp(lot, 'expiresAt', `${path}.lot`),
    actor: 'system',
    createdAt: readTimestamp(data, 'createdAt', path),
  };
}

// ---------------------------------------------------------------------------
// Ledger entries and receipts.
// ---------------------------------------------------------------------------

function redeemEntry(request: RedeemRequest, lotId: string, lot: GamLot, taken: number): NewLedgerEntry {
  return {
    track: 'cravos',
    kind: 'redeem',
    amount: -taken,
    ruleId: 'redeem',
    // Redemption is governed by the catalog and the gam_redemption flag, not by a rule
    // set, so no rule-set version applies here.
    ruleSetVersion: 0,
    source: {
      event: 'redemption.redeemed',
      path: `gamification/${request.uid}/lots/${lotId}`,
      eventId: request.idempotencyKey,
    },
    lot: { expiresAt: lot.expiresAt },
    actor: 'system',
    createdAt: FieldValue.serverTimestamp(),
  };
}

function refundEntry(request: RedeemRequest, original: GamLedgerEntry): NewLedgerEntry {
  return {
    track: 'cravos',
    kind: 'refund',
    amount: -original.amount,
    ruleId: 'refund',
    ruleSetVersion: 0,
    source: {
      event: 'redemption.refunded',
      path: original.source.path,
      eventId: request.idempotencyKey,
    },
    lot: original.lot,
    actor: 'system',
    reason: 'fulfilment failed: no partner code available',
    createdAt: FieldValue.serverTimestamp(),
  };
}

function redemptionCelebrations(cravos: number): GamRedemptionCelebration[] {
  return [{ kind: 'toast', copyKey: REDEEM_TOAST_COPY_KEY, amount: -cravos }];
}

// ---------------------------------------------------------------------------
// The redeem flow.
// ---------------------------------------------------------------------------

type RedemptionStart =
  | { kind: 'created'; itemId: string; cravos: number }
  | { kind: 'replay'; redemption: GamRedemption };

/** The receipt id is the digest of uid + idempotency key: a retry with the same key
 *  finds the same redemption (repo idiom from notificationDispatches markers). */
export function redemptionIdFor(uid: string, idempotencyKey: string): string {
  return createHash('sha256').update(`${uid}\0${idempotencyKey}`).digest('hex');
}

export async function redeemItem(uid: string, data: unknown, deps: RedemptionDeps): Promise<RedeemResult> {
  const request = parseRedeemRequest(uid, data);
  const enabled = await deps.isRedemptionEnabled();
  const now = deps.now?.() ?? Timestamp.now();
  const redemptionId = redemptionIdFor(request.uid, request.idempotencyKey);
  const start = await deps.firestore.runTransaction((tx) =>
    startRedemption(tx, deps.firestore, request, redemptionId, now, enabled),
  );

  let itemId: string;
  let cravos: number;
  if (start.kind === 'created') {
    itemId = start.itemId;
    cravos = start.cravos;
  } else if (start.redemption.status === 'failed') {
    // Terminal for this key: the Cravos were refunded; a fresh attempt needs a new key.
    throw new RedeemError(
      'out_of_stock',
      'This redemption could not be fulfilled and the Cravos were refunded. Try again with a new idempotency key.',
    );
  } else {
    itemId = start.redemption.itemId;
    cravos = start.redemption.cravos;
  }

  // Pending (fresh or recovered after a crash between the two transactions): fulfil it.
  const code = await fulfilRedemption(deps, redemptionId, itemId) ??
    await failRedemption(deps, request, redemptionId);
  if (code === null) {
    throw new RedeemError('out_of_stock', 'This item ran out of codes; the Cravos are back in your wallet.');
  }
  return { redemptionId, code, celebrations: redemptionCelebrations(cravos) };
}

async function startRedemption(
  tx: Transaction,
  firestore: Firestore,
  request: RedeemRequest,
  redemptionId: string,
  now: Timestamp,
  enabled: boolean,
): Promise<RedemptionStart> {
  const redemptionRef = firestore.doc(`redemptions/${redemptionId}`);
  const existing = await tx.get(redemptionRef);
  if (existing.exists) {
    const redemption = readRedemption(existing);
    if (redemption.itemId !== request.itemId) {
      throw new InvalidRedeemRequestError('This idempotency key belongs to another item.');
    }
    return { kind: 'replay', redemption };
  }
  if (!enabled) throw new RedeemError('disabled', 'Cravos redemption is not available yet.');

  const itemRef = firestore.doc(`catalog/${request.itemId}`);
  const accountRef = firestore.doc(`users/${request.uid}`);
  const projectionRef = firestore.doc(`gamification/${request.uid}`);
  const [itemSnapshot, accountSnapshot, projectionSnapshot, preference] = await tx.getAll(
    itemRef, accountRef, projectionRef, firestore.doc(`gamPreferences/${request.uid}`),
  );
  if (preference.get('optedOut') === true) throw new RedeemError('disabled', 'Cravos is disabled for this account.');

  if (!itemSnapshot.exists) {
    throw new InvalidRedeemRequestError(`Unknown catalog item ${request.itemId}.`);
  }
  const item = readCatalogItem(itemSnapshot);
  if (!item.active || (item.stock !== null && item.stock <= 0)) {
    throw new RedeemError('out_of_stock', 'This item is not available right now.');
  }

  const createdAt = accountSnapshot.exists ? readTimestamp(accountSnapshot.data() ?? {}, 'createdAt', `users/${request.uid}`) : null;
  if (
    createdAt === null ||
    now.toMillis() - createdAt.toMillis() < REDEEM_MIN_ACCOUNT_AGE_DAYS * DAY_MS
  ) {
    throw new RedeemError('not_eligible_age', 'Redemption opens 30 days after you join.');
  }

  const projection = readProjection(projectionSnapshot);
  if (GAM_LEVELS.findIndex((level) => level.id === projection.levelId) < FLOR_INDEX) {
    throw new RedeemError('not_eligible_level', 'Redemption opens at level Flor.');
  }

  // Any report naming this member is open: there is no in-app resolution flow yet, so
  // redemption stays conservative until moderation exists (docs/gamification/redemption.md).
  const reports = await tx.get(firestore.collection('reports').where('target', '==', request.uid).limit(1));
  if (!reports.empty) {
    throw new RedeemError('open_report', 'Redemption is paused while a report is being reviewed.');
  }

  if (projection.balance < item.priceCravos) {
    throw new RedeemError('insufficient_balance', 'Not enough Cravos for this item.');
  }

  const lots = (await tx.get(firestore.collection(`gamification/${request.uid}/lots`).orderBy('earnedAt', 'asc'))).docs.map(readLot)
    .filter((lot) => lot.expiresAt.toMillis() > now.toMillis());
  const plan = allocateFifoLots(lots, item.priceCravos);
  if (plan === null) {
    throw new RedeemError(
      'insufficient_balance',
      'Not enough spendable Cravos: some lots have already expired.',
    );
  }

  const redeemEntryIds: string[] = [];
  for (const { id, lot, taken } of plan) {
    const entryId = `redeem:${request.idempotencyKey}:${id}`;
    redeemEntryIds.push(entryId);
    const lotRef = firestore.doc(`gamification/${request.uid}/lots/${id}`);
    // A fully spent lot becomes a zero-amount tombstone: the refund path adds the taken
    // amount back onto this doc, and every reader filters amount > 0.
    tx.update(lotRef, { amount: taken === lot.amount ? 0 : lot.amount - taken });
    tx.create(firestore.doc(`gamification/${request.uid}/ledger/${entryId}`), redeemEntry(request, id, lot, taken));
  }
  if (item.stock !== null) tx.update(itemRef, { stock: item.stock - 1 });
  // Spending is not un-earning: only balance moves, never lifetimeNet or the level.
  tx.update(projectionRef, {
    balance: projection.balance - item.priceCravos,
    updatedAt: FieldValue.serverTimestamp(),
  });
  tx.create(redemptionRef, {
    uid: request.uid,
    itemId: request.itemId,
    status: 'pending',
    cravos: item.priceCravos,
    redeemEntryIds,
    code: null,
    createdAt: FieldValue.serverTimestamp(),
    fulfilledAt: null,
  } satisfies Omit<GamRedemption, 'createdAt'> & { createdAt: FieldValue });
  return { kind: 'created', itemId: request.itemId, cravos: item.priceCravos };
}

/** Claims one unassigned code and marks the redemption fulfilled. Returns the code, the
 *  already-assigned code on a replay, or null when the pool (or the redemption) is
 *  exhausted. */
async function fulfilRedemption(deps: RedemptionDeps, redemptionId: string, itemId: string): Promise<string | null> {
  const redemptionRef = deps.firestore.doc(`redemptions/${redemptionId}`);
  return deps.firestore.runTransaction(async (tx) => {
    const current = readRedemption(await tx.get(redemptionRef));
    if (current.status === 'fulfilled' && current.code !== null) return current.code;
    if (current.status !== 'pending') return null;
    const pool = await tx.get(
      deps.firestore.collection(`catalogCodes/${itemId}/codes`).where('assignedTo', '==', null).limit(1),
    );
    if (pool.empty) return null;
    const code = pool.docs[0];
    tx.update(code.ref, { assignedTo: redemptionId, assignedAt: FieldValue.serverTimestamp() });
    tx.update(redemptionRef, {
      status: 'fulfilled',
      code: code.id,
      fulfilledAt: FieldValue.serverTimestamp(),
    });
    return code.id;
  });
}

/** Marks the pending redemption failed, writes one refund entry per consumed lot and
 *  restores the lots, the projection balance and the stock. No-ops unless the
 *  redemption is still pending, so concurrent failures refund exactly once. */
async function failRedemption(deps: RedemptionDeps, request: RedeemRequest, redemptionId: string): Promise<string | null> {
  const redemptionRef = deps.firestore.doc(`redemptions/${redemptionId}`);
  const ledgerRef = (entryId: string) => deps.firestore.doc(`gamification/${request.uid}/ledger/${entryId}`);
  return deps.firestore.runTransaction(async (tx) => {
    const current = readRedemption(await tx.get(redemptionRef));
    if (current.status === 'fulfilled') return current.code;
    if (current.status !== 'pending') return null;

    const itemRef = deps.firestore.doc(`catalog/${current.itemId}`);
    const projectionRef = deps.firestore.doc(`gamification/${request.uid}`);
    const [itemSnapshot, projectionSnapshot] = await tx.getAll(itemRef, projectionRef);
    const entries = await tx.getAll(...current.redeemEntryIds.map((entryId) => ledgerRef(entryId)));

    const lotPrefix = `gamification/${request.uid}/lots/`;
    const lotRefs = entries.map((snapshot) => {
      const entry = readLedgerEntry(snapshot);
      if (!entry.source.path.startsWith(lotPrefix)) {
        throw fieldError(`ledger/${snapshot.id}`, `source.path must point under ${lotPrefix}`);
      }
      return deps.firestore.doc(entry.source.path);
    });
    const lots = await tx.getAll(...lotRefs);

    tx.update(redemptionRef, { status: 'failed' });
    entries.forEach((snapshot, index) => {
      const entry = readLedgerEntry(snapshot);
      const lotSnapshot = lots[index];
      tx.create(ledgerRef(`refund:${snapshot.id}`), refundEntry(request, entry));
      if (lotSnapshot.exists) {
        const lot = readLot(lotSnapshot);
        tx.update(lotRefs[index], { amount: lot.amount - entry.amount });
      }
    });
    const projection = readProjection(projectionSnapshot);
    tx.update(projectionRef, {
      balance: projection.balance + current.cravos,
      updatedAt: FieldValue.serverTimestamp(),
    });
    const item = readCatalogItem(itemSnapshot);
    if (item.stock !== null) tx.update(itemRef, { stock: item.stock + 1 });
    return null;
  });
}
