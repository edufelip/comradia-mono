import assert from 'node:assert/strict';
import { it } from 'node:test';
import { DEFAULT_DISCOVERY_FILTERS, matchesDiscoveryFilters } from './discovery-filters';
import type { DiscoveryProfile } from '@/features/profile/profile-schema';

const person = (age: number, vibe: DiscoveryProfile['vibe']) => ({ age, vibe }) as DiscoveryProfile;
void it('keeps the default eligible page and includes both age boundaries', () => {
  assert.equal(matchesDiscoveryFilters(person(18, 'bookworm'), DEFAULT_DISCOVERY_FILTERS), true);
  assert.equal(matchesDiscoveryFilters(person(99, 'creative'), DEFAULT_DISCOVERY_FILTERS), true);
  assert.equal(
    matchesDiscoveryFilters(person(30, 'creative'), { minAge: 25, maxAge: 30, vibe: null }),
    true,
  );
});
void it('filters by both age and explicitly selected vibe', () => {
  const filters = { minAge: 25, maxAge: 30, vibe: 'bookworm' as const };
  assert.equal(matchesDiscoveryFilters(person(27, 'bookworm'), filters), true);
  assert.equal(matchesDiscoveryFilters(person(24, 'bookworm'), filters), false);
  assert.equal(matchesDiscoveryFilters(person(31, 'bookworm'), filters), false);
  assert.equal(matchesDiscoveryFilters(person(27, 'creative'), filters), false);
});
