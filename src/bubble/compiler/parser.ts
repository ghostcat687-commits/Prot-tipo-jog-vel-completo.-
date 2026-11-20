/**
 * PARSER da linguagem Bubble.
 *
 * Constrói a AST a partir dos tokens do lexer, com recuperação de erros por
 * instrução: um erro de sintaxe não impede a análise do restante do arquivo,
 * e todo diagnóstico aponta linha e coluna reais.
 */

import type * as AST from './ast';
import { makeDiagnostic, type Diagnostic, type Span } from './diagnostics';
import { lex, type Token, type TokenKind } from './lexer';

export interface ParseResult {
  program: AST.Program;
  diagnostics: Diagnostic[];
}

const STATEMENT_KEYWORDS = new Set([
  'let',
  'const',
  'if',
  'while',
  'for',
  'return',
  'break',
  'continue',
  'fn',
  'struct',
  'on',
  'use',
  'module',
  'else',
]);

class Parser {
  private tokens: Token[];
  private index = 0;
  readonly diagnostics: Diagnostic[] = [];
  private readonly file?: string;

  constructor(tokens: Token[], file?: string) {
    this.tokens = tokens;
    this.file = file;
  }

  // ---------------------------------------------------------------- tokens
  private peek(offset = 0): Token {
    return this.tokens[Math.min(this.index + offset, this.tokens.length - 1)];
  }

  private get current(): Token {
    return this.peek();
  }

  private advance(): Token {
    const token = this.current;
    if (this.index < this.tokens.length - 1) this.index += 1;
    return token;
  }

  private isOperator(op: string, offset = 0): boolean {
    const token = this.peek(offset);
    return token.kind === 'operator' && token.value === op;
  }

  private isKeyword(word: string, offset = 0): boolean {
    const token = this.peek(offset);
    return token.kind === 'keyword' && token.value === word;
  }

  private isKind(kind: TokenKind, offset = 0): boolean {
    return this.peek(offset).kind === kind;
  }

  private atEnd(): boolean {
    return this.current.kind === 'eof';
  }

  private error(code: string, token: Token, params?: Record<string, string | number>): void {
    this.diagnostics.push(makeDiagnostic(code, 'error', token.span, params, this.file));
  }

  private consumeOperator(op: string): Token | null {
    if (this.isOperator(op)) return this.advance();
    this.error('BUB202', this.current, { expected: op, found: this.describe(this.current) });
    return null;
  }

  private consumeIdentifier(what: string): Token | null {
    if (this.isKind('identifier')) return this.advance();
    this.error('BUB202', this.current, {
      expected: what,
      found: this.describe(this.current),
    });
    return null;
  }

  private describe(token: Token): string {
    if (token.kind === 'eof') return 'fim do arquivo';
    return token.value;
  }

  private spanFrom(start: Span['start']): Span {
    return { start, end: this.tokens[Math.max(0, this.index - 1)].span.end };
  }

  /** Avança até o começo de uma instrução — evita erros em cascata. */
  private synchronize(): void {
    while (!this.atEnd()) {
      if (this.isOperator('}')) return;
      if (this.current.kind === 'keyword' && STATEMENT_KEYWORDS.has(this.current.value)) return;
      this.advance();
    }
  }

  // ---------------------------------------------------------------- programa
  parseProgram(): AST.Program {
    const start = this.current.span.start;
    let module: AST.ModuleDecl | null = null;
    const uses: AST.UseDecl[] = [];
    const items: AST.Item[] = [];

    if (this.isKeyword('module')) {
      module = this.parseModuleDecl();
    }

    while (!this.atEnd()) {
      if (this.isKeyword('module')) {
        this.error('BUB203', this.current);
        this.parseModuleDecl();
        continue;
      }
      if (this.isKeyword('use')) {
        uses.push(this.parseUseDecl());
        continue;
      }
      if (this.isKeyword('struct')) {
        items.push(this.parseStructDecl());
        continue;
      }
      if (this.isKeyword('fn')) {
        items.push(this.parseFunctionDecl());
        continue;
      }
      if (this.isKeyword('on')) {
        items.push(this.parseEventDecl());
        continue;
      }
      if (this.isKeyword('let') || this.isKeyword('const')) {
        items.push(this.parseVarDecl());
        continue;
      }
      this.error('BUB201', this.current, { token: this.describe(this.current) });
      this.advance();
      this.synchronize();
    }

    return { kind: 'Program', module, uses, items, span: this.spanFrom(start) };
  }

