import {
  ANSWER_MAX,
  LOOKING_FOR,
  NAME_MAX,
  PROMPT_IDS,
  UNIONS,
  VALUE_IDS,
  VALUES_MAX,
  VALUES_MIN,
  VIBES,
  type PublicProfile,
} from './profile-schema';

export type ProfileEdits = Pick<
  PublicProfile,
  | 'displayName'
  | 'vibe'
  | 'lookingFor'
  | 'unionMember'
  | 'union'
  | 'values'
  | 'promptId'
  | 'promptAnswer'
>;

export function validProfileEdits(value: ProfileEdits): boolean {
  const name = value.displayName.trim();
  const answer = value.promptAnswer.trim();
  return (
    name.length >= 1 &&
    name.length <= NAME_MAX &&
    (VIBES as readonly string[]).includes(value.vibe) &&
    (LOOKING_FOR as readonly string[]).includes(value.lookingFor) &&
    typeof value.unionMember === 'boolean' &&
    (value.unionMember
      ? value.union !== null && (UNIONS as readonly string[]).includes(value.union)
      : value.union === null) &&
    Array.isArray(value.values) &&
    value.values.length >= VALUES_MIN &&
    value.values.length <= VALUES_MAX &&
    new Set(value.values).size === value.values.length &&
    value.values.every((v) => (VALUE_IDS as readonly string[]).includes(v)) &&
    (PROMPT_IDS as readonly string[]).includes(value.promptId) &&
    answer.length >= 1 &&
    answer.length <= ANSWER_MAX
  );
}

/** Deliberately enumerate public editable fields; never forward caller extras to Firestore. */
export function buildProfileEdits(value: ProfileEdits): ProfileEdits {
  if (!validProfileEdits(value)) throw new Error('Invalid profile edits');
  return {
    displayName: value.displayName.trim(),
    vibe: value.vibe,
    lookingFor: value.lookingFor,
    unionMember: value.unionMember,
    union: value.union,
    values: [...value.values],
    promptId: value.promptId,
    promptAnswer: value.promptAnswer.trim(),
  };
}
