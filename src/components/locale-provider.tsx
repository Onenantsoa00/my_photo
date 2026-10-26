"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";

import { translate, type Locale, type TranslationKey } from "@/lib/i18n";

const LocaleContext = createContext<Locale>("fr");

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

export type TranslateFn = (
  key: TranslationKey,
  replacements?: Record<string, string | number>,
) => string;

/**
 * `t("key")` dans les composants clients. Le dictionnaire est déjà chargé côté
 * serveur : on n'embarque pas les deux langues dans le bundle par utilisateur.
 */
export function useT(): TranslateFn {
  const locale = useLocale();

  return useCallback<TranslateFn>(
    (key, replacements) => translate(locale, key, replacements),
    [locale],
  );
}

/** Traductions pré-résolues, pratiques pour passer un libellé à un composant. */
export function useTranslations<K extends TranslationKey>(
  keys: readonly K[],
): Record<K, string> {
  const locale = useLocale();

  return useMemo(
    () =>
      keys.reduce(
        (accumulator, key) => {
          accumulator[key] = translate(locale, key);
          return accumulator;
        },
        {} as Record<K, string>,
      ),
    [keys, locale],
  );
}
