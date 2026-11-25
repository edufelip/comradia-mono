import { createHash } from 'node:crypto';
import { FieldPath, Timestamp, type DocumentSnapshot } from 'firebase-admin/firestore';
import { applyTrigger } from './clawbacks';
import { markQualified, processEvent, releaseHold, type EngineCore, type EngineDeps } from './evaluator';
import { engineEnabled, shadowTarget } from './flags';
import { deriveMessageEvents, deriveProfileEvents, type DerivedEvent } from './normalizers';
import { parseProjection } from './store';
import { weekStartOf } from './weeks';

const DAY_MS = 86_400_000;
const MESSAGE_LOOKBACK = 100;

type Activity = { at: Timestamp; path: string; id: string };
type MatchMembers = [string, string];

function samePair(left: unknown, right: unknown): MatchMembers | null {
  if (typeof left !== 'string' || typeof right !== 'string' || left === right ||
    !/^[^/_]+$/.test(left) || !/^[^/_]+$/.test(right)) return null;
  return left < right ? [left, right] : [right, left];
}

export function matchMembers(matchId: string, value: unknown): MatchMembers | null {
  if (!Array.isArray(value) || value.length !== 2 || value.join('_') !== matchId) return null;
  const users = samePair(value[0], value[1]);
  return users !== null && users[0] === value[0] ? users : null;
}

export async function loadEngine(deps: EngineDeps): Promise<EngineCore | null> {
  const flags = await deps.flags.getFlags();
  return engineEnabled(flags) ? { store: deps.store, flags, ruleSet: await deps.rules.loadActive(), now: deps.now } : null;
}

function snapshotTime(snap: DocumentSnapshot, field: string): Timestamp | null {
  const value: unknown = snap.get(field);
  return value instanceof Timestamp ? value : null;
}

function dispatch(activity: Activity, derived: DerivedEvent, deps: EngineDeps) {
  return processEvent({
    event: {
      kind: derived.kind, uid: derived.uid, pairKey: derived.pairKey,
      source: activity.path, eventId: activity.id, at: activity.at,
    },
    facts: derived.facts,
  }, deps);
}

export async function recordMatch(deps: EngineDeps, match: DocumentSnapshot, id: string) {
  if (!engineEnabled(await deps.flags.getFlags())) return;
  const users = matchMembers(match.id, match.get('users'));
  const at = snapshotTime(match, 'createdAt');
  if (users === null || at === null) return;
  const current = await match.ref.get();
  if (!snapshotTime(current, 'createdAt')?.isEqual(at)) return;
  await dispatch({ at, id, path: match.ref.path }, {
    kind: 'match.created', uid: users[0], pairKey: match.id, facts: {},
  }, deps);
}

async function qualifyCurrentWeek(core: EngineCore, uid: string, at: Timestamp) {
  if (!core.ruleSet.streakRules.qualifyingEvents.includes('message.created')) return;
  const timezone = core.ruleSet.streakRules.timezone;
  const week = weekStartOf(at.toMillis(), timezone);
  if (week !== weekStartOf(core.now(), timezone)) return;
  const shadow = shadowTarget(core.flags, uid);
  await core.store.runTransaction(async (tx) => {
    const [account, preference, counter, projection] = await tx.getAll(
      core.store.firestore.doc(`users/${uid}`),
      core.store.firestore.doc(`gamPreferences/${uid}`),
      core.store.counterRef(uid, shadow, `qualweek:${week}`),
      core.store.projectionRef(uid, shadow),
    );
    if (account.exists && preference.get('optedOut') !== true && !counter.exists) markQualified(tx, core, uid, shadow, week, parseProjection(projection.data()));
  });
}

async function sharePushToken(first: DocumentSnapshot, second: DocumentSnapshot) {
  const tokens = await first.ref.collection('pushTokens').select().get();
  if (tokens.empty) return false;
  const other = await second.ref.firestore.getAll(
    ...tokens.docs.map((doc) => second.ref.collection('pushTokens').doc(doc.id)),
  );
  return other.some((token) => token.exists);
}

