/**
 * Suporte do CodeMirror à linguagem Bubble.
 *
 * O destaque de sintaxe e o autocompletar são derivados da definição real da
 * linguagem (`src/bubble/language/spec.ts`), nunca de JavaScript: palavras
 * reservadas, tipos, símbolos ativos e símbolos reservados vêm do mesmo
 * catálogo usado pelo lexer.
 */

import { HighlightStyle, StreamLanguage, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import type { Completion, CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import type { StringStream } from '@codemirror/language';
import {
  BUILTIN_FUNCTIONS,
  EVENTS,
  KEYWORDS,
  SYMBOLS_BY_LENGTH,
  SYMBOL_TABLE,
  TYPE_NAMES,
} from '../bubble/language/spec';
import { lex } from '../bubble/compiler/lexer';

interface BubbleStreamState {
  inBlockComment: boolean;
}

const IDENTIFIER = /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ0-9_]*/;
const NUMBER = /^\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/;

export const bubbleStreamLanguage = StreamLanguage.define<BubbleStreamState>({
  name: 'bubble',
  startState: () => ({ inBlockComment: false }),
  tokenTable: {
    keyword: tags.keyword,
    typeName: tags.typeName,
    number: tags.number,
    string: tags.string,
    comment: tags.comment,
    operator: tags.operator,
    punctuation: tags.punctuation,
    variableName: tags.variableName,
    functionName: tags.function(tags.variableName),
    builtin: tags.standard(tags.variableName),
    propertyName: tags.propertyName,
    invalid: tags.invalid,
    bool: tags.bool,
  },
  token(stream: StringStream, state: BubbleStreamState): string | null {
    if (state.inBlockComment) {
      if (stream.skipTo('*/')) {
        stream.match('*/');
        state.inBlockComment = false;
      } else {
        stream.skipToEnd();
      }
      return 'comment';
    }
    if (stream.eatSpace()) return null;

    if (stream.match('//')) {
      stream.skipToEnd();
      return 'comment';
    }
    if (stream.match('/*')) {
      state.inBlockComment = true;
      if (stream.skipTo('*/')) {
        stream.match('*/');
        state.inBlockComment = false;
      } else {
        stream.skipToEnd();
      }
      return 'comment';
    }

    if (stream.match(/^"(?:[^"\\\n]|\\.)*"/)) return 'string';
    if (stream.peek() === '"') {
      stream.skipToEnd();
      return 'string';
    }

    if (stream.match(NUMBER)) return 'number';

    const word = stream.match(IDENTIFIER) as RegExpMatchArray | null;
    if (word) {
      const value = String(word[0]);
      if (value === 'true' || value === 'false') return 'bool';
      if (KEYWORDS.includes(value)) return 'keyword';
      if (TYPE_NAMES.includes(value)) return 'typeName';
      if (BUILTIN_FUNCTIONS.some((fn) => fn.name === value)) return 'builtin';
      const rest = stream.string.slice(stream.pos).trimStart();
      if (rest.startsWith('(')) return 'functionName';
      return 'variableName';
    }

    for (const symbol of SYMBOLS_BY_LENGTH) {
      if (stream.match(symbol, false)) {
        stream.match(symbol);
        const definition = SYMBOL_TABLE.get(symbol);
        if (definition?.role === 'reserved') return 'invalid';
        if (symbol === '(' || symbol === ')' || symbol === '{' || symbol === '}' || symbol === '[' || symbol === ']' || symbol === ',' || symbol === ':' || symbol === '.') {
          return 'punctuation';
        }
        return 'operator';
      }
    }

    stream.next();
    return 'invalid';
  },
});

/** Cores vêm de variáveis CSS, então o mesmo estilo serve aos dois temas. */
export const bubbleHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: 'var(--tok-keyword)', fontWeight: '600' },
  { tag: tags.typeName, color: 'var(--tok-type)' },
  { tag: tags.number, color: 'var(--tok-number)' },
  { tag: tags.bool, color: 'var(--tok-number)' },
  { tag: tags.string, color: 'var(--tok-string)' },
  { tag: tags.comment, color: 'var(--tok-comment)', fontStyle: 'italic' },
  { tag: tags.operator, color: 'var(--tok-operator)' },
  { tag: tags.punctuation, color: 'var(--tok-punctuation)' },
  { tag: tags.variableName, color: 'var(--tok-variable)' },
  { tag: tags.function(tags.variableName), color: 'var(--tok-function)' },
  { tag: tags.standard(tags.variableName), color: 'var(--tok-builtin)' },
  { tag: tags.propertyName, color: 'var(--tok-property)' },
  { tag: tags.invalid, color: 'var(--tok-invalid)', textDecoration: 'underline wavy' },
]);

