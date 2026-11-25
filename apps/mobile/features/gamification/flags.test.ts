import { GAM_FLAG_DEFAULTS, isGamUiEnabled } from './flags';

describe('Cravos flags', () => {
  it('defaults to hidden UI and redemption', () => {
    expect(GAM_FLAG_DEFAULTS).toMatchObject({ gam_ui_enabled: false, gam_redemption: false, gam_shadow: true, gam_experiment_pct: 0 });
    expect(isGamUiEnabled(GAM_FLAG_DEFAULTS)).toBe(false);
  });

  it('honors the kill switch even when UI is enabled', () => {
    expect(isGamUiEnabled({ ...GAM_FLAG_DEFAULTS, gam_ui_enabled: true })).toBe(true);
    expect(isGamUiEnabled({ ...GAM_FLAG_DEFAULTS, gam_ui_enabled: true, gam_kill_switch: true })).toBe(false);
  });
});
