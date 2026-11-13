import {
  MAX_AGE,
  MIN_AGE,
  type DiscoveryProfile,
  type Vibe,
} from '@/features/profile/profile-schema';

export type DiscoveryFilters = { minAge: number; maxAge: number; vibe: Vibe | null };
export const DEFAULT_DISCOVERY_FILTERS: DiscoveryFilters = {
  minAge: MIN_AGE,
  maxAge: MAX_AGE,
  vibe: null,
};

export function matchesDiscoveryFilters(
  person: DiscoveryProfile,
  filters: DiscoveryFilters,
): boolean {
  return (
    person.age >= filters.minAge &&
    person.age <= filters.maxAge &&
    (filters.vibe === null || person.vibe === filters.vibe)
  );
}
