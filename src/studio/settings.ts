/**
 * Preferências locais do Studio: tema e compilação automática.
 * Salvas no dispositivo; nada é enviado para servidor.
 */

import { useCallback, useEffect, useState } from 'react';

export type ThemePreference = 'dark' | 'light' | 'system';

export interface Settings {
  theme: ThemePreference;
  autoCompile: boolean;
}

const SETTINGS_KEY = 'bubble.studio.settings.v1';

const DEFAULTS: Settings = { theme: 'system', autoCompile: true };

function readSettings(): Settings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      theme:
        parsed.theme === 'dark' || parsed.theme === 'light' || parsed.theme === 'system'
          ? parsed.theme
          : DEFAULTS.theme,
      autoCompile: typeof parsed.autoCompile === 'boolean' ? parsed.autoCompile : DEFAULTS.autoCompile,
    };
  } catch {
    return DEFAULTS;
  }
}

function resolvedTheme(theme: ThemePreference): 'dark' | 'light' {
  if (theme !== 'system') return theme;
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function useSettings(): {
  settings: Settings;
  resolved: 'dark' | 'light';
  update: (patch: Partial<Settings>) => void;
} {
  const [settings, setSettings] = useState<Settings>(() => readSettings());
  const [resolved, setResolved] = useState<'dark' | 'light'>(() => resolvedTheme(settings.theme));

  useEffect(() => {
    const apply = (): void => {
      const next = resolvedTheme(settings.theme);
      setResolved(next);
      document.documentElement.dataset.theme = next;
    };
    apply();
    if (settings.theme !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: light)');
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [settings.theme]);

  useEffect(() => {
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      /* preferências não persistidas */
    }
  }, [settings]);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((current) => ({ ...current, ...patch }));
  }, []);

  return { settings, resolved, update };
}
