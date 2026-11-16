import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DICTIONARIES,
  buildTranslationBinding,
  resolveLocale,
  t,
  type SupportedLocale,
  type TranslationKey,
} from './core';
import { enUS } from './en-US';
import { esES } from './es-ES';
import { ptBR } from './pt-BR';

/**
 * Values that are legitimately identical across locales: proper nouns and
 * coordinates, not prose that was left untranslated.
 */
const IDENTICAL_BY_DESIGN = new Set<TranslationKey>([
  'discover.title',
  'welcome.location_city',
  'welcome.location_coords',
  'welcome.map_places',
  // Brazilian phone format and union names (proper nouns).
  'auth.phone_placeholder',
  'onboarding.union.bancarios_sp',
  'onboarding.union.metalurgicos_abc',
  'onboarding.union.sintrajud',
  // Pure number templates.
  'onboarding.values.count',
  'onboarding.values.weight_value',
  'onboarding.starter.answer_count',
  'profile.age',
  'match.names', // Names joined by an ampersand are valid in several locales.
]);

const LOCALES: { locale: SupportedLocale; dictionary: Record<TranslationKey, string> }[] = [
  { locale: 'en-US', dictionary: enUS },
  { locale: 'pt-BR', dictionary: ptBR },
  { locale: 'es-ES', dictionary: esES },
];

const EN_KEYS = (Object.keys(enUS) as TranslationKey[]).sort();

describe('Comradia localization', () => {
  it('resolves supported locales and translates keys', () => {
    assert.equal(resolveLocale('pt-BR'), 'pt-BR');
    assert.equal(resolveLocale('es-AR'), 'es-ES');
    assert.equal(resolveLocale('en-GB'), 'en-US');
    assert.equal(t('en-US', 'discover.title'), 'Comradia');
    assert.equal(t('pt-BR', 'tabs.discover'), 'Descobrir');
  });
});

describe('localization dictionary parity', () => {
  it('has exactly the same keys in pt-BR and es-ES as in en-US', () => {
    for (const { locale, dictionary } of LOCALES) {
      assert.deepEqual((Object.keys(dictionary) as TranslationKey[]).sort(), EN_KEYS, locale);
    }
    assert.deepEqual((Object.keys(DICTIONARIES['pt-BR']) as TranslationKey[]).sort(), EN_KEYS);
    assert.deepEqual((Object.keys(DICTIONARIES['es-ES']) as TranslationKey[]).sort(), EN_KEYS);
  });

  it('has no empty or whitespace-only values in any locale', () => {
    for (const { locale, dictionary } of LOCALES) {
      for (const key of EN_KEYS) {
        const value = dictionary[key];
        assert.equal(typeof value, 'string', `${locale} ${key} must be a string`);
        assert.ok(value.trim().length > 0, `${locale} ${key} is empty`);
      }
    }
  });

  it('does not ship untranslated copies of English prose in pt-BR or es-ES', () => {
    const untranslated: string[] = [];

    for (const { locale, dictionary } of LOCALES) {
      if (locale === 'en-US') continue;
      for (const key of EN_KEYS) {
        // Single borrowed words ("Matches", "Comradia") are not prose; only
        // multi-word English strings indicate a missed translation.
        if (!/\s/.test(enUS[key])) continue;
        if (IDENTICAL_BY_DESIGN.has(key)) continue;
        if (dictionary[key] === enUS[key]) untranslated.push(`${locale} ${key}`);
      }
    }

    assert.deepEqual(untranslated, []);
  });

  it('only exempts keys that really exist in every dictionary', () => {
    for (const key of IDENTICAL_BY_DESIGN) {
      for (const { locale, dictionary } of LOCALES) {
        assert.ok(key in dictionary, `${locale} is missing exempted key ${key}`);
      }
    }
  });
});

describe('localization fallback and interpolation', () => {
  it('falls back to en-US for an unknown locale', () => {
    const unknown = 'ja-JP' as SupportedLocale;

    assert.equal(t(unknown, 'tabs.profile'), 'Profile');
    assert.equal(t(unknown, 'matches.title'), enUS['matches.title']);
  });

  it('returns the key itself when the key is missing from every dictionary', () => {
    const missing = 'does.not.exist' as TranslationKey;

    assert.equal(t('en-US', missing), 'does.not.exist');
    assert.equal(t('pt-BR', missing), 'does.not.exist');
    assert.equal(t('es-ES' as SupportedLocale, missing), 'does.not.exist');
  });

  it('replaces every placeholder occurrence and stringifies numbers', () => {
    const template = '{greeting}, {name}! {name} ({count}) {missing}' as TranslationKey;

    assert.equal(
      t('en-US', template, { greeting: 'Hi', name: 'Ada', count: 3 }),
      'Hi, Ada! Ada (3) {missing}',
    );
  });

  it('leaves a template untouched when no params are given', () => {
    assert.equal(t('pt-BR', 'welcome.cta_start'), 'Encontre sua pessoa');
    assert.equal(t('pt-BR', 'welcome.cta_start', {}), 'Encontre sua pessoa');
  });
});

