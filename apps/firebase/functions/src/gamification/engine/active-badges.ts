import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { GamAchievementRule } from '../model';
import type { EngineCore } from './evaluator';
import type { EngineTransaction } from './store';
import { addIsoDays } from './weeks';

const DAY_MS = 86_400_000;

export function activeTier(tiers: number[], count: number): number {
  return tiers.reduce((highest, threshold, tier) => count >= threshold ? tier : highest, -1);
}

async function countActiveWindows(
  core: EngineCore, tx: EngineTransaction, uid: string, shadow: boolean, rule: GamAchievementRule, closed: string,
) {
  const window = rule.windowWeeks;
  const minimum = rule.windowNeedWeeks;
  if (!window || !minimum) return 0;
  const windows = Math.min(Math.max(...rule.tiers), Math.floor(200 / window));
  if (windows === 0) return 0;
  const counters = await tx.getAll(...Array.from({ length: windows * window }, (_, index) =>
    core.store.counterRef(uid, shadow, `qualweek:${addIsoDays(closed, -7 * index)}`)));
  let count = 0;
  for (let start = 0; start < counters.length; start += window) {
    if (counters.slice(start, start + window).filter((week) => week.exists).length < minimum) break;
    count += 1;
  }
  return count;
}

export async function countResponsiveConversations(
  core: EngineCore, tx: EngineTransaction, uid: string, shadow: boolean, rule: GamAchievementRule, nowMs: number,
) {
  // Ignore incoming turns less than 24 hours old to allow the full response window.
  const from = Timestamp.fromMillis(nowMs - (rule.windowDays ?? 30) * DAY_MS);
  const upTo = Timestamp.fromMillis(nowMs - DAY_MS);
  const collection = core.store.projectionRef(uid, shadow).collection('gamReplies');
  const { docs } = await tx.get(
    collection.where('at', '>=', from).where('at', '<=', upTo).limit(1001),
  );
  if (docs.length > 1000 || docs.length === 0) return 0;
  const answered = docs.filter((doc) => doc.get('timely') === true).length;
  if (answered * 100 / docs.length < (rule.replyRatePct ?? 80)) return 0;
  return new Set(docs.flatMap((doc) => {
    const pair: unknown = doc.get('pair');
    return typeof pair === 'string' ? [pair] : [];
  })).size;
}

export async function refreshActiveBadges(
  core: EngineCore, uid: string, shadow: boolean, closed: string, nowMs: number,
) {
  if (shadow) return;
  const active = core.ruleSet.achievements.filter((rule) => rule.kind === 'active');
  const projection = core.store.projectionRef(uid, shadow);
  await core.store.runTransaction(async (tx) => {
    const [profile, prefs] = await tx.getAll(
      core.store.firestore.doc(`users/${uid}`), core.store.firestore.doc(`gamPreferences/${uid}`),
    );
    if (!profile.exists || prefs.get('optedOut') === true) return;
    for (const rule of active) {
      const count = rule.src === 'streak.week_qualified'
        ? await countActiveWindows(core, tx, uid, shadow, rule, closed)
        : await countResponsiveConversations(core, tx, uid, shadow, rule, nowMs);
      const ref = projection.collection('achievements').doc(rule.id);
      const previous = await tx.get(ref);
      const tier = activeTier(rule.tiers, count);
      if (tier < 0) {
        if (previous.exists && previous.get('status') !== 'lapsed') tx.set(ref, {
          status: 'lapsed', updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        continue;
      }
      if (previous.get('status') === 'unlocked' && previous.get('tier') === tier) continue;
      tx.set(ref, {
        tier, status: 'unlocked', unlockedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
      });
      if (!previous.exists || previous.get('status') === 'lapsed' || (previous.get('tier') as number) < tier) {
        tx.create(projection.collection('celebrations').doc(`active:${rule.id}:${closed}`), {
          kind: tier === 2 && core.flags.fullscreenCelebrations ? 'fullscreen' : 'toast',
          copyKey: `gam.achievement.${rule.id}`, achievementId: rule.id, achievementTier: tier,
          createdAt: FieldValue.serverTimestamp(), seenAt: null,
        });
      }
    }
  });
}
