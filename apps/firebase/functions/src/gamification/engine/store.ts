// The engine's Firestore adapter. Admin SDK only: every path it touches is
// server-written (the security rules allow owner reads and nothing else).
// gamification/{uid} and gamShadow/{uid} share one layout, selected per member
// by the flags (shadow phase / control arm), so this class only builds paths and
// parses documents; the evaluator owns the transaction logic.

import { FieldValue, Timestamp, type DocumentData, type DocumentReference, type Firestore, type Transaction } from 'firebase-admin/firestore';
import type {
  GamAchievementId,
  GamLevelId,
  GamProjection,
  GamQuestState,
  GamStreakState,
} from '../model';
import { pairHash } from './pair';

export type GamStoreRoot = 'gamification' | 'gamShadow';

export function rootFor(shadow: boolean): GamStoreRoot {
  return shadow ? 'gamShadow' : 'gamification';
}

/** The projection as the engine reads it back; every field is defensively parsed. */
export type ProjectionState = {
  balance: number;
  lifetimeNet: number;
  levelHighWaterMark: number;
  levelId: GamLevelId;
  streak: Required<Pick<GamStreakState, 'currentWeeks' | 'recordWeeks' | 'qualifiedThisWeek'
    | 'pauseBank' | 'pausedUntil'>> & { lastClosedWeek: string };
  quest: Required<Pick<GamQuestState, 'questId' | 'weekStart' | 'progress' | 'target'>>;
  questCompletedAt: Timestamp | null;
  pausedUntil: Timestamp | null;
};

export function defaultProjection(): ProjectionState {
  return {
    balance: 0,
    lifetimeNet: 0,
    levelHighWaterMark: 0,
    levelId: 'botao',
    streak: {
      currentWeeks: 0,
      recordWeeks: 0,
      qualifiedThisWeek: false,
      pauseBank: 0,
      pausedUntil: null,
      lastClosedWeek: '',
    },
    quest: { questId: null, weekStart: '', progress: 0, target: 0 },
    questCompletedAt: null,
    pausedUntil: null,
  };
}

