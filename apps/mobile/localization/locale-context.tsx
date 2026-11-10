import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { resolveLocale, type SupportedLocale } from '@/localization/core';
import { getDeviceLocale } from '@/localization/get-device-locale';

type LocaleContextValue = {
  activeLocale: SupportedLocale;
  setActiveLocale: (locale: SupportedLocale) => Promise<void>;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

const FALLBACK_LOCALE_VALUE: LocaleContextValue = {
  activeLocale: resolveLocale(getDeviceLocale()),
  setActiveLocale: async () => {},
};

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [activeLocale, setActiveLocaleState] = useState<SupportedLocale>(
    resolveLocale(getDeviceLocale()),
  );

  const setActiveLocale = useCallback(async (locale: SupportedLocale) => {
    setActiveLocaleState(locale);
  }, []);

  const value = useMemo(
    () => ({ activeLocale, setActiveLocale }),
    [activeLocale, setActiveLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  return ctx ?? FALLBACK_LOCALE_VALUE;
}
