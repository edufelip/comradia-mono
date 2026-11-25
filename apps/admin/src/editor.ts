export type Draft = Record<string, unknown>;

export const EDITABLE_SECTIONS = [
  ['earnRules', 'Earn rules'],
  ['quests', 'Quests'],
  ['achievements', 'Achievements'],
  ['streakRules', 'Streak rules'],
  ['campaigns', 'Campaigns'],
  ['levels', 'Levels'],
] as const;

export function isRecord(value: unknown): value is Draft {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function editedSection(draft: Draft, section: string, text: string): Draft {
  if (!EDITABLE_SECTIONS.some(([key]) => key === section)) throw new Error('Choose an editable section.');
  const value: unknown = JSON.parse(text);
  if (section === 'streakRules' ? !isRecord(value) : !Array.isArray(value) || !value.every(isRecord)) {
    throw new Error(section === 'streakRules' ? 'Enter a JSON object.' : 'Enter an array of JSON objects.');
  }
  return { ...draft, [section]: value };
}

export function earningPreview(draft: Draft) {
  const rules: unknown[] = Array.isArray(draft.earnRules) ? draft.earnRules : [];
  return rules.flatMap((rule) => {
    if (!isRecord(rule) || !isRecord(rule.award) || typeof rule.award.amount !== 'number' ||
      !Number.isInteger(rule.award.amount) || rule.award.amount <= 0 ||
      typeof rule.id !== 'string' || typeof rule.event !== 'string') return [];
    const cap = isRecord(rule.caps) && typeof rule.caps.perDay === 'number' ? rule.caps.perDay : null;
    return [{ id: rule.id, event: rule.event, amount: rule.award.amount, dailyMaximum: cap === null ? null : cap * rule.award.amount }];
  });
}
