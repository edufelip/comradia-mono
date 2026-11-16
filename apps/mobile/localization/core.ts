import { deDE } from './de-DE';
import { enUS, type TranslationKey } from './en-US';
import { esES } from './es-ES';
import { frFR } from './fr-FR';
import { getDeviceLocale } from './get-device-locale';
import { itIT } from './it-IT';
import { ptBR } from './pt-BR';

export type SupportedLocale = 'en-US' | 'pt-BR' | 'es-ES' | 'fr-FR' | 'de-DE' | 'it-IT';
export type { TranslationKey };

export const DICTIONARIES: Record<SupportedLocale, Record<TranslationKey, string>> = {
  'en-US': enUS,
  'pt-BR': ptBR,
  'es-ES': esES,
  'fr-FR': frFR,
  'de-DE': deDE,
  'it-IT': itIT,
};

export function resolveLocale(rawLocale?: string | null): SupportedLocale {
  const language = (rawLocale ?? '').trim().replaceAll('_', '-').toLowerCase().split('-')[0];
  const locales: Record<string, SupportedLocale> = {
    en: 'en-US',
    pt: 'pt-BR',
    es: 'es-ES',
    fr: 'fr-FR',
    de: 'de-DE',
    it: 'it-IT',
  };
  if (Object.prototype.hasOwnProperty.call(locales, language)) return locales[language];
  return 'en-US';
}

export { getDeviceLocale };

export function t(
  locale: SupportedLocale,
  key: TranslationKey,
  params?: Record<string, string | number>,
): string {
  const dict = DICTIONARIES[locale] ?? DICTIONARIES['en-US'];
  const template = dict[key] ?? DICTIONARIES['en-US'][key] ?? key;

  if (!params) {
    return template;
  }

  return Object.entries(params).reduce((acc, [paramKey, value]) => {
    return acc.replaceAll(`{${paramKey}}`, String(value));
  }, template);
}

export type TranslationBinding = {
  locale: SupportedLocale;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
};

export function buildTranslationBinding(
  locale: SupportedLocale,
  previous?: TranslationBinding | null,
): TranslationBinding {
  if (previous && previous.locale === locale) {
    return previous;
  }

  return {
    locale,
    t: (key: TranslationKey, params?: Record<string, string | number>) => t(locale, key, params),
  };
}
