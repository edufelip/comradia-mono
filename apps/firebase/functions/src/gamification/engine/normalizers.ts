// Normalizers: existing Firestore writes -> GamEvents. Everything here is pure
// and computed only from timing and counts. The engine never reads message text:
// callers query messages with .select('from', 'createdAt') and pass summaries in,
// so the privacy boundary is structural, not a convention (spec §11).

import type { GamEvent } from '../model';

/** Numeric facts the evaluator's rule conditions compare. */
export type GamFacts = Record<string, number>;

export type DerivedEvent = {
  kind: GamEvent['kind'];
  uid: string;
  pairKey?: string;
  facts: GamFacts;
};

/** Message metadata as the engine is allowed to see it: who, when. Never text. */
export type MessageSummary = { from: string; at: number };

export type MessageDerivationInput = {
  matchId: string;
  /** Sorted pair, as in the match document. */
  users: [string, string];
  sender: string;
  matchCreatedAt: number;
  /** Messages already in the match before this one, oldest first. */
  priorMessages: MessageSummary[];
  /** This message's creation time (epoch ms). */
  at: number;
  timezone: string;
  /** Account age in days for the two pair members (epoch ms -> days). */
  accountAgeDays: [number, number];
  /** Pair cap already reached: skip deriving the (re-awardable) event entirely. */
  pairAlready: { conversationStarted: boolean; conversationSustained: boolean };
  /** Minimum counts the active rules demand, so candidates are emitted only when
   * the rule set could still award (the evaluator's conditions stay authoritative). */
  gates: { messagesEach: number; activeDaysEach: number };
};

function distinctDays(messages: MessageSummary[], uid: string, timezone: string): number {
  const days = new Set<string>();
  for (const message of messages) {
    if (message.from !== uid) continue;
    days.add(new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(message.at)));
  }
  return days.size;
}

/**
 * Derives the message events for one new message: message.first_in_match,
 * message.timely_reply, conversation.started and conversation.sustained. A
 * conversation.* event carries the pair's first uid; the evaluator expands
 * award.to 'both_participants' from the pair key.
 */
export function deriveMessageEvents(input: MessageDerivationInput): {
  events: DerivedEvent[];
  recvFor: string;
} {
  const events: DerivedEvent[] = [];
  const [first, second] = input.users;
  const other = input.sender === first ? second : first;
  const facts: GamFacts = {
    'match.ageHours': (input.at - input.matchCreatedAt) / 3_600_000,
    'conversation.messagesEach': 0,
    'conversation.spanMinutes': 0,
    'conversation.activeDaysEach': 0,
    'conversation.spanDays': 0,
    'account.ageDays': Math.min(...input.accountAgeDays),
    'reply.waitedHours': Number.POSITIVE_INFINITY,
  };
  const recvFor = other;

  if (input.priorMessages.length === 0) {
    events.push({
      kind: 'message.first_in_match',
      uid: input.sender,
      pairKey: input.matchId,
      facts: { 'match.ageHours': facts['match.ageHours'] },
    });
  } else {
    const previous = input.priorMessages[input.priorMessages.length - 1] as MessageSummary;
    if (previous.from === other) {
      facts['reply.waitedHours'] = (input.at - previous.at) / 3_600_000;
      events.push({
        kind: 'message.timely_reply',
        uid: input.sender,
        pairKey: input.matchId,
        facts: { 'reply.waitedHours': facts['reply.waitedHours'] },
      });
    }
  }

  if (!input.pairAlready.conversationStarted || !input.pairAlready.conversationSustained) {
    const all: MessageSummary[] = [...input.priorMessages, { from: input.sender, at: input.at }];
    const countEach = Math.min(
      all.filter((m) => m.from === first).length,
      all.filter((m) => m.from === second).length,
    );
    const spanMs = all.length > 1 ? all[all.length - 1].at - all[0].at : 0;
    const activeDaysEach = Math.min(
      distinctDays(all, first, input.timezone),
      distinctDays(all, second, input.timezone),
    );
    facts['conversation.messagesEach'] = countEach;
    facts['conversation.spanMinutes'] = spanMs / 60_000;
    facts['conversation.activeDaysEach'] = activeDaysEach;
    facts['conversation.spanDays'] = spanMs / 86_400_000;

    if (!input.pairAlready.conversationStarted && countEach >= input.gates.messagesEach) {
      events.push({
        kind: 'conversation.started',
        uid: first,
        pairKey: input.matchId,
        facts: {
          'conversation.messagesEach': facts['conversation.messagesEach'],
          'conversation.spanMinutes': facts['conversation.spanMinutes'],
          'account.ageDays': facts['account.ageDays'],
        },
      });
    }
    if (!input.pairAlready.conversationSustained && activeDaysEach >= input.gates.activeDaysEach) {
      events.push({
        kind: 'conversation.sustained',
        uid: first,
        pairKey: input.matchId,
        facts: {
          'conversation.activeDaysEach': facts['conversation.activeDaysEach'],
          'conversation.spanDays': facts['conversation.spanDays'],
        },
      });
    }
  }
  return { events, recvFor };
}

export type ProfileSnapshot = {
  photoPath: string | null;
  promptId: string;
  promptAnswer: string;
};

/**
 * Profile writes: photoPath null -> set is profile.photo_added, set -> null is
 * the profile.photo_removed trigger, and a changed prompt answer or prompt id is
 * profile.prompt_refreshed (the 1-per-30-days cap lives in the rule set).
 */
export function deriveProfileEvents(
  uid: string,
  before: ProfileSnapshot | null,
  after: ProfileSnapshot,
): DerivedEvent[] {
  const events: DerivedEvent[] = [];
  if (before === null) {
    if (after.photoPath !== null) {
      events.push({ kind: 'profile.photo_added', uid, facts: {} });
    }
    return events;
  }
  if (before.photoPath === null && after.photoPath !== null) {
    events.push({ kind: 'profile.photo_added', uid, facts: {} });
  }
  if (before.photoPath !== null && after.photoPath === null) {
    events.push({ kind: 'profile.photo_removed', uid, facts: {} });
  }
  if (before.promptId !== after.promptId || before.promptAnswer !== after.promptAnswer) {
    events.push({ kind: 'profile.prompt_refreshed', uid, facts: {} });
  }
  return events;
}

/**
 * The minimum fact thresholds demanded by the active rules for the two derived
 * conversation events, so trigger handlers only run award transactions when the
 * rule set could still award (conditions in the evaluator stay authoritative).
 */
export function conversationGates(earnRules: Array<{ event: string; conditions?: Array<{ fact: string; op: string; value: number }> }>): {
  messagesEach: number;
  activeDaysEach: number;
} {
  let messagesEach = 3;
  let activeDaysEach = 3;
  for (const rule of earnRules) {
    if (rule.event === 'conversation.started') {
      const fact = rule.conditions?.find((condition) => condition.fact === 'conversation.messagesEach');
      if (fact) messagesEach = fact.value;
    }
    if (rule.event === 'conversation.sustained') {
      const fact = rule.conditions?.find((condition) => condition.fact === 'conversation.activeDaysEach');
      if (fact) activeDaysEach = fact.value;
    }
  }
  return { messagesEach, activeDaysEach };
}