export async function recordMessage(deps: EngineDeps, message: DocumentSnapshot, id: string) {
  const core = await loadEngine(deps);
  if (core === null) return;
  const at = snapshotTime(message, 'createdAt');
  const sender: unknown = message.get('from');
  const match = await message.ref.parent.parent?.get();
  if (!match?.exists || at === null || typeof sender !== 'string') return;
  const users = matchMembers(match.id, match.get('users'));
  const since = snapshotTime(match, 'createdAt');
  if (users === null || since === null || !users.includes(sender) || at.toMillis() < since.toMillis()) return;

  const db = core.store.firestore;
  const [accounts, history] = await Promise.all([
    db.getAll(db.doc(`users/${users[0]}`), db.doc(`users/${users[1]}`)),
    message.ref.parent.select('from', 'createdAt').orderBy('createdAt').orderBy(FieldPath.documentId())
      .endBefore(at, message.id).limitToLast(MESSAGE_LOOKBACK).get(),
  ]);
  if (accounts.some((account) => !account.exists)) return;
  const priorMessages = history.docs.flatMap((doc) => {
    const from: unknown = doc.get('from');
    const time = snapshotTime(doc, 'createdAt');
    return typeof from === 'string' && time !== null && time.toMillis() >= since.toMillis()
      ? [{ id: doc.id, from, at: time.toMillis() }] : [];
  });
  const other = users[0] === sender ? users[1] : users[0];
  let turn = priorMessages.length - 1;
  while (turn > 0 && priorMessages[turn - 1].from === priorMessages[turn].from) turn -= 1;
  const previous = priorMessages[turn];
  const pair = core.store.pairBucketKey(match.id);
  // Record turn boundaries and timing only. No message text, contact identifiers, or profile values.
  const responseKey = (id: string) => createHash('sha256').update(`${pair}:${id}`).digest('hex');
  if (previous?.from !== sender) {
    const inbound = core.store.projectionRef(other, shadowTarget(core.flags, other))
      .collection('gamReplies').doc(responseKey(message.id));
    const senderResponse = previous ? core.store.projectionRef(sender, shadowTarget(core.flags, sender))
      .collection('gamReplies').doc(responseKey(previous.id)) : null;
    await db.runTransaction(async (tx) => {
      const prefs = await tx.getAll(db.doc(`gamPreferences/${other}`), db.doc(`gamPreferences/${sender}`),
        db.doc(`users/${other}`), db.doc(`users/${sender}`));
      if (prefs[2].exists && prefs[0].get('optedOut') !== true) {
        tx.set(inbound, { pair, at, expireAt: Timestamp.fromMillis(at.toMillis() + 45 * DAY_MS) }, { merge: true });
      }
      if (senderResponse !== null && previous !== undefined && prefs[3].exists && prefs[1].get('optedOut') !== true) {
        tx.set(senderResponse, {
          pair, at: Timestamp.fromMillis(previous.at), timely: at.toMillis() - previous.at <= DAY_MS,
          expireAt: Timestamp.fromMillis(previous.at + 45 * DAY_MS),
        }, { merge: true });
      }
    });
  }

  for (const rule of core.ruleSet.earnRules) {
    if (!rule.hold || (rule.caps.perPairLifetime === undefined && rule.caps.perPairPerDay === undefined)) continue;
    for (const recipient of users) {
      await releaseHold(core, recipient, shadowTarget(core.flags, recipient), rule, pair,
        rule.hold.releaseIf === 'other_replied' && recipient === other);
    }
  }
  await qualifyCurrentWeek(core, sender, at);

  const [first, second] = accounts;
  const age = (account: DocumentSnapshot) => {
    const createdAt = snapshotTime(account, 'createdAt');
    return createdAt === null ? 0 : (at.toMillis() - createdAt.toMillis()) / DAY_MS;
  };
  const { events } = deriveMessageEvents({
    matchId: match.id, users, sender, matchCreatedAt: since.toMillis(),
    priorMessages, at: at.toMillis(), timezone: core.ruleSet.streakRules.timezone,
    accountAgeDays: [age(first), age(second)],
    pairAlready: { conversationStarted: false, conversationSustained: false },
    // Record candidates before the current rule's condition so draft changes can be replayed.
    gates: { messagesEach: 1, activeDaysEach: 1 },
  });
  const blockedByToken = events.some((event) => event.kind.startsWith('conversation.')) &&
    await sharePushToken(first, second);
  for (const event of events) {
    if (blockedByToken && event.kind.startsWith('conversation.')) continue;
    await dispatch({ at, id, path: message.ref.path }, event, deps);
  }
}

function profileFields(snapshot: DocumentSnapshot) {
  const photo: unknown = snapshot.get('photoPath');
  const prompt: unknown = snapshot.get('promptId');
  const answer: unknown = snapshot.get('promptAnswer');
  return {
    photoPath: typeof photo === 'string' ? photo : null,
    promptId: typeof prompt === 'string' ? prompt : '',
    promptAnswer: typeof answer === 'string' ? answer : '',
  };
}

export async function recordProfile(
  deps: EngineDeps, before: DocumentSnapshot, after: DocumentSnapshot,
  activity: Activity, verifyPortrait: (path: string) => Promise<boolean>,
) {
  if (!after.exists || !engineEnabled(await deps.flags.getFlags())) return;
  const fields = profileFields(after);
  const events = deriveProfileEvents(after.id, before.exists ? profileFields(before) : null, fields);
  for (const event of events) {
    if (event.kind === 'profile.photo_removed') {
      await recordClawback(deps, activity, event.kind, after.id, null);
    } else {
      if (event.kind === 'profile.photo_added' && (fields.photoPath === null || !await verifyPortrait(fields.photoPath))) continue;
      await dispatch(activity, event, deps);
    }
  }
}

export async function recordClawback(
  deps: EngineDeps,
  activity: Activity,
  kind: 'match.deleted' | 'profile.photo_removed' | 'block.created' | 'report.created' | 'report.upheld',
  uid: string,
  pairKey: string | null,
) {
  const core = await loadEngine(deps);
  if (core === null) return;
  await applyTrigger(core, { kind, uid, pairKey, at: activity.at, sourcePath: activity.path, eventId: activity.id });
}

export async function recordPairSafety(
  deps: EngineDeps, activity: Activity, kind: 'block.created' | 'report.created' | 'report.upheld',
  actor: unknown, target: unknown,
) {
  const pair = samePair(actor, target);
  if (pair !== null && typeof target === 'string') await recordClawback(deps, activity, kind, target, pair.join('_'));
}
