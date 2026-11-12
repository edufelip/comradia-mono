// Option ids are stored in Firestore; labels live in localization (`onboarding.*`).
// Keep these lists identical to apps/firebase/firestore.rules (a parity test checks it).

export const VIBES = ['outdoorsy', 'bookworm', 'creative', 'community', 'foodie'] as const;
export const LOOKING_FOR = ['women', 'men', 'everyone'] as const;
export const VALUE_IDS = [
  'climate_outdoors',
  'public_transit',
  'bookshops_coffee',
  'indie_film_music',
  'community_gardens',
  'tenant_rights',
  'food_markets',
  'cycling',
  'pets_parks',
  'volunteering',
] as const;
export const UNIONS = [
  'apeoesp',
  'bancarios_sp',
  'metalurgicos_abc',
  'seesp',
  'sintrajud',
  'app_workers',
] as const;
export const PROMPT_IDS = [
  'perfect_sunday',
  'hill_to_die_on',
  'together_we_could',
  'green_flag',
  'weirdly_good_at',
] as const;

export type Vibe = (typeof VIBES)[number];
export type LookingFor = (typeof LOOKING_FOR)[number];
export type ValueId = (typeof VALUE_IDS)[number];
export type UnionId = (typeof UNIONS)[number];
export type PromptId = (typeof PROMPT_IDS)[number];

export const MIN_AGE = 18;
export const MAX_AGE = 99;
export const NAME_MAX = 40;
export const VALUES_MIN = 3;
export const VALUES_MAX = 5;
export const ANSWER_MAX = 280;
export const DEFAULT_SHARED_PASSION_WEIGHT = 60;

/** Longest side, in pixels, of the JPEG the app uploads (the picker crops to 3:4 first). */
export const PHOTO_MAX_SIDE = 1080;
/** Same cap as apps/firebase/storage.rules. */
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

/**
 * Upload metadata for every photo. A path is never overwritten (each change is a new file), so
 * browsers and phones may keep it for a year; repeat views then cost no Storage download.
 */
export const PHOTO_METADATA = {
  contentType: 'image/jpeg',
  cacheControl: 'public, max-age=31536000, immutable',
} as const;

/** Storage path of a portrait. Mirrors storage.rules and the `photoPath` check in firestore.rules. */
export function photoPathFor(uid: string, photoId: string): string {
  return `photos/${uid}/${photoId}.jpg`;
}

/** True when `path` is a portrait `uid` may point their profile at. */
export function isPhotoPathFor(uid: string, path: string): boolean {
  const prefix = `photos/${uid}/`;
  return path.startsWith(prefix) && /^[A-Za-z0-9_-]{1,64}\.jpg$/.test(path.slice(prefix.length));
}

/** A new file id per upload: files are never overwritten, so a cached URL never goes stale. */
export function newPhotoId(now: number = Date.now(), random: () => number = Math.random): string {
  return `${now.toString(36)}${Math.floor(random() * 36 ** 6)
    .toString(36)
    .padStart(6, '0')}`;
}

/** Public card in `profiles/{uid}`, as read back (timestamps omitted). */
export type PublicProfile = {
  displayName: string;
  age: number;
  vibe: Vibe;
  lookingFor: LookingFor;
  unionMember: boolean;
  union: UnionId | null;
  values: ValueId[];
  promptId: PromptId;
  promptAnswer: string;
  /** Storage path of the portrait (`photos/{uid}/{id}.jpg`), or null when there is none. */
  photoPath: string | null;
};

export type DiscoveryProfile = PublicProfile & { id: string };

/** Everything onboarding collects before it writes once, at the end. */
export type OnboardingDraft = {
  displayName: string;
  /** As typed: DD/MM/YYYY. */
  birthDateInput: string;
  vibe: Vibe | null;
  lookingFor: LookingFor | null;
  unionMember: boolean;
  union: UnionId | null;
  values: ValueId[];
  sharedPassionWeight: number;
  promptId: PromptId;
  promptAnswer: string;
  /** Local JPEG picked in S2; uploaded when onboarding finishes. Null when skipped. */
  photoUri: string | null;
};

