import assert from 'node:assert/strict';
import { it } from 'node:test';
import type { ConfigContext } from 'expo/config';
import buildConfig from '../../app.config';

it('only embeds the App Check debug token in dev configuration', () => {
  const previousVariant = process.env.APP_VARIANT;
  const previousToken = process.env.EXPO_PUBLIC_APP_CHECK_DEBUG_TOKEN;
  try {
    process.env.EXPO_PUBLIC_APP_CHECK_DEBUG_TOKEN = 'fixture-debug-token';
    const context = { config: { name: 'Comradia', slug: 'comradia' } } as ConfigContext;
    process.env.APP_VARIANT = 'dev';
    assert.equal(buildConfig(context).extra?.appCheckDebugToken, 'fixture-debug-token');
    process.env.APP_VARIANT = 'prod';
    const production = buildConfig(context);
    assert.equal(production.extra?.appCheckDebugToken, undefined);
    assert.equal(JSON.stringify(production).includes('fixture-debug-token'), false);
  } finally {
    if (previousVariant === undefined) delete process.env.APP_VARIANT;
    else process.env.APP_VARIANT = previousVariant;
    if (previousToken === undefined) delete process.env.EXPO_PUBLIC_APP_CHECK_DEBUG_TOKEN;
    else process.env.EXPO_PUBLIC_APP_CHECK_DEBUG_TOKEN = previousToken;
  }
});
