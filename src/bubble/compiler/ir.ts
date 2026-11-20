/**
 * IR — representação intermediária do Bubble.
 *
 * A IR é gerada SOMENTE a partir de uma AST validada (sem erros) e já carrega
 * os tipos resolvidos. Ela é o artefato que um futuro Bubble Executor poderá
 * carregar; nada aqui é JavaScript nem depende do navegador.
 *
 * Formato: `bubble-ir` versão 0.1 (estruturada e tipada). Operações:
 *  - constantes, variáveis, listas, chamadas, membros e índices;
 *  - controle de fluxo estruturado (if, while, for, return, break, continue).
 */

import type { ModuleModel } from './semantic';
import { LANGUAGE_VERSION } from '../language/spec';
import { typeToString, type BubbleType } from './types';

export interface IrExpr {
  op: string;
  type: string;
  [key: string]: unknown;
}

export interface IrStmt {
  op: string;
  [key: string]: unknown;
}

export interface IrModule {
  format: 'bubble-ir';
  version: string;
  module: string;
  file: string;
  uses: string[];
  structs: { name: string; fields: { name: string; type: string }[] }[];
  globals: { name: string; type: string; mutable: boolean; value: IrExpr | null }[];
  functions: { name: string; params: { name: string; type: string }[]; returns: string; body: IrStmt[] }[];
  events: { event: string; body: IrStmt[] }[];
  stats: { constantFolds: number };
}

export interface IrBuildResult {
  module: IrModule;
  constantFolds: number;
}

function typeName(type: BubbleType | undefined): string {
  return type ? typeToString(type) : 'any';
}

export function buildIr(
  model: ModuleModel,
  expressionTypes: WeakMap<object, BubbleType>,
): IrBuildResult {
  let constantFolds = 0;

  // A AST é percorrida de forma dinâmica: cada nó traz `kind` e `span`.
  const expr = (node: any): IrExpr => {
    const type = typeName(expressionTypes.get(node));
    switch (node.kind) {
      case 'NumberLiteral':
        return { op: 'num', type, value: node.value };
      case 'TextLiteral':
        return { op: 'text', type, value: node.value };
      case 'BoolLiteral':
        return { op: 'bool', type, value: node.value };
      case 'ListLiteral':
        return { op: 'list', type, elements: node.elements.map(expr) };
      case 'Identifier':
        return { op: 'var', type, name: node.name };
      case 'UnaryExpr': {
        const operand = expr(node.operand);
        if (node.operator === '-' && operand.op === 'num') {
          constantFolds += 1;
          return { op: 'num', type, value: -(operand.value as number) };
        }
        if (node.operator === 'not' && operand.op === 'bool') {
          constantFolds += 1;
          return { op: 'bool', type, value: !(operand.value as boolean) };
        }
        return { op: 'unary', type, operator: node.operator, operand };
      }
      case 'BinaryExpr': {
        const left = expr(node.left);
        const right = expr(node.right);
        if (left.op === 'num' && right.op === 'num') {
          const folded = foldNumeric(node.operator, left.value as number, right.value as number);
          if (folded !== null) {
            constantFolds += 1;
            return { op: 'num', type, value: folded };
          }
        }
        if (left.op === 'text' && right.op === 'text' && node.operator === '+') {
          constantFolds += 1;
          return { op: 'text', type, value: `${left.value}${right.value}` };
        }
        return { op: 'binary', type, operator: node.operator, left, right };
      }
      case 'CallExpr':
        return {
          op: 'call',
          type,
          name: node.callee.kind === 'Identifier' ? node.callee.name : '<dinâmico>',
          args: node.args.map(expr),
        };
      case 'MemberExpr':
        return { op: 'member', type, object: expr(node.object), field: node.member };
      case 'IndexExpr':
        return { op: 'index', type, object: expr(node.object), index: expr(node.index) };
      default:
        return { op: 'any', type: 'any' };
    }
  };

  const foldNumeric = (operator: string, left: number, right: number): number | null => {
    switch (operator) {
      case '+':
        return left + right;
      case '-':
        return left - right;
      case '*':
        return left * right;
      case '/':
        return right === 0 ? null : left / right;
      case '%':
        return right === 0 ? null : left % right;
      default:
        return null;
    }
  };

  const statement = (node: any): IrStmt => {
    switch (node.kind) {
      case 'VarDecl':
        return {
          op: 'let',
          name: node.name,
          type: typeName(model.declarations.get(node)?.type ?? undefined),
          mutable: node.declareKind !== 'const',
          value: node.initializer ? expr(node.initializer) : null,
        };
      case 'AssignStmt':
        return { op: 'assign', target: expr(node.target), value: expr(node.value) };
      case 'IfStmt':
        return {
          op: 'if',
          condition: expr(node.condition),
          then: block(node.thenBranch),
          else:
            node.elseBranch === null
              ? null
              : node.elseBranch.kind === 'IfStmt'
                ? [statement(node.elseBranch)]
                : block(node.elseBranch),
        };
      case 'WhileStmt':
        return { op: 'while', condition: expr(node.condition), body: block(node.body) };
      case 'ForStmt':
        return {
          op: 'for',
          item: node.itemName,
          itemType: typeName(model.declarations.get(node)?.type ?? undefined),
          iterable: expr(node.iterable),
          body: block(node.body),
        };
      case 'ReturnStmt':
        return { op: 'return', value: node.value ? expr(node.value) : null };
      case 'BreakStmt':
        return { op: 'break' };
      case 'ContinueStmt':
        return { op: 'continue' };
      case 'ExprStmt':
        return { op: 'expr', value: expr(node.expression) };
      case 'BlockStmt':
        return { op: 'block', body: block(node) };
      default:
        return { op: 'nop' };
    }
  };

  const block = (node: any): IrStmt[] => (node.statements as any[]).map(statement);

  const ir: IrModule = {
    format: 'bubble-ir',
    version: LANGUAGE_VERSION,
    module: model.moduleName ?? 'main',
    file: model.file,
    uses: model.uses.map((use) => use.path),
    structs: [...model.structs.values()]
      .filter((struct) => !struct.builtin)
      .map((struct) => ({
        name: struct.name,
        fields: [...struct.fields.entries()].map(([name, field]) => ({
          name,
          type: typeToString(field.type),
        })),
      })),
    globals: model.program.items
      .filter((item) => item.kind === 'VarDecl')
      .map((item) => {
        const symbol = model.declarations.get(item);
        return {
          name: item.name,
          type: typeName(symbol?.type ?? undefined),
          mutable: item.declareKind !== 'const',
          value: item.initializer ? expr(item.initializer) : null,
        };
      }),
    functions: model.program.items
      .filter((item) => item.kind === 'FunctionDecl')
      .map((item) => {
        const info = model.functions.get(item.name);
        return {
          name: item.name,
          params: (info?.params ?? []).map((param) => ({
            name: param.name,
            type: typeToString(param.type),
          })),
          returns: typeToString(info?.returnType ?? { kind: 'primitive', name: 'void' }),
          body: block(item.body),
        };
      }),
    events: model.program.items
      .filter((item) => item.kind === 'EventDecl')
      .map((item) => ({ event: item.event, body: block(item.body) })),
    stats: { constantFolds: 0 },
  };

  ir.stats.constantFolds = constantFolds;
  return { module: ir, constantFolds };
}