export const bubbleHighlighting = syntaxHighlighting(bubbleHighlightStyle);

/** Símbolos declarados no documento atual (para autocompletar). */
export function declaredSymbols(source: string): Completion[] {
  const { tokens } = lex(source);
  const options: Completion[] = [];
  const seen = new Set<string>();
  const push = (completion: Completion): void => {
    if (seen.has(completion.label)) return;
    seen.add(completion.label);
    options.push(completion);
  };

  for (let index = 0; index < tokens.length - 1; index += 1) {
    const token = tokens[index];
    const next = tokens[index + 1];
    if (token.kind !== 'keyword' || next.kind !== 'identifier') continue;
    switch (token.value) {
      case 'fn':
        push({ label: next.value, type: 'function', detail: 'fn' });
        break;
      case 'let':
      case 'const':
        push({ label: next.value, type: 'variable', detail: token.value });
        break;
      case 'struct':
        push({ label: next.value, type: 'class', detail: 'struct' });
        break;
      case 'for':
        push({ label: next.value, type: 'variable', detail: 'for' });
        break;
      default:
        break;
    }
  }
  return options;
}

export function bubbleCompletionSource(context: CompletionContext): CompletionResult | null {
  const word = context.matchBefore(/[A-Za-zÀ-ÖØ-öø-ÿ_][A-Za-zÀ-ÖØ-öø-ÿ0-9_]*/);
  if (!word || (word.from === word.to && !context.explicit)) return null;

  const options: Completion[] = [
    ...KEYWORDS.map<Completion>((keyword) => ({
      label: keyword,
      type: 'keyword',
      detail: 'palavra reservada',
    })),
    ...TYPE_NAMES.map<Completion>((type) => ({ label: type, type: 'type', detail: 'tipo' })),
    ...BUILTIN_FUNCTIONS.map<Completion>((fn) => ({
      label: fn.name,
      type: 'function',
      detail: `${fn.overloads[0].params.join(', ')} → ${fn.overloads[0].returns}`,
      info: fn.overloads[0].doc,
    })),
    ...declaredSymbols(context.state.doc.toString()),
  ];

  // Trechos de código reais da linguagem.
  const snippets: Completion[] = [
    {
      label: 'fn',
      type: 'keyword',
      detail: 'declarar função',
      apply: 'fn nome(param: num) -> num {\n  return param\n}',
    },
    {
      label: 'on start',
      type: 'keyword',
      detail: 'evento de início',
      apply: 'on start {\n  print("início")\n}',
    },
    {
      label: 'for',
      type: 'keyword',
      detail: 'percorrer lista',
      apply: 'for item in lista {\n  print("item")\n}',
    },
    {
      label: 'if',
      type: 'keyword',
      detail: 'condição',
      apply: 'if condicao {\n  print("sim")\n}',
    },
  ];
  for (const snippet of snippets) {
    if (!options.some((option) => option.label === snippet.label)) options.push(snippet);
  }
  for (const event of EVENTS) {
    options.push({
      label: `on ${event.name}`,
      type: 'keyword',
      detail: 'evento',
      info: event.doc,
      apply: `on ${event.name} {\n  \n}`,
    });
  }

  return { from: word.from, options, validFor: /^[A-Za-zÀ-ÖØ-öø-ÿ_0-9]*$/ };
}
