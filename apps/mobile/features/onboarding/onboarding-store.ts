import { create } from 'zustand';
import {
  ANSWER_MAX,
  EMPTY_DRAFT,
  toggleValue as toggleValueInList,
  type LookingFor,
  type OnboardingDraft,
  type PromptId,
  type UnionId,
  type ValueId,
  type Vibe,
} from '@/features/profile/profile-schema';

/** Shared-passion weight is stored 0–100 and edited in tens. */
export const SHARED_PASSION_STEP = 10;
export const SHARED_PASSION_MIN = 0;
export const SHARED_PASSION_MAX = 100;

/** Clamps the weight into the range the security rules accept. */
export function clampSharedPassionWeight(weight: number): number {
  return Math.min(SHARED_PASSION_MAX, Math.max(SHARED_PASSION_MIN, Math.round(weight)));
}

const DAYS = 2;
const MONTHS = 2;
const YEARS = 4;

/**
 * Turns whatever was typed into `DD/MM/YYYY`, adding the slashes as the digits
 * arrive (a masked field). Non-digits are dropped, so pasting `14-03-1994` works.
 */
export function formatBirthDateInput(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, DAYS + MONTHS + YEARS);
  const parts = [
    digits.slice(0, DAYS),
    digits.slice(DAYS, DAYS + MONTHS),
    digits.slice(DAYS + MONTHS),
  ];
  return parts.filter((part) => part.length > 0).join('/');
}

/** A fresh draft: `EMPTY_DRAFT` without sharing its `values` array between users. */
export function createEmptyDraft(): OnboardingDraft {
  return { ...EMPTY_DRAFT, values: [] };
}

type OnboardingState = OnboardingDraft & {
  setDisplayName: (displayName: string) => void;
  /** Stores the masked `DD/MM/YYYY` text, not a validated date. */
  setBirthDateInput: (input: string) => void;
  setVibe: (vibe: Vibe) => void;
  setLookingFor: (lookingFor: LookingFor) => void;
  /** Turning the badge off also forgets the chosen union. */
  setUnionMember: (unionMember: boolean) => void;
  setUnion: (union: UnionId) => void;
  toggleValue: (id: ValueId) => void;
  setSharedPassionWeight: (weight: number) => void;
  setPromptId: (promptId: PromptId) => void;
  setPromptAnswer: (answer: string) => void;
  reset: () => void;
};

/**
 * The in-memory onboarding draft (docs/architecture.md, decision 5). Nothing is
 * written until S4 finishes; `buildDocuments` turns the draft into the two
 * Firestore documents at the end.
 */
export const useOnboardingStore = create<OnboardingState>((set) => ({
  ...createEmptyDraft(),
  setDisplayName: (displayName) => set({ displayName }),
  setBirthDateInput: (input) => set({ birthDateInput: formatBirthDateInput(input) }),
  setVibe: (vibe) => set({ vibe }),
  setLookingFor: (lookingFor) => set({ lookingFor }),
  setUnionMember: (unionMember) =>
    set((state) => ({ unionMember, union: unionMember ? state.union : null })),
  setUnion: (union) => set({ union }),
  toggleValue: (id) => set((state) => ({ values: toggleValueInList(state.values, id) })),
  setSharedPassionWeight: (weight) =>
    set({ sharedPassionWeight: clampSharedPassionWeight(weight) }),
  setPromptId: (promptId) => set({ promptId }),
  setPromptAnswer: (answer) => set({ promptAnswer: answer.slice(0, ANSWER_MAX) }),
  reset: () => set(createEmptyDraft()),
}));
