// Loads and validates a Cravos rule set (gamRuleSets/{id}, seed file
// src/gamification/seed/ruleset-v1.json). The validator is hand-rolled on purpose: the
// functions package has no schema dependency, and every branch throws with the field
// path so a bad draft fails loudly in the admin editor and in tests.

import { readFileSync } from 'node:fs';
import {
  GAM_ACHIEVEMENTS,
  GAM_ACHIEVEMENT_KINDS,
  GAM_CELEBRATION_KINDS,
  GAM_EARN_EVENTS,
  GAM_LEVELS,
  GAM_TRIGGER_EVENTS,
  type GamAchievementKind,
  type GamAchievementRule,
  type GamCampaign,
  type GamLevelId,
  type GamLevelRule,
  type GamQuest,
  type GamRule,
  type GamRuleSet,
  type GamStreakRules,
} from './model';

type UnknownRecord = { [key: string]: unknown };

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown, path: string): UnknownRecord {
  if (!isRecord(value)) throw new Error(`${path} must be an object`);
  return value;
}

const RULE_SET_FIELDS = ['version', 'status', 'parentVersion', 'author', 'notes', 'earnRules',
  'quests', 'achievements', 'streakRules', 'campaigns', 'levels'] as const;
const RULE_STATUSES = ['draft', 'simulated', 'published', 'archived'] as const;
const AWARD_TOS = ['both_participants', 'sender', 'owner'] as const;
const CONDITION_OPS = ['>=', '<=', '==', '>', '<'] as const;
const CAP_KEYS = ['perDay', 'perWeek', 'per30Days', 'lifetime', 'perPairLifetime',
  'perPairPerDay', 'minGapHours'] as const;
const HOLD_RELEASE_IFS = ['no_report_no_block', 'other_replied'] as const;
const CLAWBACK_SCOPES = ['match', 'pair'] as const;
const CLAWBACK_PARTIES = ['reported', 'blocked'] as const;

function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${path} must be an array`);
  return value;
}

/** Rejects unknown fields (typos in a draft must not pass silently) and missing ones. */
function checkKeys(
  record: UnknownRecord,
  path: string,
  required: readonly string[],
  optional: readonly string[] = [],
): void {
  const allowed = new Set<string>([...required, ...optional]);
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) throw new Error(`${path}.${key} is not a known field`);
  }
  for (const key of required) {
    if (!(key in record)) throw new Error(`${path}.${key} is required`);
  }
}

function str(record: UnknownRecord, key: string, path: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${path}.${key} must be a non-empty string`);
  }
  return value;
}

function freeText(record: UnknownRecord, key: string, path: string): string {
  const value = record[key];
  if (typeof value !== 'string') throw new Error(`${path}.${key} must be a string`);
  return value;
}

function int(record: UnknownRecord, key: string, path: string, min: number, max?: number): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min) {
    throw new Error(`${path}.${key} must be an integer >= ${min}`);
  }
  if (max !== undefined && value > max) {
    throw new Error(`${path}.${key} must be an integer <= ${max}`);
  }
  return value;
}

function boolean(record: UnknownRecord, key: string, path: string): boolean {
  const value = record[key];
  if (typeof value !== 'boolean') throw new Error(`${path}.${key} must be a boolean`);
  return value;
}

function oneOf<T extends string>(
  record: UnknownRecord,
  key: string,
  path: string,
  values: readonly T[],
): T {
  const value = record[key];
  const found = typeof value === 'string' ? values.find((candidate) => candidate === value) : undefined;
  if (found === undefined) {
    throw new Error(`${path}.${key} must be one of ${values.join(', ')}`);
  }
  return found;
}

/** Reads an optional field with `read`; `undefined` (absent) is valid. */
function optionalField<V>(
  record: UnknownRecord,
  key: string,
  path: string,
  read: (value: unknown, path: string) => V,
): V | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  return read(value, `${path}.${key}`);
}

function eachOf<V>(values: unknown[], path: string, read: (value: unknown, path: string) => V): V[] {
  return values.map((value, index) => read(value, `${path}[${index}]`));
}

