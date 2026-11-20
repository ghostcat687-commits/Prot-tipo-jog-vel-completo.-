/**
 * LEXER da linguagem Bubble.
 *
 * Percorre o texto caractere por caractere e produz tokens com linha/coluna
 * reais. Não adivinha: todo caractere especial do inventário oficial é
 * reconhecido. Símbolos sem função aprovada geram diagnóstico e token
 * `reserved` — nunca são ignorados silenciosamente.
 */

import { KEYWORDS, SYMBOLS_BY_LENGTH, SYMBOL_TABLE, TYPE_NAMES } from '../language/spec';
import {
  type Diagnostic,
  type Position,
  type Span,
  makeDiagnostic,
} from './diagnostics';

export type TokenKind =
  | 'number'
  | 'text'
  | 'identifier'
  | 'keyword'
  | 'type'
  | 'operator'
  | 'reserved'
  | 'eof';

export interface Token {
  kind: TokenKind;
  /** Texto do token como aparece na fonte. */
  value: string;
  /** Valor já interpretado (texto sem aspas, número convertido). */
  literal?: string | number;
  span: Span;
}

export interface LexResult {
  tokens: Token[];
  diagnostics: Diagnostic[];
}

const IDENTIFIER_START = /[A-Za-zÀ-ÖØ-öø-ÿ]/;
const IDENTIFIER_PART = /[A-Za-zÀ-ÖØ-öø-ÿ0-9_]/;
const DIGIT = /[0-9]/;
const VALID_ESCAPES: Record<string, string> = {
  n: '\n',
  t: '\t',
  r: '\r',
  '"': '"',
  '\\': '\\',
  '0': '\0',
};

export function lex(source: string, file?: string): LexResult {
  const tokens: Token[] = [];
  const diagnostics: Diagnostic[] = [];

  let offset = 0;
  let line = 1;
  let column = 1;

  const here = (): Position => ({ offset, line, column });

  const advance = (count = 1): void => {
    for (let i = 0; i < count; i += 1) {
      if (source[offset] === '\n') {
        line += 1;
        column = 1;
      } else {
        column += 1;
      }
      offset += 1;
    }
  };

  const push = (kind: TokenKind, start: Position, literal?: string | number): void => {
    tokens.push({
      kind,
      value: source.slice(start.offset, offset),
      literal,
      span: { start, end: here() },
    });
  };

  const error = (code: string, span: Span, params?: Record<string, string | number>): void => {
    diagnostics.push(makeDiagnostic(code, 'error', span, params, file));
  };

  while (offset < source.length) {
    const ch = source[offset];

    // --- espaços -------------------------------------------------------
    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n' || ch === '\f') {
      advance();
      continue;
    }

    // --- comentários ---------------------------------------------------
    if (ch === '/' && source[offset + 1] === '/') {
      // Comentário de linha: descartado, mas a posição continua correta.
      while (offset < source.length && source[offset] !== '\n') advance();
      continue;
    }
    if (ch === '/' && source[offset + 1] === '*') {
      const start = here();
      advance(2);
      let closed = false;
      while (offset < source.length) {
        if (source[offset] === '*' && source[offset + 1] === '/') {
          advance(2);
          closed = true;
          break;
        }
        advance();
      }
      if (!closed) error('BUB105', { start, end: here() });
      continue;
    }

    // --- texto ---------------------------------------------------------
    if (ch === '"') {
      const start = here();
      advance();
      let value = '';
      let closed = false;
      while (offset < source.length) {
        const c = source[offset];
        if (c === '\n') break;
        if (c === '"') {
          advance();
          closed = true;
          break;
        }
        if (c === '\\') {
          const escapeStart = here();
          const next = source[offset + 1];
          if (next !== undefined && VALID_ESCAPES[next] !== undefined) {
            value += VALID_ESCAPES[next];
            advance(2);
            continue;
          }
          error('BUB103', { start: escapeStart, end: { ...escapeStart, offset: escapeStart.offset + 2, column: escapeStart.column + 2 } }, {
            escape: `\\${next ?? ''}`,
          });
          advance(2);
          continue;
        }
        value += c;
        advance();
      }
      if (!closed) error('BUB104', { start, end: here() });
      push('text', start, value);
      continue;
    }

    // --- números -------------------------------------------------------
    if (DIGIT.test(ch)) {
      const start = here();
      while (offset < source.length && DIGIT.test(source[offset])) advance();
      if (source[offset] === '.' && DIGIT.test(source[offset + 1] ?? '')) {
        advance();
        while (offset < source.length && DIGIT.test(source[offset])) advance();
      }
      if (source[offset] === 'e' || source[offset] === 'E') {
        const exponentStart = offset;
        const sign = source[offset + 1] === '+' || source[offset + 1] === '-' ? 1 : 0;
        if (DIGIT.test(source[offset + 1 + sign] ?? '')) {
          advance(1 + sign);
          while (offset < source.length && DIGIT.test(source[offset])) advance();
        } else {
          offset = exponentStart; // não consome o "e": ele pertence ao identificador
        }
      }
      const raw = source.slice(start.offset, offset);
      const value = Number(raw);
      if (!Number.isFinite(value)) {
        error('BUB106', { start, end: here() }, { value: raw });
      }
      push('number', start, value);
      continue;
    }

    // --- identificadores / palavras reservadas -------------------------
    if (IDENTIFIER_START.test(ch)) {
      const start = here();
      while (offset < source.length && IDENTIFIER_PART.test(source[offset])) advance();
      const word = source.slice(start.offset, offset);
      if (KEYWORDS.includes(word)) {
        push('keyword', start, word);
      } else if (TYPE_NAMES.includes(word)) {
        push('type', start, word);
      } else {
        push('identifier', start, word);
      }
      continue;
    }

    // --- símbolos ------------------------------------------------------
    const matched = SYMBOLS_BY_LENGTH.find((symbol) => source.startsWith(symbol, offset));
    if (matched) {
      const start = here();
      advance(matched.length);
      const definition = SYMBOL_TABLE.get(matched);
      if (definition?.role === 'reserved') {
        error('BUB101', { start, end: here() }, { symbol: matched });
        push('reserved', start, matched);
      } else {
        push('operator', start, matched);
      }
      continue;
    }

    // --- caractere desconhecido ----------------------------------------
    {
      const start = here();
      const char = String.fromCodePoint(source.codePointAt(offset) ?? 0);
      advance(char.length);
      error('BUB102', { start, end: here() }, { char });
      push('reserved', start, char);
    }
  }

  const eof = here();
  tokens.push({ kind: 'eof', value: '', span: { start: eof, end: eof } });
  return { tokens, diagnostics };
}