function numberOf(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function parseProjection(data: DocumentData | undefined): ProjectionState {
  const state = defaultProjection();
  if (data === undefined) return state;
  state.balance = numberOf(data.balance, state.balance);
  state.lifetimeNet = numberOf(data.lifetimeNet, state.lifetimeNet);
  state.levelHighWaterMark = numberOf(data.levelHighWaterMark, state.levelHighWaterMark);
  if (typeof data.levelId === 'string') state.levelId = data.levelId as GamLevelId;
  if (data.streak !== undefined && data.streak !== null && typeof data.streak === 'object') {
    const streak = data.streak as Record<string, unknown>;
    state.streak.currentWeeks = numberOf(streak.currentWeeks, state.streak.currentWeeks);
    state.streak.recordWeeks = numberOf(streak.recordWeeks, state.streak.recordWeeks);
    state.streak.qualifiedThisWeek = streak.qualifiedThisWeek === true;
    state.streak.pauseBank = numberOf(streak.pauseBank, state.streak.pauseBank);
    state.streak.pausedUntil = streak.pausedUntil instanceof Timestamp ? streak.pausedUntil : null;
    if (typeof streak.lastClosedWeek === 'string') state.streak.lastClosedWeek = streak.lastClosedWeek;
  }
  if (data.pausedUntil instanceof Timestamp) state.pausedUntil = data.pausedUntil;
  if (data.quest !== undefined && data.quest !== null && typeof data.quest === 'object') {
    const quest = data.quest as Record<string, unknown>;
    state.quest.questId = typeof quest.questId === 'string' ? quest.questId : null;
    if (typeof quest.weekStart === 'string') state.quest.weekStart = quest.weekStart;
    state.quest.progress = numberOf(quest.progress, state.quest.progress);
    state.quest.target = numberOf(quest.target, state.quest.target);
    state.questCompletedAt = quest.completedAt instanceof Timestamp ? quest.completedAt : null;
  }
  return state;
}

/** Serializes the engine state back into the GamProjection document shape. */
export function projectionDoc(state: ProjectionState, updatedAt: FieldValue | Timestamp): Record<string, unknown> {
  return {
    balance: state.balance,
    lifetimeNet: state.lifetimeNet,
    levelHighWaterMark: state.levelHighWaterMark,
    levelId: state.levelId,
    streak: {
      currentWeeks: state.streak.currentWeeks,
      recordWeeks: state.streak.recordWeeks,
      qualifiedThisWeek: state.streak.qualifiedThisWeek,
      pauseBank: state.streak.pauseBank,
      pausedUntil: state.pausedUntil,
      lastClosedWeek: state.streak.lastClosedWeek,
    },
    quest: {
      questId: state.quest.questId,
      weekStart: state.quest.weekStart,
      progress: state.quest.progress,
      target: state.quest.target,
      completedAt: state.questCompletedAt,
    },
    updatedAt,
  };
}

/** Firestore requires every transaction read before the first write. The evaluator
 * can prepare writes while it makes decisions, then submit them together. */
export type EngineTransaction = Pick<Transaction, 'get' | 'getAll'> & {
  create(ref: DocumentReference, data: DocumentData): void;
  set(ref: DocumentReference, data: DocumentData, options?: FirebaseFirestore.SetOptions): void;
  delete(ref: DocumentReference): void;
};

export class GamEngineStore {
  constructor(
    readonly firestore: Firestore,
    readonly salt: string,
  ) {}

  pairBucketKey(pairKey: string): string {
    return pairHash(this.salt, pairKey);
  }

  private root(uid: string, shadow: boolean): DocumentReference {
    return this.firestore.doc(`${rootFor(shadow)}/${uid}`);
  }

  projectionRef(uid: string, shadow: boolean): DocumentReference {
    return this.root(uid, shadow);
  }

  ledgerRef(uid: string, shadow: boolean, entryId: string): DocumentReference {
    return this.root(uid, shadow).collection('ledger').doc(entryId);
  }

  counterRef(uid: string, shadow: boolean, bucket: string): DocumentReference {
    return this.root(uid, shadow).collection('counters').doc(bucket);
  }

  holdRef(uid: string, shadow: boolean, ruleId: string, sourceId: string): DocumentReference {
    return this.counterRef(uid, shadow, `hold:${ruleId}:${sourceId}`);
  }

  celebrationRef(uid: string, shadow: boolean, id: string): DocumentReference {
    return this.root(uid, shadow).collection('celebrations').doc(id);
  }

  lotRef(uid: string, shadow: boolean, lotId: string): DocumentReference {
    return this.root(uid, shadow).collection('lots').doc(lotId);
  }

  achievementRef(uid: string, shadow: boolean, achievementId: GamAchievementId | string): DocumentReference {
    return this.root(uid, shadow).collection('achievements').doc(achievementId);
  }

  metricsRef(day: string): DocumentReference {
    return this.firestore.doc(`gamMetrics/${day}`);
  }

  runTransaction<T>(update: (tx: EngineTransaction) => Promise<T>): Promise<T> {
    return this.firestore.runTransaction(async (tx) => {
      const writes: (() => void)[] = [];
      const result = await update({
        get: tx.get.bind(tx),
        getAll: tx.getAll.bind(tx),
        create: (ref, data) => { writes.push(() => tx.create(ref, data)); },
        set: (ref, data, options) => {
          writes.push(() => options === undefined ? tx.set(ref, data) : tx.set(ref, data, options));
        },
        delete: (ref) => { writes.push(() => tx.delete(ref)); },
      });
      for (const write of writes) write();
      return result;
    });
  }
}

/** Reads a counter document {count, updatedAt} defensively. */
export function readCounter(data: DocumentData | undefined): { count: number; updatedAt: string } {
  return {
    count: data !== undefined && typeof data.count === 'number' && Number.isFinite(data.count)
      ? data.count
      : 0,
    updatedAt: data !== undefined && typeof data.updatedAt === 'string' ? data.updatedAt : '',
  };
}

/** Reads a hold document defensively; null when absent or malformed. */
export function readHold(data: DocumentData | undefined): {
  amount: number;
  releaseAt: Timestamp;
  event: string;
  path: string;
  eventId: string;
  pairKey: string | null;
} | null {
  if (data === undefined || !(data.releaseAt instanceof Timestamp)) return null;
  return {
    amount: numberOf(data.amount, 0),
    releaseAt: data.releaseAt,
    event: typeof data.event === 'string' ? data.event : '',
    path: typeof data.path === 'string' ? data.path : '',
    eventId: typeof data.eventId === 'string' ? data.eventId : '',
    pairKey: typeof data.pairKey === 'string' ? data.pairKey : null,
  };
}
