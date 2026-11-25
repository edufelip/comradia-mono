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
  gam_shadow: true,
  gam_kill_switch: false,
  gam_streak_reminders: true,
  gam_fullscreen_celebrations: true,
  gam_redemption: false,
  gam_experiment_pct: 0,
});

/** UI is hidden unless explicitly enabled and never shown during an emergency stop. */
export function isGamUiEnabled(flags: GamFlags): boolean {
  return flags.gam_ui_enabled && !flags.gam_kill_switch;
}
