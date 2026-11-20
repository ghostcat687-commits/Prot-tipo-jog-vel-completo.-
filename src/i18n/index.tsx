/**
 * i18n do Bubble Studio.
 *
 * - O idioma é detectado do navegador/dispositivo na primeira visita.
 * - Português brasileiro é o idioma padrão alternativo.
 * - A escolha manual fica salva e tem prioridade sobre a detecção.
 * - Toda a interface (incluindo diagnósticos do compilador) passa por `t`.
 * - Idiomas de direita para a esquerda (árabe) ajustam `dir` do documento.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ptBR, type MessageKey, type Messages } from './locales/pt-BR';
import { en } from './locales/en';
import { es } from './locales/es';
import { ar } from './locales/ar';

export type LocaleCode = 'pt-BR' | 'en' | 'es' | 'ar';
export type TextDirection = 'ltr' | 'rtl';

export interface LocaleOption {
  code: LocaleCode;
  label: string;
  dir: TextDirection;
}

export const LOCALES: LocaleOption[] = [
  { code: 'pt-BR', label: 'Português (Brasil)', dir: 'ltr' },
  { code: 'en', label: 'English', dir: 'ltr' },
  { code: 'es', label: 'Español', dir: 'ltr' },
  { code: 'ar', label: 'العربية', dir: 'rtl' },
];

export const MESSAGES: Record<LocaleCode, Messages> = {
  'pt-BR': ptBR,
  en,
  es,
  ar,
};

export const DEFAULT_LOCALE: LocaleCode = 'pt-BR';
export const LOCALE_STORAGE_KEY = 'bubble.studio.locale';

const LOCALE_ALIASES: Record<string, LocaleCode> = {
  pt: 'pt-BR',
  'pt-br': 'pt-BR',
  'pt-pt': 'pt-BR',
  en: 'en',
  es: 'es',
  ar: 'ar',
};

function isLocaleCode(value: string | null | undefined): value is LocaleCode {
  return value === 'pt-BR' || value === 'en' || value === 'es' || value === 'ar';
}

/** Converte `en-US` em `en`, `pt-PT` em `pt-BR`, etc. */
export function normalizeLocale(tag: string): LocaleCode | null {
  const lower = tag.toLowerCase();
  if (LOCALE_ALIASES[lower]) return LOCALE_ALIASES[lower];
  const base = lower.split('-')[0];
  return LOCALE_ALIASES[base] ?? null;
}

export function detectLocale(): LocaleCode {
  if (typeof window !== 'undefined') {
    try {
      const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
      if (isLocaleCode(stored)) return stored;
      if (stored) {
        const normalized = normalizeLocale(stored);
        if (normalized) return normalized;
      }
    } catch {
      /* armazenamento indisponível: segue para a detecção */
    }
  }
  if (typeof navigator !== 'undefined') {
    const candidates = [navigator.language, ...(navigator.languages ?? [])];
    for (const candidate of candidates) {
      if (!candidate) continue;
      const normalized = normalizeLocale(candidate);
      if (normalized) return normalized;
    }
  }
  return DEFAULT_LOCALE;
}

export function directionOf(locale: LocaleCode): TextDirection {
  return LOCALES.find((option) => option.code === locale)?.dir ?? 'ltr';
}

export function translate(
  locale: LocaleCode,
  key: MessageKey,
  params?: Record<string, string | number>,
): string {
  const template = MESSAGES[locale]?.[key] ?? ptBR[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    params[name] === undefined ? match : String(params[name]),
  );
}

export interface I18nValue {
  locale: LocaleCode;
  dir: TextDirection;
  setLocale: (locale: LocaleCode) => void;
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }): JSX.Element {
  const [locale, setLocaleState] = useState<LocaleCode>(() => detectLocale());

  const setLocale = useCallback((next: LocaleCode) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      /* preferência não persistida — a sessão continua no idioma escolhido */
    }
  }, []);

  useEffect(() => {
    const dir = directionOf(locale);
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [locale]);

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      dir: directionOf(locale),
      setLocale,
      t: (key, params) => translate(locale, key, params),
    }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n precisa estar dentro de <I18nProvider>');
  return context;
}

export type { MessageKey, Messages };
