import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveLocale } from './core';
import { getDeviceLocale } from './get-device-locale';

type DateTimeFormatShape = { resolvedOptions: () => { locale?: unknown } };

const mutableIntl = Intl as unknown as { DateTimeFormat: unknown };

/** Swaps `Intl.DateTimeFormat` for the duration of a synchronous assertion. */
function withDateTimeFormat(stub: unknown, run: () => void) {
  const original = mutableIntl.DateTimeFormat;
  mutableIntl.DateTimeFormat = stub;
  try {
    run();
  } finally {
    mutableIntl.DateTimeFormat = original;
  }
}

describe('localization device locale detection', () => {
  it('returns a non-empty tag that resolves to a supported locale', () => {
    const locale = getDeviceLocale();

    assert.equal(typeof locale, 'string');
    assert.ok(locale.trim().length > 0, `device locale was blank: ${JSON.stringify(locale)}`);
    assert.ok(
      ['en-US', 'pt-BR', 'es-ES', 'fr-FR', 'de-DE', 'it-IT'].includes(resolveLocale(locale)),
      `device locale ${locale} did not resolve to a supported locale`,
    );
  });

  it('passes through the tag reported by Intl', () => {
    withDateTimeFormat(
      (): DateTimeFormatShape => ({ resolvedOptions: () => ({ locale: 'pt-BR' }) }),
      () => assert.equal(getDeviceLocale(), 'pt-BR'),
    );
    withDateTimeFormat(
      (): DateTimeFormatShape => ({ resolvedOptions: () => ({ locale: 'es-419' }) }),
      () => assert.equal(getDeviceLocale(), 'es-419'),
    );
  });

  it('falls back to en-US when Intl throws', () => {
    withDateTimeFormat(
      () => {
        throw new Error('Intl unavailable');
      },
      () => assert.equal(getDeviceLocale(), 'en-US'),
    );
  });

  it('falls back to en-US when the locale is blank or not a string', () => {
    withDateTimeFormat(
      (): DateTimeFormatShape => ({ resolvedOptions: () => ({ locale: '' }) }),
      () => assert.equal(getDeviceLocale(), 'en-US'),
    );
    withDateTimeFormat(
      (): DateTimeFormatShape => ({ resolvedOptions: () => ({ locale: undefined }) }),
      () => assert.equal(getDeviceLocale(), 'en-US'),
    );
  });

  it('resolves the device locale end to end', () => {
    // The same path LocaleProvider uses at startup: device tag -> supported locale.
    withDateTimeFormat(
      (): DateTimeFormatShape => ({ resolvedOptions: () => ({ locale: 'es-AR' }) }),
      () => assert.equal(resolveLocale(getDeviceLocale()), 'es-ES'),
    );
  });
});
