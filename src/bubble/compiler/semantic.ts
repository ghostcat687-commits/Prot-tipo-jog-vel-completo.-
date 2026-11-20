/**
 * ANÁLISE SEMÂNTICA da linguagem Bubble.
 *
 * Primeira passada sobre a AST:
 *  - registra structs, funções, eventos e globais do módulo;
 *  - valida tipos declarados, nomes duplicados e nomes reservados;
 *  - resolve cada identificador usado no corpo para o símbolo declarado;
 *  - verifica regras estruturais (break/continue dentro de laço, return dentro
 *    de função, atribuição a constante, eventos conhecidos).
 *
 * A verificação de tipos é uma etapa separada (`typecheck.ts`), executada
 * depois que os nomes já foram resolvidos.
 */

import type * as AST from './ast';
import { makeDiagnostic, type Diagnostic, type Span } from './diagnostics';
import {
  BUILTIN_FUNCTIONS,
  BUILTIN_STRUCTS,
  EVENT_NAMES,
} from '../language/spec';
import {
  type BubbleType,
  ANY,
  VOID,
  parseTypeString,
  resolveTypeRef,
} from './types';

export type SymbolKind = 'variable' | 'const' | 'param' | 'loopItem' | 'function' | 'builtin' | 'struct';

export interface SymbolInfo {
  name: string;
  kind: SymbolKind;
  /** Tipo conhecido; `null` enquanto a inferência não rodou. */
  type: BubbleType | null;
  mutable: boolean;
  span: Span;
  /** Presente quando o símbolo é uma função/builtin. */
  functionInfo?: FunctionInfo;
}

export interface FunctionOverload {
  params: BubbleType[];
  returns: BubbleType;
  doc: string;
}

export interface FunctionInfo {
  name: string;
  params: { name: string; type: BubbleType; span: Span }[];
  returnType: BubbleType;
  span: Span;
  builtin: boolean;
  overloads?: FunctionOverload[];
  node?: AST.FunctionDecl;
}

export interface StructInfo {
  name: string;
  fields: Map<string, { type: BubbleType; span: Span }>;
  span: Span;
  builtin: boolean;
}

export interface ModuleModel {
  file: string;
  moduleName: string | null;
  uses: AST.UseDecl[];
  structs: Map<string, StructInfo>;
  functions: Map<string, FunctionInfo>;
  events: Map<string, AST.EventDecl>;
  globals: Map<string, SymbolInfo>;
  /** Identificador da AST → símbolo declarado. */
  resolutions: WeakMap<object, SymbolInfo>;
  /** Declaração (VarDecl/ForStmt) → símbolo criado para ela. */
  declarations: WeakMap<object, SymbolInfo>;
  program: AST.Program;
}

export interface SemanticResult {
  model: ModuleModel;
  diagnostics: Diagnostic[];
}

class Scope {
  private readonly symbols = new Map<string, SymbolInfo>();

  constructor(readonly parent: Scope | null = null) {}

  declare(symbol: SymbolInfo): SymbolInfo | null {
    const existing = this.symbols.get(symbol.name);
    if (existing) return existing;
    this.symbols.set(symbol.name, symbol);
    return null;
  }

  lookup(name: string): SymbolInfo | null {
    const own = this.symbols.get(name);
    if (own) return own;
    return this.parent ? this.parent.lookup(name) : null;
  }
}

