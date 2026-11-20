/**
 * Diagnósticos do compilador Bubble.
 *
 * Todo diagnóstico carrega um CÓDIGO estável e uma chave de tradução
 * (`diag.<código>`), de modo que a interface possa exibir a mensagem no
 * idioma do usuário sem que o compilador dependa de i18n.
 */

export type Severity = 'error' | 'warning' | 'info';

export interface Position {
  /** Deslocamento em caracteres (0-based). */
  offset: number;
  /** Linha 1-based. */
  line: number;
  /** Coluna 1-based. */
  column: number;
}

export interface Span {
  start: Position;
  end: Position;
}

export interface Diagnostic {
  code: string;
  severity: Severity;
  /** Chave i18n da mensagem, ex.: `diag.BUB101`. */
  messageKey: string;
  params?: Record<string, string | number>;
  file?: string;
  span: Span;
}

export function position(offset: number, line: number, column: number): Position {
  return { offset, line, column };
}

export function span(start: Position, end: Position): Span {
  return { start, end };
}

export function emptySpan(): Span {
  const p = position(0, 1, 1);
  return { start: p, end: p };
}

export function makeDiagnostic(
  code: string,
  severity: Severity,
  span: Span,
  params?: Record<string, string | number>,
  file?: string,
): Diagnostic {
  return { code, severity, messageKey: `diag.${code}`, params, file, span };
}

export function countBySeverity(diagnostics: Diagnostic[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { error: 0, warning: 0, info: 0 };
  for (const d of diagnostics) counts[d.severity] += 1;
  return counts;
}

export function hasErrors(diagnostics: Diagnostic[]): boolean {
  return diagnostics.some((d) => d.severity === 'error');
}

/** Ordena por arquivo, linha e coluna — ordem estável para a interface. */
export function sortDiagnostics(diagnostics: Diagnostic[]): Diagnostic[] {
  return [...diagnostics].sort((a, b) => {
    const fileA = a.file ?? '';
    const fileB = b.file ?? '';
    if (fileA !== fileB) return fileA.localeCompare(fileB);
    if (a.span.start.line !== b.span.start.line) return a.span.start.line - b.span.start.line;
    return a.span.start.column - b.span.start.column;
  });
}