  private parseModuleDecl(): AST.ModuleDecl {
    const start = this.advance().span.start; // "module"
    const nameToken = this.consumeIdentifier('nome do módulo');
    // Nomes de módulo podem ser qualificados: `module game.performance`.
    let name = nameToken?.value ?? '<erro>';
    while (this.isOperator('.')) {
      this.advance();
      const part = this.consumeIdentifier('nome do módulo');
      if (part) name += `.${part.value}`;
      else break;
    }
    return { kind: 'ModuleDecl', name, span: this.spanFrom(start) };
  }

  private parseUseDecl(): AST.UseDecl {
    const start = this.advance().span.start; // "use"
    let path = '';
    if (this.isKind('identifier') || this.isKind('type') || this.isKind('keyword')) {
      path = this.advance().value;
    } else {
      this.error('BUB202', this.current, { expected: 'módulo', found: this.describe(this.current) });
    }
    while (this.isOperator('.')) {
      this.advance();
      if (this.isKind('identifier') || this.isKind('type') || this.isKind('keyword')) {
        path += `.${this.advance().value}`;
      } else {
        this.error('BUB202', this.current, { expected: 'nome', found: this.describe(this.current) });
        break;
      }
    }
    return { kind: 'UseDecl', path, span: this.spanFrom(start) };
  }

  private parseStructDecl(): AST.StructDecl {
    const start = this.advance().span.start; // "struct"
    const nameToken = this.consumeIdentifier('nome da struct');
    const fields: AST.StructField[] = [];
    const open = this.consumeOperator('{');
    if (open) {
      while (!this.atEnd() && !this.isOperator('}')) {
        const fieldStart = this.current.span.start;
        const fieldName = this.consumeIdentifier('nome do campo');
        this.consumeOperator(':');
        const type = this.parseType();
        if (fieldName && type) {
          fields.push({
            kind: 'StructField',
            name: fieldName.value,
            type,
            span: this.spanFrom(fieldStart),
          });
        }
        if (this.isOperator(',')) this.advance();
        if (!fieldName) this.synchronize();
      }
      this.consumeOperator('}');
    }
    return {
      kind: 'StructDecl',
      name: nameToken?.value ?? '<erro>',
      fields,
      span: this.spanFrom(start),
    };
  }

  private parseFunctionDecl(): AST.FunctionDecl {
    const start = this.advance().span.start; // "fn"
    const nameToken = this.consumeIdentifier('nome da função');
    const params: AST.Parameter[] = [];
    if (this.consumeOperator('(')) {
      while (!this.atEnd() && !this.isOperator(')')) {
        const paramStart = this.current.span.start;
        const paramName = this.consumeIdentifier('nome do parâmetro');
        this.consumeOperator(':');
        const type = this.parseType();
        if (paramName && type) {
          params.push({
            kind: 'Parameter',
            name: paramName.value,
            type,
            span: this.spanFrom(paramStart),
          });
        }
        if (this.isOperator(',')) this.advance();
        else break;
      }
      this.consumeOperator(')');
    }
    let returnType: AST.TypeRef | null = null;
    if (this.isOperator('->')) {
      this.advance();
      returnType = this.parseType();
    }
    const body = this.parseBlock();
    return {
      kind: 'FunctionDecl',
      name: nameToken?.value ?? '<erro>',
      params,
      returnType,
      body,
      span: this.spanFrom(start),
    };
  }

  private parseEventDecl(): AST.EventDecl {
    const start = this.advance().span.start; // "on"
    let event = '<erro>';
    if (this.isKind('identifier') || this.isKind('keyword') || this.isKind('type')) {
      event = this.advance().value;
    } else {
      this.error('BUB202', this.current, { expected: 'evento', found: this.describe(this.current) });
    }
    const body = this.parseBlock();
    return { kind: 'EventDecl', event, body, span: this.spanFrom(start) };
  }

