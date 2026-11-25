import { getApp } from 'firebase/app';
import {
  collection,
  doc,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import {
  activate,
  fetchAndActivate,
  getRemoteConfig,
  getString,
  isSupported,
  onConfigUpdate,
} from 'firebase/remote-config';
import type {
  GamCatalogItem,
  GamCelebration,
  GamLedgerEntry,
  GamProjection,
  GamRedeemResult,
  GamRedemption,
  GamUserAchievement,
} from '@/features/gamification/model';
import { watchRemoteFlags } from './remote-flags';
import type { GamPreferences, PreferenceUpdate, GamificationClient } from './types';

const db = () => getFirestore(getApp());

export const gamificationClient: GamificationClient = {
  watchFlags(receive) {
    return watchRemoteFlags(async () => {
      if (!(await isSupported())) throw new Error('Remote Config is unavailable');
      const config = getRemoteConfig(getApp());
      return {
        read: (key) => getString(config, key),
        activate: () => activate(config),
        fetchAndActivate: () => fetchAndActivate(config),
        onUpdate: (next, error) => onConfigUpdate(config, { next, error, complete: error }),
      };
    }, receive);
  },
  watchPreferences(uid, receive, failed) {
    return onSnapshot(
      doc(db(), 'gamPreferences', uid),
      (snapshot) => {
        receive(snapshot.exists() ? (snapshot.data() as GamPreferences) : {});
      },
      failed,
    );
  },
  async setPreferences(update) {
    const call = httpsCallable<PreferenceUpdate, { ok: boolean }>(
      getFunctions(getApp(), 'southamerica-east1'),
      'gamUpdatePreferences',
    );
    await call(update);
  },
  watchMember(uid, receive, failed) {
    return onSnapshot(
      doc(db(), 'gamification', uid),
      { includeMetadataChanges: true },
      (snapshot) => {
        receive(
          snapshot.exists() ? (snapshot.data() as GamProjection) : null,
          snapshot.metadata.fromCache,
        );
      },
      failed,
    );
  },
  watchLedger(uid, receive, failed) {
    const recent = query(
      collection(db(), 'gamification', uid, 'ledger'),
      orderBy('createdAt', 'desc'),
      limit(20),
    );
    return onSnapshot(
      recent,
      (snapshot) => {
        receive(
          snapshot.docs.map((entry) => ({ ...(entry.data() as GamLedgerEntry), id: entry.id })),
        );
      },
      failed,
    );
  },
  watchAchievements(uid, receive, failed) {
    return onSnapshot(
      collection(db(), 'gamification', uid, 'achievements'),
      (snapshot) => {
        receive(
          snapshot.docs.map((entry) => ({ ...(entry.data() as GamUserAchievement), id: entry.id })),
        );
      },
      failed,
    );
  },
  watchCelebrations(uid, receive, failed) {
    const unseen = query(
      collection(db(), 'gamification', uid, 'celebrations'),
      where('seenAt', '==', null),
      orderBy('createdAt', 'desc'),
      limit(10),
    );
    return onSnapshot(
      unseen,
      (snapshot) => {
        receive(
          snapshot.docs.map((entry) => ({ ...(entry.data() as GamCelebration), id: entry.id })),
        );
      },
      failed,
    );
  },
  watchCatalog(receive, failed) {
    return onSnapshot(
      query(collection(db(), 'catalog'), where('active', '==', true), limit(50)),
      (snapshot) => {
        receive(
          snapshot.docs.map((entry) => ({ ...(entry.data() as GamCatalogItem), id: entry.id })),
        );
      },
      failed,
    );
  },
  watchRedemptions(uid, receive, failed) {
    return onSnapshot(
      query(
        collection(db(), 'redemptions'),
        where('uid', '==', uid),
        orderBy('createdAt', 'desc'),
        limit(25),
      ),
      (snapshot) => {
        receive(
          snapshot.docs.map((entry) => ({ ...(entry.data() as GamRedemption), id: entry.id })),
        );
      },
      failed,
    );
  },
  markSeen(uid, id) {
    return updateDoc(doc(db(), 'gamification', uid, 'celebrations', id), {
      seenAt: serverTimestamp(),
    });
  },
  async redeem(itemId, idempotencyKey) {
    const call = httpsCallable<{ itemId: string; idempotencyKey: string }, GamRedeemResult>(
      getFunctions(getApp(), 'southamerica-east1'),
      'redeem',
    );
    return (await call({ itemId, idempotencyKey })).data;
  },
};
