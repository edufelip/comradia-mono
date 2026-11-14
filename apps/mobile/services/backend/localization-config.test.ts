import assert from 'node:assert/strict';
import { it } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ConfigContext } from 'expo/config';
import buildConfig from '../../app.config';
const locales = ['en-US', 'pt-BR', 'es-ES', 'fr-FR', 'de-DE', 'it-IT'];
it('advertises every app language on native platforms and localizes the photo permission', () => {
  const config = buildConfig({ config: { name: 'Comradia', slug: 'comradia' } } as ConfigContext);
  const plugin = config.plugins?.find((p) => Array.isArray(p) && p[0] === 'expo-localization');
  assert.ok(Array.isArray(plugin), 'expo-localization must advertise supported native languages');
  assert.deepEqual(plugin[1].supportedLocales, locales);
  for (const locale of locales) {
    const file = config.locales?.[locale];
    assert.equal(typeof file, 'string', locale);
    const data = JSON.parse(readFileSync(resolve(__dirname, '../..', file as string), 'utf8'));
    const text = data.ios?.NSPhotoLibraryUsageDescription;
    assert.ok(typeof text === 'string' && text.trim().length > 0, locale + ' photo permission');
    if (locale !== 'en-US')
      assert.notEqual(text, 'Comradia opens your photo library so you can pick a profile photo.');
    assert.equal(data.ios.NSCameraUsageDescription, undefined);
    assert.equal(data.ios.NSMicrophoneUsageDescription, undefined);
  }
});
