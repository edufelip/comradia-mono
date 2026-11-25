/** Remote configuration contract for the Cravos client. Defaults are deliberately safe. */
export type GamFlags = {
  gam_ui_enabled: boolean;
  gam_shadow: boolean;
  gam_kill_switch: boolean;
  gam_streak_reminders: boolean;
  gam_fullscreen_celebrations: boolean;
  gam_redemption: boolean;
  gam_experiment_pct: number;
};

export const GAM_FLAG_DEFAULTS: Readonly<GamFlags> = Object.freeze({
  gam_ui_enabled: false,
  gam_shadow: false,
  gam_kill_switch: false,
  gam_streak_reminders: false,
  gam_fullscreen_celebrations: false,
  gam_redemption: false,
  gam_experiment_pct: 0,
});

/** Keep the arm mapping in sync with armFor in the Functions engine. */
export function treatmentBucket(hash: string): number | null {
  return /^[a-f0-9]{8}/i.test(hash) ? Number.parseInt(hash.slice(0, 8), 16) % 100 : null;
}

export function isGamUiEnabled(flags: GamFlags, bucket: number | null): boolean {
  return (
    flags.gam_ui_enabled &&
    !flags.gam_kill_switch &&
    !flags.gam_shadow &&
    bucket !== null &&
    bucket < flags.gam_experiment_pct
  );
}

export function parseGamFlags(value: (key: keyof GamFlags) => string | undefined): GamFlags {
  const percent = Number(value('gam_experiment_pct') ?? 0);
  return {
    gam_ui_enabled: value('gam_ui_enabled') === 'true',
    gam_shadow: value('gam_shadow') === 'true',
    gam_kill_switch: value('gam_kill_switch') === 'true',
    gam_streak_reminders: value('gam_streak_reminders') === 'true',
    gam_fullscreen_celebrations: value('gam_fullscreen_celebrations') === 'true',
    gam_redemption: value('gam_redemption') === 'true',
    gam_experiment_pct: Number.isFinite(percent)
      ? Math.min(100, Math.max(0, Math.round(percent)))
      : 0,
  };
}