  // ---------------------------------------------------------------- tipos
  private parseType(): AST.TypeRef | null {
    const token = this.current;
    if (token.kind === 'type') {
      this.advance();
      const start = token.span.start;
      if (token.value === 'list') {
        let element: AST.TypeRef = { kind: 'named', name: 'any', span: token.span };
        if (this.consumeOperator('<')) {
          const parsed = this.parseType();
          if (parsed) element = parsed;
          this.consumeOperator('>');
        } else {
          this.error('BUB207', token, { expected: 'list<tipo>' });
        }
        return { kind: 'list', element, span: this.spanFrom(start) };
      }
      return { kind: 'named', name: token.value, span: token.span };
    }
    if (token.kind === 'identifier') {
      this.advance();
      return { kind: 'named', name: token.value, span: token.span };
    }
    this.error('BUB207', token, { expected: 'tipo', found: this.describe(token) });
    return null;
  }

  // ---------------------------------------------------------------- blocos
  private parseBlock(): AST.BlockStmt {
    const start = this.current.span.start;
    const statements: AST.Statement[] = [];
    if (!this.consumeOperator('{')) {
      return { kind: 'BlockStmt', statements, span: { start, end: start } };
    }
    while (!this.atEnd() && !this.isOperator('}')) {
      const before = this.index;
      const statement = this.parseStatement();
      if (statement) statements.push(statement);
      if (this.index === before) this.advance(); // garante progresso
    }
    this.consumeOperator('}');
    return { kind: 'BlockStmt', statements, span: this.spanFrom(start) };
  }

  private parseStatement(): AST.Statement | null {
    const token = this.current;
    if (token.kind === 'keyword') {
      switch (token.value) {
        case 'let':
        case 'const':
          return this.parseVarDecl();
        case 'if':
          return this.parseIf();
        case 'while':
          return this.parseWhile();
        case 'for':
          return this.parseFor();
        case 'return':
          return this.parseReturn();
        case 'break': {
          const start = this.advance().span.start;
          return { kind: 'BreakStmt', span: this.spanFrom(start) };
        }
        case 'continue': {
          const start = this.advance().span.start;
          return { kind: 'ContinueStmt', span: this.spanFrom(start) };
        }
        case 'fn':
        case 'struct':
        case 'on':
        case 'use':
        case 'module':
          this.error('BUB201', token, { token: token.value });
          this.synchronize();
          return null;
        default:
          break;
      }
    }
    if (this.isOperator('{')) return this.parseBlock();

    const start = token.span.start;
    const expression = this.parseExpression();
    if (this.isOperator('=')) {
      this.advance();
      const value = this.parseExpression();
      if (
        expression.kind !== 'Identifier' &&
        expression.kind !== 'MemberExpr' &&
        expression.kind !== 'IndexExpr'
      ) {
        this.error('BUB205', this.current, {});
      }
      return {
        kind: 'AssignStmt',
        target: expression,
        value,
        span: this.spanFrom(start),
      };
    }
    return { kind: 'ExprStmt', expression, span: this.spanFrom(start) };
  }

  private parseVarDecl(): AST.VarDecl {
    const startToken = this.advance(); // let | const
    const declareKind = startToken.value === 'const' ? 'const' : 'let';
    const nameToken = this.consumeIdentifier('nome da variável');
    let type: AST.TypeRef | null = null;
    if (this.isOperator(':')) {
      this.advance();
      type = this.parseType();
    }
    let initializer: AST.Expression | null = null;
    if (this.isOperator('=')) {
      this.advance();
      initializer = this.parseExpression();
    }
    if (!type && !initializer) {
      this.error('BUB208', this.current, { name: nameToken?.value ?? '?' });
    }
    return {
      kind: 'VarDecl',
      declareKind,
      name: nameToken?.value ?? '<erro>',
      type,
      initializer,
      span: this.spanFrom(startToken.span.start),
    };
  }