function uniqueIds<V>(items: V[], idOf: (item: V) => string, path: string): void {
  const seen = new Set<string>();
  for (const item of items) {
    const id = idOf(item);
    if (seen.has(id)) throw new Error(`${path} has a duplicated id ${id}`);
    seen.add(id);
  }
}

/** An optional positive integer field, shared by window and multiplier checks. */
function optionalInt(record: UnknownRecord, key: string, path: string): number | undefined {
  return optionalField(record, key, path, (value, keyPath) => int({ [key]: value }, key, keyPath, 1));
}

/** YYYY-MM-DD that is a real calendar date. */
function isoDate(record: UnknownRecord, key: string, path: string): string {
  const value = record[key];
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${path}.${key} must be a YYYY-MM-DD date`);
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error(`${path}.${key} is not a real calendar date`);
  }
  return value;
}

function validateRule(input: unknown, path: string): GamRule {
  const record = asRecord(input, path);
  checkKeys(record, path,
    ['id', 'track', 'event', 'award', 'caps', 'idempotencyKey'],
    ['conditions', 'hold', 'clawback', 'celebration', 'audience']);
  const awardRecord = asRecord(record.award, `${path}.award`);
  checkKeys(awardRecord, `${path}.award`, ['amount', 'to']);
  const capsRecord = asRecord(record.caps, `${path}.caps`);
  const presentCaps = CAP_KEYS.filter((key) => capsRecord[key] !== undefined);
  if (presentCaps.length === 0) {
    throw new Error(`${path}.caps needs at least one cap (spec §4 gives every rule one)`);
  }
  const caps: GamRule['caps'] = {};
  for (const key of presentCaps) caps[key] = int(capsRecord, key, `${path}.caps`, 1);
  const conditions = optionalField(record, 'conditions', path, (value, conditionsPath) => {
    const rows = eachOf(array(value, conditionsPath), conditionsPath, (row, rowPath) => {
      const rowRecord = asRecord(row, rowPath);
      checkKeys(rowRecord, rowPath, ['fact', 'op', 'value']);
      return {
        fact: str(rowRecord, 'fact', rowPath),
        op: oneOf(rowRecord, 'op', rowPath, CONDITION_OPS),
        value: int(rowRecord, 'value', rowPath, Number.MIN_SAFE_INTEGER),
      };
    });
    if (rows.length === 0) throw new Error(`${conditionsPath} must not be empty`);
    return rows;
  });
  const hold = optionalField(record, 'hold', path, (value, holdPath) => {
    const holdRecord = asRecord(value, holdPath);
    checkKeys(holdRecord, holdPath, ['hours', 'releaseIf']);
    return {
      hours: int(holdRecord, 'hours', holdPath, 1),
      releaseIf: oneOf(holdRecord, 'releaseIf', holdPath, HOLD_RELEASE_IFS),
    };
  });
  const clawback = optionalField(record, 'clawback', path, (value, clawbackPath) =>
    eachOf(array(value, clawbackPath), clawbackPath, (row, rowPath) => {
      const rowRecord = asRecord(row, rowPath);
      checkKeys(rowRecord, rowPath, ['on'], ['withinDays', 'scope', 'party']);
      const withinDays = optionalInt(rowRecord, 'withinDays', rowPath);
      const scope = optionalField(rowRecord, 'scope', rowPath,
        (v, p) => oneOf({ scope: v }, 'scope', p, CLAWBACK_SCOPES));
      const party = optionalField(rowRecord, 'party', rowPath,
        (v, p) => oneOf({ party: v }, 'party', p, CLAWBACK_PARTIES));
      return {
        on: oneOf(rowRecord, 'on', rowPath, GAM_TRIGGER_EVENTS),
        ...(withinDays === undefined ? {} : { withinDays }),
        ...(scope === undefined ? {} : { scope }),
        ...(party === undefined ? {} : { party }),
      };
    }));
  const event = oneOf(record, 'event', path, GAM_EARN_EVENTS);
  const idempotencyKey = str(record, 'idempotencyKey', path);
  const token = event === 'message.timely_reply' ? 'messageId'
    : event === 'streak.week_completed' || event === 'quest.completed' ? 'weekStart'
      : event.startsWith('conversation.') || event === 'match.created' || event === 'message.first_in_match'
        ? 'matchId' : 'uid';
  if (idempotencyKey !== `{ruleId}:{${token}}:{uid}` ||
    clawback?.some(({ on }) => token !== (on === 'quest.part_clawed_back' ? 'weekStart'
      : on === 'profile.photo_removed' ? 'uid' : 'matchId'))) {
    throw new Error(`${path}.idempotencyKey is incompatible with the earn or clawback event`);
  }
  const celebration = optionalField(record, 'celebration', path, (value, celebrationPath) => {
    const celebrationRecord = asRecord(value, celebrationPath);
    checkKeys(celebrationRecord, celebrationPath, ['kind', 'copyKey']);
    return {
      kind: oneOf(celebrationRecord, 'kind', celebrationPath, GAM_CELEBRATION_KINDS),
      copyKey: str(celebrationRecord, 'copyKey', celebrationPath),
    };
  });
  const audience = optionalField(record, 'audience', path, (value, audiencePath) => {
    const audienceRecord = asRecord(value, audiencePath);
    checkKeys(audienceRecord, audiencePath, [], ['experiment', 'arm']);
    const experiment = optionalField(audienceRecord, 'experiment', audiencePath,
      (v, p) => freeText({ experiment: v }, 'experiment', p));
    const arm = optionalField(audienceRecord, 'arm', audiencePath,
      (v, p) => freeText({ arm: v }, 'arm', p));
    return {
      ...(experiment === undefined ? {} : { experiment }),
      ...(arm === undefined ? {} : { arm }),
    };
  });
  return {
    id: str(record, 'id', path),
    track: oneOf(record, 'track', path, ['cravos'] as const),
    event,
    award: {
      amount: int(awardRecord, 'amount', `${path}.award`, 1),
      to: oneOf(awardRecord, 'to', `${path}.award`, AWARD_TOS),
    },
    ...(conditions !== undefined ? { conditions } : {}),
    caps,
    ...(hold !== undefined ? { hold } : {}),
    ...(clawback !== undefined ? { clawback } : {}),
    idempotencyKey,
    ...(celebration !== undefined ? { celebration } : {}),
    ...(audience !== undefined ? { audience } : {}),
  };
}

function validateQuest(input: unknown, path: string): GamQuest {
  const record = asRecord(input, path);
  checkKeys(record, path, ['id', 'copyKey', 'parts']);
  const parts = eachOf(array(record.parts, `${path}.parts`), `${path}.parts`, (row, rowPath) => {
    const rowRecord = asRecord(row, rowPath);
    checkKeys(rowRecord, rowPath, ['event', 'target']);
    return {
      event: oneOf(rowRecord, 'event', rowPath, GAM_EARN_EVENTS),
      target: int(rowRecord, 'target', rowPath, 1),
    };
  });
  if (parts.length === 0) throw new Error(`${path}.parts must not be empty`);
  return { id: str(record, 'id', path), copyKey: str(record, 'copyKey', path), parts };
}

function validateAchievement(input: unknown, path: string): GamAchievementRule {
  const record = asRecord(input, path);
  checkKeys(record, path, ['id', 'kind', 'src', 'tiers'],
    ['windowDays', 'windowWeeks', 'windowNeedWeeks', 'replyRatePct', 'season']);
  const id = str(record, 'id', path);
  const spec = GAM_ACHIEVEMENTS.find((achievement) => achievement.id === id);
  if (!spec) {
    throw new Error(`${path}.id must be one of the achievement ids in the contract`);
  }
  const kind: GamAchievementKind = oneOf(record, 'kind', path, GAM_ACHIEVEMENT_KINDS);
  if (kind !== spec.kind) {
    throw new Error(`${path}.kind must be ${spec.kind} (the contract fixes it for ${id})`);
  }
  const tiers = eachOf(array(record.tiers, `${path}.tiers`), `${path}.tiers`, (value, tierPath) => {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
      throw new Error(`${tierPath} must be a positive integer`);
    }
    return value;
  });
  if (tiers.length !== spec.tiers.length || tiers.some((tier, index) => index > 0 && tier <= tiers[index - 1])) {
    throw new Error(`${path}.tiers must contain three increasing thresholds`);
  }
  const season = optionalField(record, 'season', path, (value, seasonPath) => {
    const seasonRecord = asRecord(value, seasonPath);
    checkKeys(seasonRecord, seasonPath, ['startsOn', 'endsOn']);
    const startsOn = isoDate(seasonRecord, 'startsOn', seasonPath);
    const endsOn = isoDate(seasonRecord, 'endsOn', seasonPath);
    if (startsOn > endsOn) throw new Error(`${seasonPath}.startsOn must not be after endsOn`);
    return { startsOn, endsOn };
  });
  if (kind === 'active' && record.windowDays === undefined
    && (record.windowWeeks === undefined || record.windowNeedWeeks === undefined)) {
    throw new Error(`${path}: an active achievement needs windowDays or windowWeeks + windowNeedWeeks`);
  }
  if ((kind === 'seasonal' || kind === 'campaign') && season === undefined) {
    throw new Error(`${path}: a ${kind} achievement needs season dates`);
  }
  return {
    id: spec.id,
    kind,
    src: str(record, 'src', path),
    tiers,
    ...(record.windowDays !== undefined ? { windowDays: optionalInt(record, 'windowDays', path) } : {}),
    ...(record.windowWeeks !== undefined ? { windowWeeks: optionalInt(record, 'windowWeeks', path) } : {}),
    ...(record.windowNeedWeeks !== undefined
      ? { windowNeedWeeks: optionalInt(record, 'windowNeedWeeks', path) }
      : {}),
    ...(record.replyRatePct !== undefined
      ? { replyRatePct: optionalInt(record, 'replyRatePct', path) }
      : {}),
    ...(season !== undefined ? { season } : {}),
  };
}

function validateStreakRules(input: unknown, path: string): GamStreakRules {
  const record = asRecord(input, path);
  checkKeys(record, path,
    ['timezone', 'weekStartsOn', 'qualifyingEvents', 'promptRefreshQualifiesEveryDays',
      'pauseEarnEveryWeeks', 'pauseBankByLevel', 'maxPauseWeeks', 'milestonesWeeks', 'reminder']);
  const qualifyingEvents = eachOf(array(record.qualifyingEvents, `${path}.qualifyingEvents`),
    `${path}.qualifyingEvents`, (value, eventPath) => {
      if (typeof value !== 'string' || value.length === 0) {
        throw new Error(`${eventPath} must be a non-empty string`);
      }
      return value;
    });
  if (qualifyingEvents.length === 0) {
    throw new Error(`${path}.qualifyingEvents must not be empty`);
  }
  const bankRecord = asRecord(record.pauseBankByLevel, `${path}.pauseBankByLevel`);
  checkKeys(bankRecord, `${path}.pauseBankByLevel`, GAM_LEVELS.map((level) => level.id));
  const bankPath = `${path}.pauseBankByLevel`;
  const pauseBankByLevel: Record<GamLevelId, number> = {
    botao: int(bankRecord, 'botao', bankPath, 1),
    flor: int(bankRecord, 'flor', bankPath, 1),
    ramalhete: int(bankRecord, 'ramalhete', bankPath, 1),
    jardim: int(bankRecord, 'jardim', bankPath, 1),
    primavera: int(bankRecord, 'primavera', bankPath, 1),
  };
  const milestonesWeeks = eachOf(array(record.milestonesWeeks, `${path}.milestonesWeeks`),
    `${path}.milestonesWeeks`, (value, milestonePath) => {
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
        throw new Error(`${milestonePath} must be an integer >= 1`);
      }
      return value;
    });
  if (milestonesWeeks.length === 0) throw new Error(`${path}.milestonesWeeks must not be empty`);
  for (let index = 1; index < milestonesWeeks.length; index++) {
    if (milestonesWeeks[index] <= milestonesWeeks[index - 1]) {
      throw new Error(`${path}.milestonesWeeks must be ascending and unique`);
    }
  }
  const reminderRecord = asRecord(record.reminder, `${path}.reminder`);
  checkKeys(reminderRecord, `${path}.reminder`, ['enabled', 'dayOfWeek', 'hour', 'timezone']);
  return {
    timezone: str(record, 'timezone', path),
    weekStartsOn: oneOf(record, 'weekStartsOn', path, ['monday'] as const),
    qualifyingEvents,
    promptRefreshQualifiesEveryDays: int(record, 'promptRefreshQualifiesEveryDays', path, 1),
    pauseEarnEveryWeeks: int(record, 'pauseEarnEveryWeeks', path, 1),
    pauseBankByLevel,
    maxPauseWeeks: int(record, 'maxPauseWeeks', path, 1),
    milestonesWeeks,
    reminder: {
      enabled: boolean(reminderRecord, 'enabled', `${path}.reminder`),
      dayOfWeek: oneOf(reminderRecord, 'dayOfWeek', `${path}.reminder`, ['sunday'] as const),
      hour: int(reminderRecord, 'hour', `${path}.reminder`, 0, 23),
      timezone: str(reminderRecord, 'timezone', `${path}.reminder`),
    },
  };
}

function validateCampaign(input: unknown, path: string): GamCampaign {
  const record = asRecord(input, path);
  checkKeys(record, path, ['id', 'startsOn', 'endsOn'], ['multiplier', 'appliesTo', 'audience']);
  const startsOn = isoDate(record, 'startsOn', path);
  const endsOn = isoDate(record, 'endsOn', path);
  if (startsOn > endsOn) throw new Error(`${path}.startsOn must not be after endsOn`);
  const multiplier = optionalInt(record, 'multiplier', path);
  if (multiplier !== undefined && multiplier < 2) {
    throw new Error(`${path}.multiplier must be >= 2 (a multiplier of 1 is not a campaign)`);
  }
  const appliesTo = optionalField(record, 'appliesTo', path, (value, appliesPath) => {
    const events = eachOf(array(value, appliesPath), appliesPath,
      (row, rowPath) => oneOf({ event: row }, 'event', rowPath, GAM_EARN_EVENTS));
    if (events.length === 0) throw new Error(`${appliesPath} must not be empty`);
    return events;
  });
  const audience = optionalField(record, 'audience', path, (value, audiencePath) => {
    const audienceRecord = asRecord(value, audiencePath);
    checkKeys(audienceRecord, audiencePath, [], ['experiment', 'arm']);
    const experiment = optionalField(audienceRecord, 'experiment', audiencePath,
      (v, p) => freeText({ experiment: v }, 'experiment', p));
    const arm = optionalField(audienceRecord, 'arm', audiencePath,
      (v, p) => freeText({ arm: v }, 'arm', p));
    return {
      ...(experiment === undefined ? {} : { experiment }),
      ...(arm === undefined ? {} : { arm }),
    };
  });
  return {
    id: str(record, 'id', path),
    startsOn,
    endsOn,
    ...(multiplier !== undefined ? { multiplier } : {}),
    ...(appliesTo !== undefined ? { appliesTo } : {}),
    ...(audience !== undefined ? { audience } : {}),
  };
}

function validateLevels(input: unknown, path: string): GamLevelRule[] {
  const values = array(input, path);
  if (values.length !== GAM_LEVELS.length) {
    throw new Error(`${path} must list exactly ${GAM_LEVELS.length} levels`);
  }
  let previousThreshold = -1;
  return values.map((value, index) => {
    const levelPath = `${path}[${index}]`;
    const record = asRecord(value, levelPath);
    checkKeys(record, levelPath, ['id', 'name', 'threshold']);
    const id = str(record, 'id', levelPath);
    const spec = GAM_LEVELS[index];
    const threshold = int(record, 'threshold', levelPath, 0, Number.MAX_SAFE_INTEGER);
    if (id !== spec.id || (index === 0 && threshold !== 0) || threshold <= previousThreshold) {
      throw new Error(`${levelPath} must be ${spec.id} in an increasing ladder starting at zero`);
    }
    previousThreshold = threshold;
    return { id: spec.id, name: str(record, 'name', levelPath), threshold };
  });
}

/** Parses and validates a rule-set JSON file. Throws on any drift from the contract. */
export function loadRuleSet(path: string): GamRuleSet {
  return validateRuleSet(JSON.parse(readFileSync(path, 'utf8')) as unknown);
}

/**
 * Validates a rule set against the shared contract: known fields only, every earn rule
 * capped, levels and achievements equal to the constant lists, milestone rules matching
 * the streak rules, and campaign references resolvable.
 */
export function validateRuleSet(input: unknown): GamRuleSet {
  const record = asRecord(input, 'ruleSet');
  checkKeys(record, 'ruleSet', RULE_SET_FIELDS);
  const earnRules = eachOf(array(record.earnRules, 'ruleSet.earnRules'), 'ruleSet.earnRules',
    (value, rulePath) => validateRule(value, rulePath));
  if (earnRules.length === 0) throw new Error('ruleSet.earnRules must not be empty');
  uniqueIds(earnRules, (rule) => rule.id, 'ruleSet.earnRules');
  const quests = eachOf(array(record.quests, 'ruleSet.quests'), 'ruleSet.quests',
    (value, questPath) => validateQuest(value, questPath));
  uniqueIds(quests, (quest) => quest.id, 'ruleSet.quests');
  const achievements = eachOf(array(record.achievements, 'ruleSet.achievements'),
    'ruleSet.achievements', (value, achievementPath) => validateAchievement(value, achievementPath));
  uniqueIds(achievements, (achievement) => achievement.id, 'ruleSet.achievements');
  const streakRules = validateStreakRules(record.streakRules, 'ruleSet.streakRules');
  const campaigns = eachOf(array(record.campaigns, 'ruleSet.campaigns'), 'ruleSet.campaigns',
    (value, campaignPath) => validateCampaign(value, campaignPath));
  uniqueIds(campaigns, (campaign) => campaign.id, 'ruleSet.campaigns');
  const levels = validateLevels(record.levels, 'ruleSet.levels');

  // Milestone rules and streak rules must agree on which weeks are milestones.
  const milestoneWeeks = new Set(streakRules.milestonesWeeks);
  const ruleWeeks = new Set<number>();
  for (const rule of earnRules) {
    if (rule.event !== 'streak.milestone') continue;
    const week = rule.conditions?.find(
      (condition) => condition.fact === 'streak.weeks' && condition.op === '==',
    );
    if (week === undefined) {
      throw new Error(
        `ruleSet.earnRules.${rule.id}: a streak.milestone rule needs a streak.weeks == N condition`,
      );
    }
    if (!milestoneWeeks.has(week.value)) {
      throw new Error(
        `ruleSet.earnRules.${rule.id}: milestone week ${week.value} is not in streakRules.milestonesWeeks`,
      );
    }
    ruleWeeks.add(week.value);
  }
  for (const week of milestoneWeeks) {
    if (!ruleWeeks.has(week)) {
      throw new Error(`ruleSet.streakRules.milestonesWeeks: no rule awards the ${week}-week milestone`);
    }
  }

  // Every campaign:... achievement source must point at a configured campaign.
  const campaignIds = new Set(campaigns.map((campaign) => campaign.id));
  for (const achievement of achievements) {
    if (!achievement.src.startsWith('campaign:')) continue;
    const campaignId = achievement.src.slice('campaign:'.length);
    if (!campaignIds.has(campaignId)) {
      throw new Error(
        `ruleSet.achievements.${achievement.id}: src points at unknown campaign ${campaignId}`,
      );
    }
  }

  const parentVersion = record.parentVersion;
  if (parentVersion !== null
    && (typeof parentVersion !== 'number' || !Number.isInteger(parentVersion) || parentVersion < 1)) {
    throw new Error('ruleSet.parentVersion must be null or an integer >= 1');
  }
  return {
    version: int(record, 'version', 'ruleSet', 1),
    status: oneOf(record, 'status', 'ruleSet', RULE_STATUSES),
    parentVersion,
    author: str(record, 'author', 'ruleSet'),
    notes: freeText(record, 'notes', 'ruleSet'),
    earnRules,
    quests,
    achievements,
    streakRules,
    campaigns,
    levels,
  };
}