export const EMPTY_DRAFT: OnboardingDraft = {
  displayName: '',
  birthDateInput: '',
  vibe: null,
  lookingFor: null,
  unionMember: false,
  union: null,
  values: [],
  sharedPassionWeight: DEFAULT_SHARED_PASSION_WEIGHT,
  promptId: 'perfect_sunday',
  promptAnswer: '',
  photoUri: null,
};

/** Parses DD/MM/YYYY into ISO YYYY-MM-DD; null when it is not a real calendar date. */
export function parseBirthDate(input: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(input.trim());
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  const day = Number(dd);
  const month = Number(mm);
  const year = Number(yyyy);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${yyyy}-${mm}-${dd}`;
}

/** Whole years between an ISO birth date and `today`. */
export function ageOn(isoBirthDate: string, today: Date): number {
  const [year, month, day] = isoBirthDate.split('-').map(Number);
  let age = today.getUTCFullYear() - year;
  const beforeBirthday =
    today.getUTCMonth() + 1 < month ||
    (today.getUTCMonth() + 1 === month && today.getUTCDate() < day);
  if (beforeBirthday) age -= 1;
  return age;
}

export type BasicsError = 'name_required' | 'birth_date_invalid' | 'too_young' | 'too_old';

/** S2 top half: name and birthday. Returns the first problem, or null. */
export function validateBasics(draft: OnboardingDraft, today: Date): BasicsError | null {
  const name = draft.displayName.trim();
  if (name.length === 0 || name.length > NAME_MAX) return 'name_required';
  const iso = parseBirthDate(draft.birthDateInput);
  if (!iso) return 'birth_date_invalid';
  const age = ageOn(iso, today);
  if (age < MIN_AGE) return 'too_young';
  if (age > MAX_AGE) return 'too_old';
  return null;
}

export function canLeaveVibeStep(draft: OnboardingDraft, today: Date): boolean {
  return (
    validateBasics(draft, today) === null &&
    draft.vibe !== null &&
    draft.lookingFor !== null &&
    (!draft.unionMember || draft.union !== null)
  );
}

export function canLeaveValuesStep(draft: OnboardingDraft): boolean {
  return draft.values.length >= VALUES_MIN && draft.values.length <= VALUES_MAX;
}

export function canFinish(draft: OnboardingDraft): boolean {
  const answer = draft.promptAnswer.trim();
  return answer.length > 0 && answer.length <= ANSWER_MAX;
}

/** Adds or removes a value, never exceeding VALUES_MAX. */
export function toggleValue(values: ValueId[], id: ValueId): ValueId[] {
  if (values.includes(id)) return values.filter((v) => v !== id);
  if (values.length >= VALUES_MAX) return values;
  return [...values, id];
}

/** Builds the two Firestore documents from a finished draft. Throws if the draft is incomplete. */
export function buildDocuments(
  draft: OnboardingDraft,
  today: Date,
): { profile: PublicProfile; account: { birthDate: string; sharedPassionWeight: number } } {
  if (!canLeaveVibeStep(draft, today) || !canLeaveValuesStep(draft) || !canFinish(draft)) {
    throw new Error('Onboarding draft is incomplete');
  }
  const birthDate = parseBirthDate(draft.birthDateInput) as string;
  return {
    profile: {
      displayName: draft.displayName.trim(),
      age: ageOn(birthDate, today),
      vibe: draft.vibe as Vibe,
      lookingFor: draft.lookingFor as LookingFor,
      unionMember: draft.unionMember,
      union: draft.unionMember ? draft.union : null,
      values: draft.values,
      promptId: draft.promptId,
      promptAnswer: draft.promptAnswer.trim(),
      // Set by `saveOnboarding` once the picked photo is uploaded.
      photoPath: null,
    },
    account: {
      birthDate,
      sharedPassionWeight: Math.round(Math.min(100, Math.max(0, draft.sharedPassionWeight))),
    },
  };
}
