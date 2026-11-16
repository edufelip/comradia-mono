import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { it } from 'node:test';
import type { ConfigContext, ExpoConfig } from 'expo/config';
import buildConfig from '../../app.config';
import { getDsTheme } from '../../constants/design-system';

const appJson = JSON.parse(readFileSync(resolve(__dirname, '../../app.json'), 'utf8')) as {
  expo: ExpoConfig;
};
const light = getDsTheme('light').color;
const dark = getDsTheme('dark').color;

it('takes splash, adaptive icon and notification colors from the design-system tokens', () => {
  const config = buildConfig({ config: appJson.expo } as ConfigContext);

  const splash = config.plugins?.find((p) => Array.isArray(p) && p[0] === 'expo-splash-screen');
  assert.ok(Array.isArray(splash));
  const splashOptions = splash[1] as { backgroundColor: string; dark: { backgroundColor: string } };
  assert.equal(splashOptions.backgroundColor, light.canvas);
  assert.equal(splashOptions.dark.backgroundColor, dark.canvas);

  assert.equal(config.android?.adaptiveIcon?.backgroundColor, light.accentPrimarySoft);

  const notifications = config.plugins?.find(
    (p) => Array.isArray(p) && p[0] === 'expo-notifications',
  );
  assert.ok(Array.isArray(notifications));
  assert.equal((notifications[1] as { color: string }).color, light.accentPrimary);
});

it('keeps literal colors out of app.json', () => {
  assert.doesNotMatch(JSON.stringify(appJson), /#[0-9a-fA-F]{3,8}\b/);
});