  private parseIf(): AST.IfStmt {
    const start = this.advance().span.start; // "if"
    const condition = this.parseExpression();
    const thenBranch = this.parseBlock();
    let elseBranch: AST.BlockStmt | AST.IfStmt | null = null;
    if (this.isKeyword('else')) {
      this.advance();
      elseBranch = this.isKeyword('if') ? this.parseIf() : this.parseBlock();
    }
    return {
      kind: 'IfStmt',
      condition,
      thenBranch,
      elseBranch,
      span: this.spanFrom(start),
    };
  }

  private parseWhile(): AST.WhileStmt {
    const start = this.advance().span.start;
    const condition = this.parseExpression();
    const body = this.parseBlock();
    return { kind: 'WhileStmt', condition, body, span: this.spanFrom(start) };
  }

  private parseFor(): AST.ForStmt {
    const start = this.advance().span.start;
    const item = this.consumeIdentifier('nome do item');
    if (!this.isKeyword('in')) {
      this.error('BUB202', this.current, { expected: 'in', found: this.describe(this.current) });
    } else {
      this.advance();
    }
    const iterable = this.parseExpression();
    const body = this.parseBlock();
    return {
      kind: 'ForStmt',
      itemName: item?.value ?? '<erro>',
      itemNameSpan: item?.span ?? { start, end: start },
      iterable,
      body,
      span: this.spanFrom(start),
    };
  }

  private parseReturn(): AST.ReturnStmt {
    const start = this.advance().span.start;
    const atBlockEnd = this.isOperator('}') || this.atEnd();
    const value = atBlockEnd ? null : this.parseExpression();
    return { kind: 'ReturnStmt', value, span: this.spanFrom(start) };
  }

  // ---------------------------------------------------------------- expressões
  parseExpression(): AST.Expression {
    return this.parseOr();
  }

  private parseOr(): AST.Expression {
    let left = this.parseAnd();
    while (this.isKeyword('or')) {
      const start = left.span.start;
      this.advance();
      const right = this.parseAnd();
      left = { kind: 'BinaryExpr', operator: 'or', left, right, span: this.spanFrom(start) };
    }
    return left;
  }

  private parseAnd(): AST.Expression {
    let left = this.parseEquality();
    while (this.isKeyword('and')) {
      const start = left.span.start;
      this.advance();
      const right = this.parseEquality();
      left = { kind: 'BinaryExpr', operator: 'and', left, right, span: this.spanFrom(start) };
    }
    return left;
  }

  private parseEquality(): AST.Expression {
    let left = this.parseComparison();
    while (this.isOperator('==') || this.isOperator('!=')) {
      const operator = this.advance().value as '==' | '!=';
      const start = left.span.start;
      const right = this.parseComparison();
      left = { kind: 'BinaryExpr', operator, left, right, span: this.spanFrom(start) };
    }
    return left;
  }

  private parseComparison(): AST.Expression {
    let left = this.parseAdditive();
    while (
      this.isOperator('<') ||
      this.isOperator('<=') ||
      this.isOperator('>') ||
      this.isOperator('>=')
    ) {
      const operator = this.advance().value as '<' | '<=' | '>' | '>=';
      const start = left.span.start;
      const right = this.parseAdditive();
      left = { kind: 'BinaryExpr', operator, left, right, span: this.spanFrom(start) };
    }
    return left;
  }

  private parseAdditive(): AST.Expression {
    let left = this.parseMultiplicative();
    while (this.isOperator('+') || this.isOperator('-')) {
      const operator = this.advance().value as '+' | '-';
      const start = left.span.start;
      const right = this.parseMultiplicative();
      left = { kind: 'BinaryExpr', operator, left, right, span: this.spanFrom(start) };
    }
    return left;
  }

  private parseMultiplicative(): AST.Expression {
    let left = this.parseUnary();
    while (this.isOperator('*') || this.isOperator('/') || this.isOperator('%')) {
      const operator = this.advance().value as '*' | '/' | '%';
      const start = left.span.start;
      const right = this.parseUnary();
      left = { kind: 'BinaryExpr', operator, left, right, span: this.spanFrom(start) };
    }
    return left;
  }

