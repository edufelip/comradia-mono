// Feature flags for the Cravos engine. Owner decision (25 Nov 2026): flags live in
// Firebase Remote Config; Firestore gamConfig/active is only the active rule-set
// pointer. The engine never calls Remote Config directly: it depends on the
// GamFlagsProvider interface, so tests inject a static provider (the test seam).

import { createHash } from 'node:crypto';

export const GAM_FLAG_KEYS = [
  'gam_kill_switch',
  'gam_shadow',
  'gam_ui_enabled',
  'gam_experiment_pct',
  'gam_streak_reminders',
  'gam_fullscreen_celebrations',
] as const;

export type GamFlags = {
  /** Stops all issuance everywhere (spec §11 kill switch). */
  killSwitch: boolean;
  /** Phase 1: the engine mirrors everything to gamShadow/{uid} and shows nothing. */
  shadow: boolean;
  /** Whether any member-facing surface exists yet. */
  uiEnabled: boolean;
  /** Share of members in the treatment arm (0–100). */
  experimentPct: number;
  /** Sunday 18:00 streak reminder pushes. */
  streakReminders: boolean;
  /** Whether achievement and level-up moments may be full screen (else toast). */
  fullscreenCelebrations: boolean;
};

/** Conservative fallback when Remote Config cannot be read: invisible program. */
export const SAFE_FLAGS: GamFlags = {
  killSwitch: false,
  shadow: false,
  uiEnabled: false,
  experimentPct: 0,
  streakReminders: false,
  fullscreenCelebrations: false,
};

export interface GamFlagsProvider {
  getFlags(): Promise<GamFlags>;
}

/** Pure mapping from raw string flag values, so the parsing is testable. */
export function flagsFromValues(values: {
  getBoolean(key: string): boolean;
  getNumber(key: string): number;
}): GamFlags {
  const pctRaw = values.getNumber('gam_experiment_pct');
  const pct = Number.isFinite(pctRaw) ? Math.min(100, Math.max(0, Math.round(pctRaw))) : 0;
  return {
    killSwitch: values.getBoolean('gam_kill_switch'),
    shadow: values.getBoolean('gam_shadow'),
    uiEnabled: values.getBoolean('gam_ui_enabled'),
    experimentPct: pct,
    streakReminders: values.getBoolean('gam_streak_reminders'),
    fullscreenCelebrations: values.getBoolean('gam_fullscreen_celebrations'),
  };
}

const CACHE_MS = 60_000;

/**
 * Reads flags from the Remote Config server template (firebase-admin), cached one
 * minute per instance. A failed load falls back to SAFE_FLAGS (logged by the
 * caller-visible behavior: the program stays invisible), because an unreachable
 * flag store must never make a hidden program visible.
 */
export class RemoteConfigFlagsProvider implements GamFlagsProvider {
  private cache: { at: number; flags: GamFlags } | null = null;

  constructor(
    private readonly loadValues: () => Promise<{
      getBoolean(key: string): boolean;
      getNumber(key: string): number;
    }>,
    private readonly now: () => number = Date.now,
  ) {}

  async getFlags(): Promise<GamFlags> {
    if (this.cache && this.now() - this.cache.at < CACHE_MS) return this.cache.flags;
    try {
      const values = await this.loadValues();
      const flags = flagsFromValues(values);
      this.cache = { at: this.now(), flags };
      return flags;
    } catch {
      // Handled explicitly: a Remote Config outage must not surface the program.
      this.cache = { at: this.now(), flags: SAFE_FLAGS };
      return SAFE_FLAGS;
    }
  }
}

/** Static provider for tests and tools. */
export class StaticFlagsProvider implements GamFlagsProvider {
  constructor(private readonly flags: GamFlags) {}
  async getFlags(): Promise<GamFlags> {
    return this.flags;
  }
}

/**
 * The member's experiment arm, stable across invocations: a hash of the uid with
 * the experiment salt, below the percentage => treatment (spec §13 gam_experiment_pct).
 */
export function armFor(uid: string, experimentPct: number): 'treatment' | 'control' {
  if (experimentPct >= 100) return 'treatment';
  if (experimentPct <= 0) return 'control';
  const digest = createHash('sha256').update(`gam_v1:${uid}`).digest();
  const bucket = digest.readUInt32BE(0) % 100;
  return bucket < experimentPct ? 'treatment' : 'control';
}

/**
 * Where this member's engine output is written. Phase 1 (gam_shadow): everyone to
 * gamShadow. Phase 2+ (ui on): the control arm keeps "earning" into gamShadow for
 * comparison while the treatment arm gets the real projection (spec §13).
 */
export function engineEnabled(flags: GamFlags): boolean {
  return !flags.killSwitch && (flags.shadow || flags.uiEnabled);
}

export function shadowTarget(flags: GamFlags, uid: string): boolean {
  return flags.shadow || (flags.uiEnabled && armFor(uid, flags.experimentPct) === 'control');
}
