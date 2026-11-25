import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { clawbackEntryId, GAM_EARN_EVENTS, ledgerEntryId } from '../src/gamification/model.js';
import { loadRuleSet, validateRuleSet } from '../src/gamification/ruleset.js';

const SEED = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
  'gamification',
  'seed',
  'ruleset-v1.json',
);

/** Parsed JSON as a loose record, for the mutation cases below. */
type Draft = Record<string, unknown>;

const parsedSeed = JSON.parse(readFileSync(SEED, 'utf8')) as Draft;

/** A fresh deep copy of the seed with one mutation applied. */
function mutated(mutate: (draft: Draft) => void): unknown {
  const copy = JSON.parse(JSON.stringify(parsedSeed)) as Draft;
  mutate(copy);
  return copy;
}

function earnRule(draft: Draft, index: number): Draft {
  return (draft.earnRules as Draft[])[index] as Draft;
}

/** assert.throws matcher: an Error whose message contains `fragment`. */
function throwsWith(fragment: string): (error: unknown) => boolean {
  return (error) => error instanceof Error && error.message.includes(fragment);
}

it('rejects unsupported idempotency tokens and non-reversible clawback keys', () => {
  for (const key of ['{ruleId}:{unknown}:{uid}', '{ruleId}:{messageId}:{uid}']) {
    assert.throws(() => validateRuleSet(mutated((draft) => {
      earnRule(draft, 0).idempotencyKey = key;
    })), throwsWith('idempotencyKey'));
  }
});

describe('seed rule set v1', () => {
  const ruleSet = loadRuleSet(SEED);
  const byId = new Map(ruleSet.earnRules.map((rule) => [rule.id, rule]));

  it('covers every earn event in the shared contract', () => {
    const events = new Set(ruleSet.earnRules.map((rule) => rule.event));
    assert.deepEqual([...events].sort(), [...GAM_EARN_EVENTS].sort());
  });

  it('prices and caps every section-4 row exactly as specified', () => {
    assert.deepEqual(
      Object.fromEntries(ruleSet.earnRules.map((rule) => [rule.id, rule.award.amount])),
      {
        conversation_started: 30,
        conversation_sustained: 40,
        message_first_in_match: 10,
        message_timely_reply: 5,
        match_created: 5,
        profile_photo_added: 30,
        profile_prompt_refreshed: 10,
        streak_week_completed: 15,
        streak_milestone_4: 50,
        streak_milestone_12: 100,
        streak_milestone_26: 200,
        streak_milestone_52: 400,
        quest_completed: 25,
      },
    );
    assert.deepEqual(
      Object.fromEntries(ruleSet.earnRules.map((rule) => [rule.id, rule.caps])),
      {
        conversation_started: { perDay: 3, perPairLifetime: 1 },
        conversation_sustained: { perWeek: 2, perPairLifetime: 1 },
        message_first_in_match: { perDay: 5, perPairLifetime: 1 },
        message_timely_reply: { perDay: 6, perPairPerDay: 1, minGapHours: 2 },
        match_created: { perDay: 3, perPairLifetime: 1 },
        profile_photo_added: { lifetime: 1 },
        profile_prompt_refreshed: { per30Days: 1 },
        streak_week_completed: { perWeek: 1 },
        streak_milestone_4: { lifetime: 1 },
        streak_milestone_12: { lifetime: 1 },
        streak_milestone_26: { lifetime: 1 },
        streak_milestone_52: { lifetime: 1 },
        quest_completed: { perWeek: 1 },
      },
    );
  });

  it('holds pair rewards for 24 h (started) and 72 h (first message)', () => {
    assert.deepEqual(byId.get('conversation_started')?.hold, {
      hours: 24,
      releaseIf: 'no_report_no_block',
    });
    assert.deepEqual(byId.get('message_first_in_match')?.hold, {
      hours: 72,
      releaseIf: 'other_replied',
    });
    assert.equal(byId.get('match_created')?.hold, undefined);
  });

  it('takes conversation.started back on unmatch, upheld report or block', () => {
    assert.equal(byId.get('conversation_started')?.clawback?.length, 3);
  });

  it('keeps the level ladder and achievements equal to the contract', () => {
    const levels = ruleSet.levels.map((level) => ({ id: level.id, threshold: level.threshold }));
    assert.deepEqual(levels, [
      { id: 'botao', threshold: 0 },
      { id: 'flor', threshold: 300 },
      { id: 'ramalhete', threshold: 1000 },
      { id: 'jardim', threshold: 2500 },
      { id: 'primavera', threshold: 5000 },
    ]);
    assert.deepEqual(
      ruleSet.achievements.map((a) => ({ id: a.id, kind: a.kind, tiers: a.tiers })),
      [
        { id: 'faisca', kind: 'progress', tiers: [1, 5, 20] },
        { id: 'papo', kind: 'progress', tiers: [1, 5, 15] },
        { id: 'passo', kind: 'progress', tiers: [3, 10, 30] },
        { id: 'vacuo', kind: 'progress', tiers: [10, 50, 200] },
        { id: 'constancia', kind: 'streak', tiers: [4, 12, 26] },
        { id: 'cartao', kind: 'progress', tiers: [1, 3, 6] },
        { id: 'roda', kind: 'active', tiers: [1, 3, 6] },
        { id: 'escuta', kind: 'active', tiers: [5, 10, 20] },
        { id: 'primavera', kind: 'seasonal', tiers: [3, 6, 12] },
        { id: 'maio', kind: 'campaign', tiers: [2, 4, 8] },
        { id: 'namorados', kind: 'seasonal', tiers: [1, 2, 3] },
      ],
    );
  });
});