describe('localization locale resolution', () => {
  it('falls back to en-US for missing or blank device locales', () => {
    for (const raw of [undefined, null, '', '   ']) {
      assert.equal(resolveLocale(raw), 'en-US', `raw=${String(raw)}`);
    }
  });

  it('accepts exact tags case-insensitively and with surrounding whitespace', () => {
    assert.equal(resolveLocale(' en-US '), 'en-US');
    assert.equal(resolveLocale('pt-BR'), 'pt-BR');
    assert.equal(resolveLocale('PT-br'), 'pt-BR');
    assert.equal(resolveLocale('es-ES'), 'es-ES');
    assert.equal(resolveLocale('ES-es'), 'es-ES');
  });

  it('maps regional variants onto the closest supported locale', () => {
    assert.equal(resolveLocale('pt'), 'pt-BR');
    assert.equal(resolveLocale('pt-PT'), 'pt-BR');
    assert.equal(resolveLocale('pt-BR-x-sao-paulo'), 'pt-BR');
    assert.equal(resolveLocale('es'), 'es-ES');
    assert.equal(resolveLocale('es-AR'), 'es-ES');
    assert.equal(resolveLocale('es-MX'), 'es-ES');
    assert.equal(resolveLocale('en-GB'), 'en-US');
    assert.equal(resolveLocale('en'), 'en-US');
  });

  it('falls back to en-US for unsupported languages', () => {
    for (const raw of ['ja-JP', 'zh-Hans-CN', 'ru', 'italics', 'french']) {
      assert.equal(resolveLocale(raw), 'en-US', `raw=${raw}`);
    }
  });

  it('keeps a stable translation binding per locale', () => {
    const portuguese = buildTranslationBinding('pt-BR');

    assert.equal(buildTranslationBinding('pt-BR', portuguese), portuguese);
    assert.equal(portuguese.t('tabs.profile'), 'Perfil');

    const spanish = buildTranslationBinding('es-ES', portuguese);
    assert.notEqual(spanish, portuguese);
    assert.equal(spanish.locale, 'es-ES');
    assert.equal(spanish.t('tabs.discover'), 'Descubrir');
    assert.equal(buildTranslationBinding('pt-BR', null).t('tabs.matches'), 'Matches');
  });

  it('does not treat Object.prototype members as locales', () => {
    assert.equal(resolveLocale('constructor'), 'en-US');
    assert.equal(resolveLocale('toString'), 'en-US');
  });
});

describe('required product languages', () => {
  it('registers all five required languages plus English', () => {
    assert.deepEqual(Object.keys(DICTIONARIES).sort(), [
      'de-DE',
      'en-US',
      'es-ES',
      'fr-FR',
      'it-IT',
      'pt-BR',
    ]);
  });
  it('resolves regional and platform tags without accepting prefix lookalikes', () => {
    for (const [raw, expected] of [
      ['fr-CA', 'fr-FR'],
      ['FR_fr', 'fr-FR'],
      ['de-AT', 'de-DE'],
      ['it-CH', 'it-IT'],
      ['pt_PT', 'pt-BR'],
      ['es-419', 'es-ES'],
      ['french', 'en-US'],
      ['italics', 'en-US'],
    ]) {
      assert.equal(resolveLocale(raw), expected, raw);
    }
  });
  it('requires exact key parity, nonempty translations and unchanged placeholders in every registered locale', () => {
    const placeholders = (s: string) =>
      [...s.matchAll(/\{([A-Za-z_]+)\}/g)].map((m) => m[1]).sort();
    for (const [locale, dictionary] of Object.entries(DICTIONARIES)) {
      assert.deepEqual(Object.keys(dictionary).sort(), EN_KEYS, locale);
      for (const key of EN_KEYS) {
        assert.ok(dictionary[key].trim(), locale + ' ' + key);
        assert.deepEqual(
          placeholders(dictionary[key]),
          placeholders(enUS[key]),
          locale + ' ' + key,
        );
        if (locale !== 'en-US' && /\s/.test(enUS[key]) && !IDENTICAL_BY_DESIGN.has(key))
          assert.notEqual(dictionary[key], enUS[key], locale + ' ' + key + ' untranslated');
      }
    }
  });
});

it('does not copy Spanish prose into the Italian dictionary', () => {
  const italian = DICTIONARIES['it-IT'];
  for (const key of EN_KEYS) {
    if (/\s/.test(esES[key]) && !IDENTICAL_BY_DESIGN.has(key))
      assert.notEqual(italian[key], esES[key], key + ' contains copied Spanish');
  }
});