  private parseUnary(): AST.Expression {
    if (this.isOperator('-') || this.isOperator('!') || this.isKeyword('not')) {
      const token = this.advance();
      const start = token.span.start;
      const operand = this.parseUnary();
      const operator = token.value === '!' ? 'not' : (token.value as '-' | 'not');
      return { kind: 'UnaryExpr', operator, operand, span: this.spanFrom(start) };
    }
    return this.parsePostfix();
  }

  private parsePostfix(): AST.Expression {
    let expression = this.parsePrimary();
    for (;;) {
      if (this.isOperator('.')) {
        const start = expression.span.start;
        this.advance();
        const member = this.current;
        if (member.kind === 'identifier' || member.kind === 'keyword' || member.kind === 'type') {
          this.advance();
          expression = {
            kind: 'MemberExpr',
            object: expression,
            member: member.value,
            memberSpan: member.span,
            span: this.spanFrom(start),
          };
          continue;
        }
        this.error('BUB202', member, { expected: 'membro', found: this.describe(member) });
        break;
      }
      if (this.isOperator('[')) {
        const start = expression.span.start;
        this.advance();
        const index = this.parseExpression();
        this.consumeOperator(']');
        expression = { kind: 'IndexExpr', object: expression, index, span: this.spanFrom(start) };
        continue;
      }
      if (this.isOperator('(')) {
        const start = expression.span.start;
        this.advance();
        const args: AST.Expression[] = [];
        while (!this.atEnd() && !this.isOperator(')')) {
          args.push(this.parseExpression());
          if (this.isOperator(',')) this.advance();
          else break;
        }
        this.consumeOperator(')');
        expression = { kind: 'CallExpr', callee: expression, args, span: this.spanFrom(start) };
        continue;
      }
      break;
    }
    return expression;
  }

  private parsePrimary(): AST.Expression {
    const token = this.current;

    if (token.kind === 'number') {
      this.advance();
      return {
        kind: 'NumberLiteral',
        value: Number(token.literal ?? 0),
        raw: token.value,
        span: token.span,
      };
    }
    if (token.kind === 'text') {
      this.advance();
      return { kind: 'TextLiteral', value: String(token.literal ?? ''), span: token.span };
    }
    if (token.kind === 'keyword' && (token.value === 'true' || token.value === 'false')) {
      this.advance();
      return { kind: 'BoolLiteral', value: token.value === 'true', span: token.span };
    }
    if (token.kind === 'identifier' || token.kind === 'type') {
      this.advance();
      return { kind: 'Identifier', name: token.value, span: token.span };
    }
    if (token.kind === 'operator' && token.value === '(') {
      this.advance();
      const inner = this.parseExpression();
      this.consumeOperator(')');
      return inner;
    }
    if (token.kind === 'operator' && token.value === '[') {
      const start = token.span.start;
      this.advance();
      const elements: AST.Expression[] = [];
      while (!this.atEnd() && !this.isOperator(']')) {
        elements.push(this.parseExpression());
        if (this.isOperator(',')) this.advance();
        else break;
      }
      this.consumeOperator(']');
      return { kind: 'ListLiteral', elements, span: this.spanFrom(start) };
    }

    this.error('BUB201', token, { token: this.describe(token) });
    this.advance();
    return { kind: 'TextLiteral', value: '', span: token.span };
  }
}

/** Parseia uma lista de tokens já produzida pelo lexer. */
export function parseTokens(tokens: Token[], file?: string): ParseResult {
  const parser = new Parser(tokens, file);
  const program = parser.parseProgram();
  return { program, diagnostics: parser.diagnostics };
}

/** Lexa e parseia um arquivo Bubble. */
export function parse(source: string, file?: string): ParseResult {
  const lexed = lex(source, file);
  const parsed = parseTokens(lexed.tokens, file);
  return {
    program: parsed.program,
    diagnostics: [...lexed.diagnostics, ...parsed.diagnostics],
  };
}