describe('rule-set validation rejects drift', () => {
  it('rejects an event outside the contract', () => {
    assert.throws(
      () => validateRuleSet(mutated((draft) => {
        earnRule(draft, 0).event = 'swipe.like';
      })),
      throwsWith('event must be one of'),
    );
  });

  it('rejects a rule with no caps', () => {
    assert.throws(
      () => validateRuleSet(mutated((draft) => {
        delete earnRule(draft, 0).caps;
      })),
      throwsWith('caps is required'),
    );
    assert.throws(
      () => validateRuleSet(mutated((draft) => {
        earnRule(draft, 0).caps = {};
      })),
      throwsWith('needs at least one cap'),
    );
  });

  it('accepts tuned thresholds and rejects a ladder that moves backward', () => {
    assert.equal(validateRuleSet(mutated((draft) => {
      (draft.levels as Draft[])[1] = { id: 'flor', name: 'Flor', threshold: 250 };
    })).levels[1].threshold, 250);
    assert.throws(() => validateRuleSet(mutated((draft) => {
      (draft.levels as Draft[])[1] = { id: 'flor', name: 'Flor', threshold: 1500 };
    })), throwsWith('in an increasing ladder'));
  });

  it('rejects non-increasing badge thresholds and changes to registered kinds', () => {
    assert.throws(
      () => validateRuleSet(mutated((draft) => {
        ((draft.achievements as Draft[])[0] as Draft).tiers = [5, 2, 20];
      })),
      throwsWith('tiers must contain three increasing thresholds'),
    );
    assert.throws(
      () => validateRuleSet(mutated((draft) => {
        ((draft.achievements as Draft[])[4] as Draft).kind = 'progress';
      })),
      throwsWith('kind must be streak'),
    );
  });

  it('rejects an active achievement with no rolling window', () => {
    assert.throws(
      () => validateRuleSet(mutated((draft) => {
        delete ((draft.achievements as Draft[])[6] as Draft).windowWeeks;
      })),
      throwsWith('needs windowDays or windowWeeks + windowNeedWeeks'),
    );
  });

  it('rejects a seasonal achievement without dates', () => {
    assert.throws(
      () => validateRuleSet(mutated((draft) => {
        delete ((draft.achievements as Draft[])[8] as Draft).season;
      })),
      throwsWith('a seasonal achievement needs season dates'),
    );
  });

  it('rejects seasons that end before they start', () => {
    assert.throws(
      () => validateRuleSet(mutated((draft) => {
        ((draft.campaigns as Draft[])[1] as Draft).startsOn = '2027-05-02';
      })),
      throwsWith('startsOn must not be after endsOn'),
    );
  });

  it('rejects milestone weeks no rule awards', () => {
    assert.throws(
      () => validateRuleSet(mutated((draft) => {
        (draft.streakRules as Draft).milestonesWeeks = [4, 12, 26, 52, 78];
      })),
      throwsWith('no rule awards the 78-week milestone'),
    );
  });

  it('rejects a milestone rule outside streakRules.milestonesWeeks', () => {
    assert.throws(
      () => validateRuleSet(mutated((draft) => {
        earnRule(draft, 8).conditions = [{ fact: 'streak.weeks', op: '==', value: 5 }];
      })),
      throwsWith('milestone week 5 is not in streakRules.milestonesWeeks'),
    );
  });

  it('rejects an achievement pointing at an unknown campaign', () => {
    assert.throws(
      () => validateRuleSet(mutated((draft) => {
        ((draft.achievements as Draft[])[8] as Draft).src = 'campaign:unknown';
      })),
      throwsWith('points at unknown campaign unknown'),
    );
  });

  it('rejects unknown fields and duplicate rule ids', () => {
    assert.throws(
      () => validateRuleSet(mutated((draft) => {
        draft.extraField = true;
      })),
      throwsWith('extraField is not a known field'),
    );
    assert.throws(
      () => validateRuleSet(mutated((draft) => {
        earnRule(draft, 1).id = 'conversation_started';
      })),
      throwsWith('duplicated id conversation_started'),
    );
  });

  it('rejects an invalid parent version', () => {
    assert.throws(
      () => validateRuleSet(mutated((draft) => {
        draft.parentVersion = 0;
      })),
      throwsWith('parentVersion must be null or an integer >= 1'),
    );
  });
});

describe('ledger entry ids', () => {
  it('is the idempotency key shape from the spec', () => {
    assert.equal(
      ledgerEntryId('conversation_started', 'ab12_cd34', 'ab12'),
      'conversation_started:ab12_cd34:ab12',
    );
  });

  it('keys a clawback off the original entry', () => {
    assert.equal(
      clawbackEntryId('conversation_started:ab12_cd34:ab12'),
      'clawback:conversation_started:ab12_cd34:ab12',
    );
  });
});
