/**
 * BUBBLE — definição da linguagem (núcleo provisório 0.1)
 *
 * Este arquivo é a ÚNICA fonte de verdade da linguagem para o Bubble Studio:
 * lexer, parser, destaque de sintaxe, autocompletar e validação de pacote
 * leem daqui. Nenhuma outra parte do Studio inventa palavras reservadas,
 * operadores ou símbolos.
 *
 * Status do núcleo: PROPOSTO (ver docs/LANGUAGE.md).
 * A especificação oficial do projeto ainda não fechou a sintaxe nem a função
 * de cada caractere especial, portanto:
 *  - os símbolos listados em `reservedSymbols` são RECONHECIDOS pelo lexer e
 *    permanecem sem significado (uso gera diagnóstico, nunca é ignorado);
 *  - os símbolos `activeSymbols` têm função documentada aqui e podem ser
 *    usados pelo parser;
 *  - nada é traduzido para JavaScript: o compilador produz IR Bubble.
 *
 * Criador do projeto Bubble: Ruan.
 */

export type LanguageStatus = 'PROPOSTO' | 'APROVADO' | 'PENDENTE';

export interface SymbolDefinition {
  /** Texto exato do símbolo. */
  symbol: string;
  /** `active` = tem função definida e o parser pode usá-lo. */
  role: 'active' | 'reserved';
  /** Função documentada (obrigatória para símbolos ativos). */
  meaning: string;
  status: LanguageStatus;
}

export interface BuiltinFunction {
  name: string;
  /** Assinaturas possíveis; tipos em notação Bubble (`list<any>` etc.). */
  overloads: { params: string[]; returns: string; doc: string }[];
}

export interface EventDefinition {
  name: string;
  doc: string;
}

/**
 * Inventário de caracteres especiais fornecido pelo criador (seção 4 da
 * especificação). O lexer reconhece TODOS eles; os que não têm função
 * aprovada ficam reservados.
 */
export const SPECIAL_CHARACTER_INVENTORY =
  "+×÷=/_<>[]!@#$%^&*()-'\":;,?`~\\|{}°•○●□■♤♡◇♧☆▪︎¤《》";

/** Símbolos com função definida no núcleo provisório 0.1. */
export const ACTIVE_SYMBOLS: SymbolDefinition[] = [
  { symbol: '+', role: 'active', meaning: 'soma numérica ou concatenação de texto', status: 'PROPOSTO' },
  { symbol: '-', role: 'active', meaning: 'subtração e negação numérica', status: 'PROPOSTO' },
  { symbol: '*', role: 'active', meaning: 'multiplicação', status: 'PROPOSTO' },
  { symbol: '/', role: 'active', meaning: 'divisão', status: 'PROPOSTO' },
  { symbol: '%', role: 'active', meaning: 'resto da divisão', status: 'PROPOSTO' },
  { symbol: '=', role: 'active', meaning: 'atribuição de valor', status: 'PROPOSTO' },
  { symbol: '==', role: 'active', meaning: 'comparação de igualdade', status: 'PROPOSTO' },
  { symbol: '!=', role: 'active', meaning: 'comparação de diferença', status: 'PROPOSTO' },
  { symbol: '<', role: 'active', meaning: 'comparação menor que', status: 'PROPOSTO' },
  { symbol: '<=', role: 'active', meaning: 'comparação menor ou igual', status: 'PROPOSTO' },
  { symbol: '>', role: 'active', meaning: 'comparação maior que', status: 'PROPOSTO' },
  { symbol: '>=', role: 'active', meaning: 'comparação maior ou igual', status: 'PROPOSTO' },
  { symbol: '->', role: 'active', meaning: 'tipo de retorno de uma função', status: 'PROPOSTO' },
  { symbol: '!', role: 'active', meaning: 'negação lógica (equivalente a "not")', status: 'PROPOSTO' },
  { symbol: '(', role: 'active', meaning: 'abre agrupamento ou lista de parâmetros', status: 'PROPOSTO' },
  { symbol: ')', role: 'active', meaning: 'fecha agrupamento ou lista de parâmetros', status: 'PROPOSTO' },
  { symbol: '{', role: 'active', meaning: 'abre bloco ou corpo de struct', status: 'PROPOSTO' },
  { symbol: '}', role: 'active', meaning: 'fecha bloco ou corpo de struct', status: 'PROPOSTO' },
  { symbol: '[', role: 'active', meaning: 'abre literal de lista ou índice', status: 'PROPOSTO' },
  { symbol: ']', role: 'active', meaning: 'fecha literal de lista ou índice', status: 'PROPOSTO' },
  { symbol: ',', role: 'active', meaning: 'separa itens e argumentos', status: 'PROPOSTO' },
  { symbol: ':', role: 'active', meaning: 'anotação de tipo', status: 'PROPOSTO' },
  { symbol: '.', role: 'active', meaning: 'acesso a membro (módulo, struct)', status: 'PROPOSTO' },
  { symbol: '"', role: 'active', meaning: 'delimita literal de texto', status: 'PROPOSTO' },
];

