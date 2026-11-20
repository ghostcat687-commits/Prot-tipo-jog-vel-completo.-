/**
 * VERIFICAÇÃO DE TIPOS da linguagem Bubble.
 *
 * Segunda passada: usa os nomes já resolvidos pela análise semântica e
 * calcula o tipo de cada expressão, apontando incompatibilidades antes de
 * qualquer execução. Nenhum valor é inventado: quando um tipo é desconhecido o
 * checker reporta e segue com `any`, para não gerar erros em cascata.
 */

import type * as AST from './ast';
import { makeDiagnostic, type Diagnostic } from './diagnostics';
import type { FunctionInfo, ModuleModel, SymbolInfo } from './semantic';
import {
  type BubbleType,
  ANY,
  BOOL,
  NUM,
  TEXT,
  VOID,
  isAny,
  isAssignable,
  isBool,
  isNumeric,
  isText,
  isVoid,
  listOf,
  typeToString,
} from './types';

export interface TypecheckResult {
  diagnostics: Diagnostic[];
  expressionTypes: WeakMap<object, BubbleType>;
}

const NUMERIC_OPERATORS = new Set(['-', '*', '/', '%']);
const COMPARISON_OPERATORS = new Set(['<', '<=', '>', '>=']);

export function typecheckModule(model: ModuleModel): TypecheckResult {
  const diagnostics: Diagnostic[] = [];
  const expressionTypes = new WeakMap<object, BubbleType>();
  const report = (
    code: string,
    span: AST.NodeBase['span'],
    params?: Record<string, string | number>,
    severity: 'error' | 'warning' = 'error',
  ): void => {
    diagnostics.push(makeDiagnostic(code, severity, span, params, model.file));
  };

  const symbolOf = (node: AST.Identifier): SymbolInfo | null =>
    model.resolutions.get(node) ?? null;

  const setType = (node: AST.Expression, type: BubbleType): BubbleType => {
    expressionTypes.set(node, type);
    return type;
  };

  // -------------------------------------------------------------- chamadas
  const checkCall = (node: AST.CallExpr): BubbleType => {
    if (node.callee.kind !== 'Identifier') {
      node.args.forEach((arg) => typeOf(arg));
      if (node.callee.kind === 'MemberExpr') report('BUB413', node.callee.span);
      else typeOf(node.callee);
      return ANY;
    }
    const symbol = symbolOf(node.callee);
    const info = symbol?.functionInfo;
    if (!info) {
      // Nome inexistente já foi reportado pela análise semântica.
      if (symbol) {
        report('BUB415', node.callee.span, {
          name: node.callee.name,
          type: typeToString(symbol.type ?? ANY),
        });
      }
      node.args.forEach((arg) => typeOf(arg));
      return ANY;
    }
    const argTypes = node.args.map((arg) => typeOf(arg));
    argTypes.forEach((type, index) => {
      if (isVoid(type)) report('BUB411', node.args[index].span, { name: info.name });
    });

    if (info.builtin && info.overloads) {
      const byArity = info.overloads.filter((overload) => overload.params.length === argTypes.length);
      if (byArity.length === 0) {
        report('BUB402', node.span, {
          name: info.name,
          expected: String(info.overloads[0]?.params.length ?? 0),
          actual: String(argTypes.length),
        });
        return ANY;
      }
      const matching = byArity.find((overload) =>
        overload.params.every((param, index) => isAssignable(argTypes[index], param)),
      );
      if (!matching) {
        const index = byArity[0].params.findIndex(
          (param, position) => !isAssignable(argTypes[position], param),
        );
        if (index >= 0) {
          report('BUB403', node.args[index].span, {
            name: info.name,
            index: String(index + 1),
            expected: typeToString(byArity[0].params[index]),
            actual: typeToString(argTypes[index]),
          });
        }
        return byArity[0].returns;
      }
      return matching.returns;
    }

    if (argTypes.length !== info.params.length) {
      report('BUB402', node.span, {
        name: info.name,
        expected: String(info.params.length),
        actual: String(argTypes.length),
      });
      return info.returnType;
    }
    info.params.forEach((param, index) => {
      if (!isAssignable(argTypes[index], param.type)) {
        report('BUB403', node.args[index].span, {
          name: info.name,
          index: String(index + 1),
          expected: typeToString(param.type),
          actual: typeToString(argTypes[index]),
        });
      }
    });
    return info.returnType;
  };

  // -------------------------------------------------------------- expressões
  const typeOf = (node: AST.Expression): BubbleType => {
    switch (node.kind) {
      case 'NumberLiteral':
        return setType(node, NUM);
      case 'TextLiteral':
        return setType(node, TEXT);
      case 'BoolLiteral':
        return setType(node, BOOL);
      case 'ListLiteral': {
        if (node.elements.length === 0) return setType(node, listOf(ANY));
        const elementTypes = node.elements.map((element) => typeOf(element));
        let unified = elementTypes[0];
        for (const type of elementTypes.slice(1)) {
          if (isAny(unified)) {
            unified = type;
          } else if (!isAny(type) && !isAssignable(type, unified) && !isAssignable(unified, type)) {
            report('BUB417', node.span, {
              first: typeToString(unified),
              second: typeToString(type),
            });
            unified = ANY;
            break;
          }
        }
        return setType(node, listOf(unified));
      }
      case 'Identifier': {
        const symbol = symbolOf(node);
        if (!symbol) return setType(node, ANY);
        if (symbol.kind === 'function' || symbol.kind === 'builtin') {
          report('BUB418', node.span, { name: node.name });
          return setType(node, ANY);
        }
        return setType(node, symbol.type ?? ANY);
      }
      case 'UnaryExpr': {
        const operand = typeOf(node.operand);
        if (node.operator === '-') {
          if (!isNumeric(operand) && !isAny(operand)) {
            report('BUB405', node.span, { operator: '-', left: typeToString(operand), right: '-' });
          }
          return setType(node, NUM);
        }
        if (!isBool(operand) && !isAny(operand)) {
          report('BUB405', node.span, { operator: 'not', left: typeToString(operand), right: '-' });
        }
        return setType(node, BOOL);
      }
      case 'BinaryExpr': {
        const left = typeOf(node.left);
        const right = typeOf(node.right);
        const operator = node.operator;
        const mismatch = (): BubbleType => {
          report('BUB405', node.span, {
            operator,
            left: typeToString(left),
            right: typeToString(right),
          });
          return ANY;
        };
        if (operator === '+' && (isText(left) || isText(right))) {
          if ((isText(left) || isAny(left)) && (isText(right) || isAny(right))) {
            return setType(node, TEXT);
          }
          return setType(node, mismatch());
        }
        if (NUMERIC_OPERATORS.has(operator) || operator === '+') {
          if ((isNumeric(left) || isAny(left)) && (isNumeric(right) || isAny(right))) {
            return setType(node, NUM);
          }
          return setType(node, mismatch());
        }
        if (COMPARISON_OPERATORS.has(operator)) {
          const bothNum = (isNumeric(left) || isAny(left)) && (isNumeric(right) || isAny(right));
          const bothText = isText(left) && isText(right);
          if (!bothNum && !bothText) return setType(node, mismatch());
          return setType(node, BOOL);
        }
        if (operator === '==' || operator === '!=') {
          if (!isAssignable(left, right) && !isAssignable(right, left)) return setType(node, mismatch());
          return setType(node, BOOL);
        }
        if (operator === 'and' || operator === 'or') {
          if ((!isBool(left) && !isAny(left)) || (!isBool(right) && !isAny(right))) {
            return setType(node, mismatch());
          }
          return setType(node, BOOL);
        }
        return setType(node, ANY);
      }
      case 'CallExpr':
        return setType(node, checkCall(node));
      case 'MemberExpr': {
        const object = typeOf(node.object);
        if (object.kind === 'struct') {
          const info = model.structs.get(object.name);
          const field = info?.fields.get(node.member);
          if (!field) {
            report('BUB310', node.memberSpan, { field: node.member, type: object.name });
            return setType(node, ANY);
          }
          return setType(node, field.type);
        }
        if (!isAny(object)) {
          report('BUB416', node.memberSpan, { type: typeToString(object), field: node.member });
        }
        return setType(node, ANY);
      }
      case 'IndexExpr': {
        const object = typeOf(node.object);
        const index = typeOf(node.index);
        if (!isNumeric(index) && !isAny(index)) {
          report('BUB409', node.index.span, { actual: typeToString(index) });
        }
        if (object.kind === 'list') return setType(node, object.element);
        if (!isAny(object)) report('BUB408', node.object.span, { type: typeToString(object) });
        return setType(node, ANY);
      }
      default:
        return ANY;
    }
  };

  // -------------------------------------------------------------- instruções
  const checkVarDecl = (node: AST.VarDecl): void => {
    const annotation = resolveAnnotation(node.type);
    const initializerType = node.initializer ? typeOf(node.initializer) : null;
    if (initializerType && isVoid(initializerType)) {
      report('BUB411', node.initializer!.span, { name: node.name });
    }
    if (!annotation && !initializerType) {
      report('BUB412', node.span, { name: node.name });
      return;
    }
    if (annotation && initializerType && !isAssignable(initializerType, annotation)) {
      report('BUB401', node.initializer!.span, {
        expected: typeToString(annotation),
        actual: typeToString(initializerType),
      });
    }
    const symbol = model.declarations.get(node);
    if (symbol) symbol.type = annotation ?? initializerType ?? ANY;
  };

  const resolveAnnotation = (ref: AST.TypeRef | null): BubbleType | null => {
    if (!ref) return null;
    if (ref.kind === 'list') {
      const element = resolveAnnotation(ref.element);
      return element ? listOf(element) : null;
    }
    if (ref.name === 'num' || ref.name === 'text' || ref.name === 'bool' || ref.name === 'void' || ref.name === 'any') {
      return { kind: 'primitive', name: ref.name };
    }
    if (model.structs.has(ref.name)) return { kind: 'struct', name: ref.name };
    return null;
  };

  const checkStatement = (statement: AST.Statement, returnType: BubbleType): void => {
    switch (statement.kind) {
      case 'VarDecl':
        checkVarDecl(statement);
        return;
      case 'IfStmt': {
        const condition = typeOf(statement.condition);
        if (!isBool(condition) && !isAny(condition)) {
          report('BUB404', statement.condition.span, { actual: typeToString(condition) });
        }
        checkBlock(statement.thenBranch, returnType);
        if (statement.elseBranch) {
          if (statement.elseBranch.kind === 'IfStmt') checkStatement(statement.elseBranch, returnType);
          else checkBlock(statement.elseBranch, returnType);
        }
        return;
      }
      case 'WhileStmt': {
        const condition = typeOf(statement.condition);
        if (!isBool(condition) && !isAny(condition)) {
          report('BUB404', statement.condition.span, { actual: typeToString(condition) });
        }
        checkBlock(statement.body, returnType);
        return;
      }
      case 'ForStmt': {
        const iterable = typeOf(statement.iterable);
        let elementType: BubbleType = ANY;
        if (iterable.kind === 'list') {
          elementType = iterable.element;
        } else if (!isAny(iterable)) {
          report('BUB414', statement.iterable.span, { actual: typeToString(iterable) });
        }
        const itemSymbol = model.declarations.get(statement);
        if (itemSymbol) itemSymbol.type = elementType;
        checkBlock(statement.body, returnType);
        return;
      }
      case 'ReturnStmt': {
        if (isVoid(returnType)) {
          if (statement.value) {
            const actual = typeOf(statement.value);
            report('BUB406', statement.value.span, {
              expected: 'void',
              actual: typeToString(actual),
            });
          }
          return;
        }
        if (!statement.value) {
          report('BUB406', statement.span, { expected: typeToString(returnType), actual: 'void' });
          return;
        }
        const actual = typeOf(statement.value);
        if (!isAssignable(actual, returnType)) {
          report('BUB406', statement.value.span, {
            expected: typeToString(returnType),
            actual: typeToString(actual),
          });
        }
        return;
      }
      case 'AssignStmt': {
        const target = typeOf(statement.target);
        const value = typeOf(statement.value);
        if (isVoid(value)) report('BUB411', statement.value.span, { name: 'atribuição' });
        if (!isAssignable(value, target)) {
          report('BUB401', statement.value.span, {
            expected: typeToString(target),
            actual: typeToString(value),
          });
        }
        return;
      }
      case 'ExprStmt': {
        const type = typeOf(statement.expression);
        if (statement.expression.kind !== 'CallExpr' && !isAny(type)) {
          report('BUB419', statement.span, { type: typeToString(type) }, 'warning');
        }
        return;
      }
      case 'BlockStmt':
        checkBlock(statement, returnType);
        return;
      default:
        return;
    }
  };

  const checkBlock = (block: AST.BlockStmt, returnType: BubbleType): void => {
    block.statements.forEach((statement) => checkStatement(statement, returnType));
  };

  const alwaysReturns = (statement: AST.Statement): boolean => {
    switch (statement.kind) {
      case 'ReturnStmt':
        return true;
      case 'BlockStmt':
        return statement.statements.some(alwaysReturns);
      case 'IfStmt':
        return (
          statement.elseBranch !== null &&
          alwaysReturns(statement.thenBranch) &&
          alwaysReturns(statement.elseBranch)
        );
      default:
        return false;
    }
  };

  // -------------------------------------------------------------- módulo
  for (const item of model.program.items) {
    if (item.kind === 'VarDecl') checkVarDecl(item);
  }

  for (const item of model.program.items) {
    if (item.kind === 'FunctionDecl') {
      const info: FunctionInfo | undefined = model.functions.get(item.name);
      const returnType = info?.returnType ?? ANY;
      checkBlock(item.body, returnType);
      if (!isVoid(returnType) && !item.body.statements.some(alwaysReturns)) {
        report('BUB407', item.span, { name: item.name, type: typeToString(returnType) }, 'warning');
      }
      continue;
    }
    if (item.kind === 'EventDecl') {
      checkBlock(item.body, VOID);
    }
  }

  return { diagnostics, expressionTypes };
}