export function analyzeModule(
  program: AST.Program,
  file: string,
  availableModules: Set<string> = new Set(),
): SemanticResult {
  const diagnostics: Diagnostic[] = [];
  const resolutions = new WeakMap<object, SymbolInfo>();
  const declarations = new WeakMap<object, SymbolInfo>();
  const structs = new Map<string, StructInfo>();
  const functions = new Map<string, FunctionInfo>();
  const events = new Map<string, AST.EventDecl>();
  const globals = new Map<string, SymbolInfo>();

  const report = (
    code: string,
    span: Span,
    params?: Record<string, string | number>,
    severity: 'error' | 'warning' = 'error',
  ): void => {
    diagnostics.push(makeDiagnostic(code, severity, span, params, file));
  };

  // ------------------------------------------------------------ structs nativas
  for (const [name, definition] of Object.entries(BUILTIN_STRUCTS)) {
    const fields = new Map<string, { type: BubbleType; span: Span }>();
    for (const [field, fieldType] of Object.entries(definition.fields)) {
      fields.set(field, { type: parseTypeString(fieldType), span: program.span });
    }
    structs.set(name, { name, fields, span: program.span, builtin: true });
  }

  // ------------------------------------------------------------ funções nativas
  for (const builtin of BUILTIN_FUNCTIONS) {
    functions.set(builtin.name, {
      name: builtin.name,
      params: [],
      returnType: VOID,
      span: program.span,
      builtin: true,
      overloads: builtin.overloads.map((overload) => ({
        params: overload.params.map(parseTypeString),
        returns: parseTypeString(overload.returns),
        doc: overload.doc,
      })),
    });
  }

  // ------------------------------------------------------------ módulo e uses
  if (!program.module) {
    report('BUB311', program.span, {}, 'warning');
  }

  for (const use of program.uses) {
    if (!availableModules.has(use.path)) {
      report('BUB309', use.span, { module: use.path });
    }
  }

  // ------------------------------------------------------------ structs
  for (const item of program.items) {
    if (item.kind !== 'StructDecl') continue;
    if (structs.has(item.name)) {
      report('BUB302', item.span, { name: item.name, kind: 'struct' });
      continue;
    }
    const fields = new Map<string, { type: BubbleType; span: Span }>();
    for (const field of item.fields) {
      if (fields.has(field.name)) {
        report('BUB313', field.span, { name: field.name, struct: item.name });
        continue;
      }
      const type = resolveTypeRef(field.type, structs);
      if (!type) {
        report('BUB410', field.type.span, { name: field.name });
        continue;
      }
      fields.set(field.name, { type, span: field.span });
    }
    structs.set(item.name, { name: item.name, fields, span: item.span, builtin: false });
  }

  // ------------------------------------------------------------ assinaturas
  for (const item of program.items) {
    if (item.kind !== 'FunctionDecl') continue;
    if (functions.has(item.name)) {
      const existing = functions.get(item.name)!;
      report(existing.builtin ? 'BUB316' : 'BUB302', item.span, {
        name: item.name,
        kind: existing.builtin ? 'biblioteca padrão' : 'função',
      });
      continue;
    }
    const params: FunctionInfo['params'] = [];
    const seen = new Set<string>();
    for (const param of item.params) {
      if (seen.has(param.name)) {
        report('BUB302', param.span, { name: param.name, kind: 'parâmetro' });
        continue;
      }
      seen.add(param.name);
      const type = resolveTypeRef(param.type, structs);
      if (!type) {
        report('BUB410', param.type.span, { name: param.name });
        continue;
      }
      params.push({ name: param.name, type, span: param.span });
    }
    let returnType: BubbleType = VOID;
    if (item.returnType) {
      const resolved = resolveTypeRef(item.returnType, structs);
      if (resolved) returnType = resolved;
      else report('BUB410', item.returnType.span, { name: 'retorno' });
    }
    functions.set(item.name, {
      name: item.name,
      params,
      returnType,
      span: item.span,
      builtin: false,
      node: item,
    });
  }

  // ------------------------------------------------------------ eventos
  for (const item of program.items) {
    if (item.kind !== 'EventDecl') continue;
    if (!EVENT_NAMES.includes(item.event)) {
      report('BUB307', item.span, { event: item.event });
      continue;
    }
    if (events.has(item.event)) {
      report('BUB308', item.span, { event: item.event });
      continue;
    }
    events.set(item.event, item);
  }

  // ------------------------------------------------------------ globais
  for (const item of program.items) {
    if (item.kind !== 'VarDecl') continue;
    if (globals.has(item.name)) {
      report('BUB302', item.span, { name: item.name, kind: 'variável global' });
      continue;
    }
    let type: BubbleType | null = null;
    if (item.type) {
      type = resolveTypeRef(item.type, structs);
      if (!type) report('BUB410', item.type.span, { name: item.name });
    }
    const symbol: SymbolInfo = {
      name: item.name,
      kind: item.declareKind === 'const' ? 'const' : 'variable',
      type,
      mutable: item.declareKind !== 'const',
      span: item.span,
    };
    globals.set(item.name, symbol);
    declarations.set(item, symbol);
  }

  // ------------------------------------------------------------ corpos
  const rootScope = new Scope(null);
  for (const symbol of globals.values()) rootScope.declare(symbol);
  for (const info of functions.values()) {
    rootScope.declare({
      name: info.name,
      kind: info.builtin ? 'builtin' : 'function',
      type: null,
      mutable: false,
      span: info.span,
      functionInfo: info,
    });
  }

  const state = { loopDepth: 0, functionDepth: 0 };

  const resolveIdentifier = (node: AST.Identifier, scope: Scope): void => {
    const symbol = scope.lookup(node.name);
    if (!symbol) {
      report('BUB301', node.span, { name: node.name });
      return;
    }
    resolutions.set(node, symbol);
  };

  const resolveExpression = (expression: AST.Expression, scope: Scope): void => {
    switch (expression.kind) {
      case 'Identifier':
        resolveIdentifier(expression, scope);
        return;
      case 'ListLiteral':
        expression.elements.forEach((element) => resolveExpression(element, scope));
        return;
      case 'UnaryExpr':
        resolveExpression(expression.operand, scope);
        return;
      case 'BinaryExpr':
        resolveExpression(expression.left, scope);
        resolveExpression(expression.right, scope);
        return;
      case 'CallExpr':
        resolveExpression(expression.callee, scope);
        expression.args.forEach((arg) => resolveExpression(arg, scope));
        return;
      case 'MemberExpr':
        resolveExpression(expression.object, scope);
        return;
      case 'IndexExpr':
        resolveExpression(expression.object, scope);
        resolveExpression(expression.index, scope);
        return;
      default:
        return;
    }
  };

  const resolveBlock = (block: AST.BlockStmt, scope: Scope): void => {
    const inner = new Scope(scope);
    block.statements.forEach((statement) => resolveStatement(statement, inner));
  };

  const resolveStatement = (statement: AST.Statement, scope: Scope): void => {
    switch (statement.kind) {
      case 'VarDecl': {
        if (statement.initializer) resolveExpression(statement.initializer, scope);
        const symbol: SymbolInfo = {
          name: statement.name,
          kind: statement.declareKind === 'const' ? 'const' : 'variable',
          type: statement.type ? resolveTypeRef(statement.type, structs) : null,
          mutable: statement.declareKind !== 'const',
          span: statement.span,
        };
        if (statement.type && !symbol.type) {
          report('BUB410', statement.type.span, { name: statement.name });
        }
        declarations.set(statement, symbol);
        const duplicate = scope.declare(symbol);
        if (duplicate) {
          report('BUB302', statement.span, { name: statement.name, kind: 'variável' });
        }
        return;
      }
      case 'IfStmt':
        resolveExpression(statement.condition, scope);
        resolveBlock(statement.thenBranch, scope);
        if (statement.elseBranch) {
          if (statement.elseBranch.kind === 'IfStmt') resolveStatement(statement.elseBranch, scope);
          else resolveBlock(statement.elseBranch, scope);
        }
        return;
      case 'WhileStmt':
        resolveExpression(statement.condition, scope);
        state.loopDepth += 1;
        resolveBlock(statement.body, scope);
        state.loopDepth -= 1;
        return;
      case 'ForStmt': {
        resolveExpression(statement.iterable, scope);
        const inner = new Scope(scope);
        const itemSymbol: SymbolInfo = {
          name: statement.itemName,
          kind: 'loopItem',
          type: ANY, // preenchido pela verificação de tipos
          mutable: false,
          span: statement.itemNameSpan,
        };
        declarations.set(statement, itemSymbol);
        inner.declare(itemSymbol);
        state.loopDepth += 1;
        resolveBlock(statement.body, inner);
        state.loopDepth -= 1;
        return;
      }
      case 'ReturnStmt':
        if (state.functionDepth === 0) report('BUB306', statement.span);
        if (statement.value) resolveExpression(statement.value, scope);
        return;
      case 'BreakStmt':
        if (state.loopDepth === 0) report('BUB304', statement.span);
        return;
      case 'ContinueStmt':
        if (state.loopDepth === 0) report('BUB305', statement.span);
        return;
      case 'AssignStmt': {
        resolveExpression(statement.value, scope);
        if (statement.target.kind === 'Identifier') {
          const symbol = scope.lookup(statement.target.name);
          if (!symbol) {
            report('BUB301', statement.target.span, { name: statement.target.name });
          } else {
            resolutions.set(statement.target, symbol);
            if (!symbol.mutable) report('BUB303', statement.target.span, { name: statement.target.name });
          }
        } else {
          resolveExpression(statement.target, scope);
        }
        return;
      }
      case 'ExprStmt':
        resolveExpression(statement.expression, scope);
        return;
      case 'BlockStmt':
        resolveBlock(statement, scope);
        return;
      default:
        return;
    }
  };

  for (const item of program.items) {
    if (item.kind === 'VarDecl') {
      if (item.initializer) resolveExpression(item.initializer, rootScope);
      continue;
    }
    if (item.kind === 'FunctionDecl') {
      const inner = new Scope(rootScope);
      item.params.forEach((param) => {
        const type = resolveTypeRef(param.type, structs) ?? ANY;
        inner.declare({
          name: param.name,
          kind: 'param',
          type,
          mutable: true,
          span: param.span,
        });
      });
      state.functionDepth += 1;
      resolveBlock(item.body, inner);
      state.functionDepth -= 1;
      continue;
    }
    if (item.kind === 'EventDecl') {
      state.functionDepth += 1;
      resolveBlock(item.body, new Scope(rootScope));
      state.functionDepth -= 1;
    }
  }

  const model: ModuleModel = {
    file,
    moduleName: program.module?.name ?? null,
    uses: program.uses,
    structs,
    functions,
    events,
    globals,
    resolutions,
    declarations,
    program,
  };

  return { model, diagnostics };
}
