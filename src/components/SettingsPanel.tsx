/** Configurações do Studio: idioma, tema, compilação automática e instalação. */

import { useEffect } from 'react';
import { LOCALES, useI18n, type LocaleCode } from '../i18n';
import type { Settings, ThemePreference } from '../studio/settings';
import { CloseIcon, DownloadIcon, GlobeIcon, MoonIcon, SunIcon } from './Icons';

export interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  onResetProject: () => void;
  canInstall: boolean;
  installed: boolean;
  onInstall: () => void;
}

export function SettingsPanel({
  open,
  onClose,
  settings,
  onChange,
  onResetProject,
  canInstall,
  installed,
  onInstall,
}: SettingsPanelProps): JSX.Element | null {
  const { t, locale, setLocale } = useI18n();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const themes: { value: ThemePreference; label: string; icon: JSX.Element }[] = [
    { value: 'dark', label: t('settings.theme.dark'), icon: <MoonIcon size={14} /> },
    { value: 'light', label: t('settings.theme.light'), icon: <SunIcon size={14} /> },
    { value: 'system', label: t('settings.theme.system'), icon: <GlobeIcon size={14} /> },
  ];

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <h2 id="settings-title">{t('settings.title')}</h2>
          <button type="button" className="icon-button" aria-label={t('common.close')} onClick={onClose}>
            <CloseIcon size={16} />
          </button>
        </header>

        <div className="modal-body">
          <section className="settings-section">
            <h3>{t('settings.language')}</h3>
            <p className="settings-hint">{t('settings.languageHint')}</p>
            <div className="segmented" role="group" aria-label={t('settings.language')}>
              {LOCALES.map((option) => (
                <button
                  key={option.code}
                  type="button"
                  className={locale === option.code ? 'is-selected' : ''}
                  aria-pressed={locale === option.code}
                  onClick={() => setLocale(option.code as LocaleCode)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </section>

          <section className="settings-section">
            <h3>{t('settings.theme')}</h3>
            <div className="segmented" role="group" aria-label={t('settings.theme')}>
              {themes.map((theme) => (
                <button
                  key={theme.value}
                  type="button"
                  className={settings.theme === theme.value ? 'is-selected' : ''}
                  aria-pressed={settings.theme === theme.value}
                  onClick={() => onChange({ theme: theme.value })}
                >
                  {theme.icon}
                  {theme.label}
                </button>
              ))}
            </div>
          </section>

          <section className="settings-section">
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={settings.autoCompile}
                onChange={(event) => onChange({ autoCompile: event.target.checked })}
              />
              <span>
                <strong>{t('settings.autoCompile')}</strong>
                <em>{t('settings.autoCompileHint')}</em>
              </span>
            </label>
          </section>

          <section className="settings-section">
            <h3>{t('settings.install')}</h3>
            <p className="settings-hint">{t('settings.installBody')}</p>
            <button type="button" className="button" onClick={onInstall} disabled={!canInstall || installed}>
              <DownloadIcon size={15} />
              {installed ? t('toolbar.installed') : t('toolbar.install')}
            </button>
          </section>

          <section className="settings-section">
            <h3>{t('settings.offline')}</h3>
            <p className="settings-hint">{t('settings.offlineBody')}</p>
          </section>

          <section className="settings-section">
            <h3>{t('settings.storage')}</h3>
            <p className="settings-hint">{t('settings.storageBody')}</p>
            <button
              type="button"
              className="button danger"
              onClick={() => {
                if (window.confirm(t('settings.resetConfirm'))) onResetProject();
              }}
            >
              {t('settings.reset')}
            </button>
          </section>

          <section className="settings-section">
            <h3>{t('settings.about')}</h3>
            <p className="settings-hint">{t('settings.aboutBody')}</p>
            <p className="settings-hint dim">
              {t('app.name')} {t('app.version')} · {t('app.creator')} · {t('status.languageStatus', { version: '0.1' })}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