/** Símbolos do inventário sem função aprovada: reconhecidos e reservados. */
export const RESERVED_SYMBOLS: string[] = [
  '×', '÷', '_', '@', '#', '$', '^', '&', "'", ';', '?', '`', '~', '\\', '|',
  '°', '•', '○', '●', '□', '■', '♤', '♡', '◇', '♧', '☆', '▪︎', '▪', '¤', '《', '》',
];

/** Mapa símbolo → definição (reservados inclusive). */
export const SYMBOL_TABLE: Map<string, SymbolDefinition> = new Map([
  ...ACTIVE_SYMBOLS.map((s) => [s.symbol, s] as const),
  ...RESERVED_SYMBOLS.map(
    (symbol) =>
      [
        symbol,
        {
          symbol,
          role: 'reserved' as const,
          meaning: 'reservado: função ainda não aprovada pela especificação',
          status: 'PENDENTE' as const,
        },
      ] as const,
  ),
]);

/** Símbolos ordenados do maior para o menor (casamento mais longo primeiro). */
export const SYMBOLS_BY_LENGTH: string[] = [...SYMBOL_TABLE.keys()].sort(
  (a, b) => b.length - a.length,
);

export const KEYWORDS: string[] = [
  'module',
  'use',
  'fn',
  'let',
  'const',
  'struct',
  'if',
  'else',
  'while',
  'for',
  'in',
  'return',
  'break',
  'continue',
  'on',
  'and',
  'or',
  'not',
  'true',
  'false',
];

/** Tipos nativos do núcleo. `list` é genérico (`list<num>`). */
export const PRIMITIVE_TYPES = ['num', 'text', 'bool', 'void', 'any'] as const;
export type PrimitiveTypeName = (typeof PRIMITIVE_TYPES)[number];

/** Struct nativo exposto pela linguagem (útil para a prévia 3D). */
export const BUILTIN_STRUCTS: Record<string, { fields: Record<string, string>; doc: string }> = {
  vec3: {
    fields: { x: 'num', y: 'num', z: 'num' },
    doc: 'Vetor de três componentes numéricas.',
  },
};

/** Funções da biblioteca padrão provisória (assinaturas reais verificadas). */
export const BUILTIN_FUNCTIONS: BuiltinFunction[] = [
  {
    name: 'print',
    overloads: [{ params: ['text'], returns: 'void', doc: 'Escreve um texto no console Bubble.' }],
  },
  {
    name: 'sqrt',
    overloads: [{ params: ['num'], returns: 'num', doc: 'Raiz quadrada.' }],
  },
  {
    name: 'abs',
    overloads: [{ params: ['num'], returns: 'num', doc: 'Valor absoluto.' }],
  },
  {
    name: 'floor',
    overloads: [{ params: ['num'], returns: 'num', doc: 'Arredonda para baixo.' }],
  },
  {
    name: 'min',
    overloads: [{ params: ['num', 'num'], returns: 'num', doc: 'Menor entre dois números.' }],
  },
  {
    name: 'max',
    overloads: [{ params: ['num', 'num'], returns: 'num', doc: 'Maior entre dois números.' }],
  },
  {
    name: 'clamp',
    overloads: [
      {
        params: ['num', 'num', 'num'],
        returns: 'num',
        doc: 'Limita um número entre mínimo e máximo.',
      },
    ],
  },
  {
    name: 'len',
    overloads: [
      { params: ['text'], returns: 'num', doc: 'Quantidade de caracteres de um texto.' },
      { params: ['list<any>'], returns: 'num', doc: 'Quantidade de itens de uma lista.' },
    ],
  },
  {
    name: 'vec3',
    overloads: [{ params: ['num', 'num', 'num'], returns: 'vec3', doc: 'Cria um vetor 3D.' }],
  },
];

/** Eventos que o Executor poderá chamar. Blocos `on <evento> { }`. */
export const EVENTS: EventDefinition[] = [
  { name: 'start', doc: 'Executado uma vez quando o programa inicia.' },
  { name: 'update', doc: 'Executado a cada quadro (depende do Executor).' },
  { name: 'draw', doc: 'Executado após a atualização, antes da renderização.' },
  { name: 'stop', doc: 'Executado quando o programa é encerrado.' },
];

export const EVENT_NAMES = EVENTS.map((e) => e.name);
export const TYPE_NAMES = [...PRIMITIVE_TYPES, 'list', ...Object.keys(BUILTIN_STRUCTS)];
export const BUILTIN_NAMES = BUILTIN_FUNCTIONS.map((f) => f.name);

export const FILE_EXTENSION = '.bubble';
export const LANGUAGE_VERSION = '0.1';

/** Texto curto usado na interface para explicar o status da linguagem. */
export const LANGUAGE_STATUS_NOTE =
  'Núcleo provisório 0.1: a especificação oficial ainda não fechou a sintaxe. ' +
  'Tudo que o compilador aceita está documentado em docs/LANGUAGE.md.';

export function isKeyword(word: string): boolean {
  return KEYWORDS.includes(word);
}

export function isTypeName(word: string): boolean {
  return TYPE_NAMES.includes(word);
}

export function symbolDefinition(symbol: string): SymbolDefinition | undefined {
  return SYMBOL_TABLE.get(symbol);
}
