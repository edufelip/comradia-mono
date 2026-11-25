import { getFirestore, Timestamp, type DocumentSnapshot } from 'firebase-admin/firestore';
import { getRemoteConfig } from 'firebase-admin/remote-config';
import { defineSecret } from 'firebase-functions/params';
import { onDocumentCreated, onDocumentDeleted, onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { matchMembers, recordClawback, recordMatch, recordMessage, recordPairSafety, recordProfile } from './activity';
import { RemoteConfigFlagsProvider } from './flags';
import { FirestoreRuleSetLoader } from './ruleset-loader';
import { GamEngineStore } from './store';
import { runGamificationWeek } from './weekly';
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
  if (event.data) await recordProfile(deps(), event.data.before, event.data.after, activity(event.data.after, event));
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
  region, secrets: [pairSalt], schedule: '0 3 * * 1', timeZone: 'America/Sao_Paulo', retryCount: 3,
}, async (event) => {
  await runGamificationWeek(deps(), Date.parse(event.scheduleTime));
});
