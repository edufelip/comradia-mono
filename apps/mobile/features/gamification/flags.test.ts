import assert from 'node:assert/strict';
import { it } from 'node:test';
import { GAM_FLAG_DEFAULTS, isGamUiEnabled, treatmentBucket } from './flags';

it('keeps Cravos off in the control group and shadow phase', () => {
  assert.equal(isGamUiEnabled(GAM_FLAG_DEFAULTS, 0), false);
  const enabled = { ...GAM_FLAG_DEFAULTS, gam_ui_enabled: true, gam_experiment_pct: 20 };
  assert.equal(isGamUiEnabled(enabled, 19), true);
  assert.equal(isGamUiEnabled(enabled, 20), false);
  assert.equal(isGamUiEnabled({ ...enabled, gam_shadow: true }, 0), false);
  assert.equal(isGamUiEnabled({ ...enabled, gam_kill_switch: true }, 0), false);
});

it('uses the first four big-endian hash bytes for a stable experiment bucket', () => {
  assert.equal(treatmentBucket('0123456789abcdef'), 43);
  assert.equal(treatmentBucket(''), null);
});
