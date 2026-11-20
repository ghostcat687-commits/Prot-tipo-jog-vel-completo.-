import { describe, expect, it } from 'vitest';
import { LOCALES, MESSAGES, translate, normalizeLocale, DEFAULT_LOCALE } from './index';
import { ptBR } from './locales/pt-BR';

const canonicalKeys = Object.keys(ptBR).sort();

describe('i18n', () => {
  it('todas as traduções cobrem exatamente as mesmas chaves', () => {
    for (const option of LOCALES) {
      expect(Object.keys(MESSAGES[option.code]).sort(), option.code).toEqual(canonicalKeys);
    }
  });

  it('nenhuma mensagem está vazia', () => {
    for (const option of LOCALES) {
      for (const [key, value] of Object.entries(MESSAGES[option.code])) {
        expect(value.trim().length, `${option.code}:${key}`).toBeGreaterThan(0);
      }
    }
  });

  it('diagnósticos possuem mensagem traduzida', () => {
    const diagnosticKeys = canonicalKeys.filter((key) => key.startsWith('diag.'));
    expect(diagnosticKeys.length).toBeGreaterThan(30);
    for (const option of LOCALES) {
      for (const key of diagnosticKeys) {
        expect(MESSAGES[option.code][key as keyof typeof ptBR]).toBeTruthy();
      }
    }
  });

  it('interpola parâmetros', () => {
    expect(translate('pt-BR', 'build.errors', { count: 3 })).toBe('3 erro(s)');
    expect(translate('en', 'build.errors', { count: 3 })).toBe('3 error(s)');
    expect(translate('ar', 'build.errors', { count: 3 })).toContain('3');
  });

  it('mantém o parâmetro quando ele não é fornecido', () => {
    expect(translate('pt-BR', 'build.errors')).toBe('{count} erro(s)');
  });

  it('detecta idioma por prefixo', () => {
    expect(normalizeLocale('pt-BR')).toBe('pt-BR');
    expect(normalizeLocale('pt-PT')).toBe('pt-BR');
    expect(normalizeLocale('en-US')).toBe('en');
    expect(normalizeLocale('es-419')).toBe('es');
    expect(normalizeLocale('ar-EG')).toBe('ar');
    expect(normalizeLocale('de-DE')).toBeNull();
  });

  it('usa pt-BR como padrão alternativo', () => {
    expect(DEFAULT_LOCALE).toBe('pt-BR');
  });
});
