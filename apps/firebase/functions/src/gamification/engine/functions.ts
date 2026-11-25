import { getFirestore, Timestamp, type DocumentSnapshot } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { getRemoteConfig } from 'firebase-admin/remote-config';
import { defineSecret } from 'firebase-functions/params';
import { onDocumentCreated, onDocumentDeleted, onDocumentWritten } from 'firebase-functions/v2/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { matchMembers, recordClawback, recordMatch, recordMessage, recordPairSafety, recordProfile } from './activity';
import { armFor, RemoteConfigFlagsProvider } from './flags';
import { updatePreferences } from './preferences';
import { FirestoreRuleSetLoader } from './ruleset-loader';
import { GamEngineStore } from './store';
import { alertCravosVelocity, sendStreakPush } from './push';
import { hourAndWeekdayInZone } from './weeks';
import { runGamificationWeek, sendCravosReminders } from './weekly';
import type { EngineDeps } from './evaluator';

const region = 'southamerica-east1';
const pairSalt = defineSecret('GAM_PAIR_SALT');
const base = { region, retry: true, maxInstances: 2, secrets: [pairSalt] };

const flags = new RemoteConfigFlagsProvider(async () => {
  const template = await getRemoteConfig().getTemplate();
  const valueOf = (key: string) => {
    const parameters = template.parameters[key] ?? Object.values(template.parameterGroups)
      .map(({ parameters }) => parameters[key]).find((parameter) => parameter !== undefined);
    const value = parameters?.defaultValue;
    return value && 'value' in value ? value.value : undefined;
  };
  return {
    getBoolean: (key: string) => valueOf(key) === 'true',
    getNumber: (key: string) => Number(valueOf(key) ?? 0),
  };
});

let instance: EngineDeps | undefined;
function deps(): EngineDeps {
  const db = getFirestore();
  instance ??= {
    store: new GamEngineStore(db, pairSalt.value()),
    rules: new FirestoreRuleSetLoader(db),
    flags,
    now: Date.now,
    velocityAlert: (kind, uid, day) => alertCravosVelocity(db, uid, kind, day),
  };
  return instance;
}

function activity(doc: DocumentSnapshot, event: { time: string; id: string }) {
  return { at: Timestamp.fromDate(new Date(event.time)), id: event.id, path: doc.ref.path };
}

export const gamOnMatchCreated = onDocumentCreated({ ...base, document: 'matches/{matchId}' }, async (event) => {
  if (event.data) await recordMatch(deps(), event.data, event.id);
});

export const gamOnMatchDeleted = onDocumentDeleted({ ...base, document: 'matches/{matchId}' }, async (event) => {
  if (!event.data) return;
  const users = matchMembers(event.params.matchId, event.data.get('users'));
  if (users !== null) await recordClawback(deps(), activity(event.data, event), 'match.deleted', users[0], event.params.matchId);
});

export const gamOnMessageCreated = onDocumentCreated(
  { ...base, document: 'matches/{matchId}/messages/{messageId}' },
  async (event) => {
    if (event.data) await recordMessage(deps(), event.data, event.id);
  },
);

export const gamOnProfileWritten = onDocumentWritten({ ...base, document: 'profiles/{uid}' }, async (event) => {
  if (!event.data) return;
  await recordProfile(deps(), event.data.before, event.data.after, activity(event.data.after, event), async (path) => {
    const match = /^photos\/([^/]+)\/[A-Za-z0-9_-]{1,64}\.jpg$/.exec(path);
    if (match?.[1] !== event.params.uid) return false;
    const [exists] = await getStorage().bucket().file(path).exists();
    return exists;
  });
});

export const gamOnBlockCreated = onDocumentCreated(
  { ...base, document: 'blocks/{target}/by/{blocker}' },
  async (event) => {
    if (event.data) await recordPairSafety(deps(), activity(event.data, event), 'block.created', event.params.blocker, event.params.target);
  },
);

export const gamOnReportWritten = onDocumentWritten({ ...base, document: 'reports/{id}' }, async (event) => {
  const after = event.data?.after;
  if (!event.data || !after?.exists) return;
  if (!event.data.before.exists) {
    await recordPairSafety(deps(), activity(after, event), 'report.created', after.get('reporter'), after.get('target'));
  } else if (after.get('resolution') === 'upheld' && event.data.before.get('resolution') !== 'upheld') {
    // Report updates are denied by Firestore rules, so only staff can uphold a report.
    await recordPairSafety(deps(), activity(after, event), 'report.upheld', after.get('reporter'), after.get('target'));
  }
});

export const gamCloseWeek = onSchedule({
  region, secrets: [pairSalt], schedule: '0 3,18 * * 0,1', timeZone: 'America/Sao_Paulo', retryCount: 3,
}, async (event) => {
  const now = Date.parse(event.scheduleTime);
  const { weekday, hour } = hourAndWeekdayInZone(now, 'America/Sao_Paulo');
  if (weekday === 'Mon' && hour === 3) await runGamificationWeek(deps(), now);
  if (weekday === 'Sun' && hour === 18) {
    await sendCravosReminders(deps(), now, (uid, week) => sendStreakPush(getFirestore(), uid, week));
  }
});

export const gamUpdatePreferences = onCall({ region, enforceAppCheck: true, secrets: [pairSalt] }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in to update Cravos preferences.');
  const settings = await flags.getFlags();
  if (settings.killSwitch || settings.shadow || !settings.uiEnabled || armFor(uid, settings.experimentPct) !== 'treatment') {
    throw new HttpsError('failed-precondition', 'Cravos is unavailable for this account.');
  }
  const { streakRules } = await deps().rules.loadActive();
  return updatePreferences(getFirestore(), uid, request.data, streakRules.maxPauseWeeks, streakRules.timezone);
});
