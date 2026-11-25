// Loads the active Cravos rule set: gamConfig/active -> gamRuleSets/{id}, cached
// one minute per instance. When the pointer is missing (before the first admin
// publish, e.g. the whole shadow phase), the bundled seed rule set v1 is used so
// the engine runs from day one without console writes. Stored rule sets are
// re-validated on load so a hand-edited draft fails loudly instead of paying out.

import type { Firestore } from 'firebase-admin/firestore';
import { join } from 'node:path';
import { loadRuleSet, validateRuleSet } from '../ruleset';
import type { GamRuleSet } from '../model';

export interface RuleSetLoader {
  loadActive(): Promise<GamRuleSet>;
  loadPublished?(): Promise<GamRuleSet[]>;
}

export const SEED_RULE_SET_ID = 'seed-v1';

// Works both from src (tsx) and lib (tsc output): lib/gamification/engine and
// src/gamification/engine are both three levels below the package root.
const SEED_PATH = join(__dirname, '..', '..', '..', 'src', 'gamification', 'seed', 'ruleset-v1.json');

/** The bundled rule set, loaded once per process. */
export function seedRuleSet(): GamRuleSet {
  return loadRuleSet(SEED_PATH);
}

const CACHE_MS = 60_000;

export class FirestoreRuleSetLoader implements RuleSetLoader {
  private cache: { at: number; ruleSet: GamRuleSet } | null = null;
  private history: { at: number; ruleSets: GamRuleSet[] } | null = null;

  constructor(
    private readonly firestore: Firestore,
    private readonly now: () => number = Date.now,
  ) {}

  async loadActive(): Promise<GamRuleSet> {
    if (this.cache && this.now() - this.cache.at < CACHE_MS) return this.cache.ruleSet;
    const pointer = await this.firestore.doc('gamConfig/active').get();
    const ruleSetId = pointer.get('ruleSetId');
    let ruleSet: GamRuleSet;
    if (typeof ruleSetId === 'string' && ruleSetId.length > 0) {
      const stored = await this.firestore.doc(`gamRuleSets/${ruleSetId}`).get();
      if (!stored.exists) throw new Error(`gamConfig/active points at missing gamRuleSets/${ruleSetId}`);
      ruleSet = validateRuleSet(stored.data());
    } else {
      ruleSet = seedRuleSet();
    }
    this.cache = { at: this.now(), ruleSet };
    return ruleSet;
  }

  async loadPublished(): Promise<GamRuleSet[]> {
    if (this.history && this.now() - this.history.at < CACHE_MS) return this.history.ruleSets;
    const snapshots = await this.firestore.collection('gamRuleSets')
      .where('status', 'in', ['published', 'archived']).get();
    const ruleSets = [seedRuleSet(), ...snapshots.docs.map((doc) => validateRuleSet(doc.data()))];
    this.history = { at: this.now(), ruleSets };
    return ruleSets;
  }
}

/** Static loader for tests: exact rule set, no cache, no Firestore. */
export class StaticRuleSetLoader implements RuleSetLoader {
  constructor(private readonly ruleSet: GamRuleSet) {}
  async loadActive(): Promise<GamRuleSet> {
    return this.ruleSet;
  }
}
