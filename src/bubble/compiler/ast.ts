/**
 * AST da linguagem Bubble (núcleo provisório 0.1).
 *
 * Cada nó carrega o `span` (linha/coluna) de origem para que todo diagnóstico
 * aponte o trecho exato do arquivo. A AST é independente do compilador: ela é
 * consumida pela análise semântica, pela verificação de tipos e pelo gerador
 * de IR.
 */

import type { Span } from './diagnostics';

export interface NodeBase {
  span: Span;
}

export type TypeRef =
  | { kind: 'named'; name: string; span: Span }
  | { kind: 'list'; element: TypeRef; span: Span };

export interface ModuleDecl extends NodeBase {
  kind: 'ModuleDecl';
  name: string;
}

export interface UseDecl extends NodeBase {
  kind: 'UseDecl';
  path: string;
}

export interface StructField extends NodeBase {
  kind: 'StructField';
  name: string;
  type: TypeRef;
}

export interface StructDecl extends NodeBase {
  kind: 'StructDecl';
  name: string;
  fields: StructField[];
}

export interface Parameter extends NodeBase {
  kind: 'Parameter';
  name: string;
  type: TypeRef;
}

export interface FunctionDecl extends NodeBase {
  kind: 'FunctionDecl';
  name: string;
  params: Parameter[];
  returnType: TypeRef | null;
  body: BlockStmt;
}

export interface EventDecl extends NodeBase {
  kind: 'EventDecl';
  event: string;
  body: BlockStmt;
}

export interface VarDecl extends NodeBase {
  kind: 'VarDecl';
  declareKind: 'let' | 'const';
  name: string;
  type: TypeRef | null;
  initializer: Expression | null;
}

export interface BlockStmt extends NodeBase {
  kind: 'BlockStmt';
  statements: Statement[];
}

export interface IfStmt extends NodeBase {
  kind: 'IfStmt';
  condition: Expression;
  thenBranch: BlockStmt;
  elseBranch: BlockStmt | IfStmt | null;
}

export interface WhileStmt extends NodeBase {
  kind: 'WhileStmt';
  condition: Expression;
  body: BlockStmt;
}

export interface ForStmt extends NodeBase {
  kind: 'ForStmt';
  itemName: string;
  itemNameSpan: Span;
  iterable: Expression;
  body: BlockStmt;
}

export interface ReturnStmt extends NodeBase {
  kind: 'ReturnStmt';
  value: Expression | null;
}

export interface BreakStmt extends NodeBase {
  kind: 'BreakStmt';
}

export interface ContinueStmt extends NodeBase {
  kind: 'ContinueStmt';
}

export interface AssignStmt extends NodeBase {
  kind: 'AssignStmt';
  target: Expression;
  value: Expression;
}

export interface ExprStmt extends NodeBase {
  kind: 'ExprStmt';
  expression: Expression;
}

export type Statement =
  | VarDecl
  | IfStmt
  | WhileStmt
  | ForStmt
  | ReturnStmt
  | BreakStmt
  | ContinueStmt
  | AssignStmt
  | ExprStmt
  | BlockStmt;

export type Item = StructDecl | FunctionDecl | EventDecl | VarDecl;

export interface NumberLiteral extends NodeBase {
  kind: 'NumberLiteral';
  value: number;
  raw: string;
}

export interface TextLiteral extends NodeBase {
  kind: 'TextLiteral';
  value: string;
}

export interface BoolLiteral extends NodeBase {
  kind: 'BoolLiteral';
  value: boolean;
}

export interface ListLiteral extends NodeBase {
  kind: 'ListLiteral';
  elements: Expression[];
}

export interface Identifier extends NodeBase {
  kind: 'Identifier';
  name: string;
}

export interface UnaryExpr extends NodeBase {
  kind: 'UnaryExpr';
  operator: '-' | 'not' | '!';
  operand: Expression;
}

export interface BinaryExpr extends NodeBase {
  kind: 'BinaryExpr';
  operator: '+' | '-' | '*' | '/' | '%' | '==' | '!=' | '<' | '<=' | '>' | '>=' | 'and' | 'or';
  left: Expression;
  right: Expression;
}

export interface CallExpr extends NodeBase {
  kind: 'CallExpr';
  callee: Expression;
  args: Expression[];
}

export interface MemberExpr extends NodeBase {
  kind: 'MemberExpr';
  object: Expression;
  member: string;
  memberSpan: Span;
}

export interface IndexExpr extends NodeBase {
  kind: 'IndexExpr';
  object: Expression;
  index: Expression;
}

export type Expression =
  | NumberLiteral
  | TextLiteral
  | BoolLiteral
  | ListLiteral
  | Identifier
  | UnaryExpr
  | BinaryExpr
  | CallExpr
  | MemberExpr
  | IndexExpr;

export interface Program extends NodeBase {
  kind: 'Program';
  module: ModuleDecl | null;
  uses: UseDecl[];
  items: Item[];
}

/** Percorre todos os filhos diretos de um nó (útil em testes e ferramentas). */
export function childNodes(node: { kind: string } & Record<string, unknown>): unknown[] {
  switch (node.kind) {
    case 'Program':
      return [
        ...(node.module ? [node.module] : []),
        ...(node.uses as unknown[]),
        ...(node.items as unknown[]),
      ];
    case 'FunctionDecl':
      return [...(node.params as unknown[]), node.body];
    case 'BlockStmt':
      return node.statements as unknown[];
    case 'IfStmt':
      return [node.condition, node.thenBranch, ...(node.elseBranch ? [node.elseBranch] : [])];
    case 'WhileStmt':
      return [node.condition, node.body];
    case 'ForStmt':
      return [node.iterable, node.body];
    case 'ReturnStmt':
      return node.value ? [node.value] : [];
    case 'AssignStmt':
      return [node.target, node.value];
    case 'ExprStmt':
      return [node.expression];
    case 'VarDecl':
      return node.initializer ? [node.initializer] : [];
    case 'ListLiteral':
      return node.elements as unknown[];
    case 'UnaryExpr':
      return [node.operand];
    case 'BinaryExpr':
      return [node.left, node.right];
    case 'CallExpr':
      return [node.callee, ...(node.args as unknown[])];
    case 'MemberExpr':
      return [node.object];
    case 'IndexExpr':
      return [node.object, node.index];
    case 'EventDecl':
      return [node.body];
    default:
      return [];
  }
}
