/**
 * Sistema de tipos da linguagem Bubble.
 *
 * Tipos do núcleo provisório: `num`, `text`, `bool`, `void`, `any`, `list<T>`
 * e structs (nativos como `vec3` ou declarados no projeto).
 */

import type { TypeRef } from './ast';

export type PrimitiveName = 'num' | 'text' | 'bool' | 'void' | 'any';

export type BubbleType =
  | { kind: 'primitive'; name: PrimitiveName }
  | { kind: 'list'; element: BubbleType }
  | { kind: 'struct'; name: string };

export const NUM: BubbleType = { kind: 'primitive', name: 'num' };
export const TEXT: BubbleType = { kind: 'primitive', name: 'text' };
export const BOOL: BubbleType = { kind: 'primitive', name: 'bool' };
export const VOID: BubbleType = { kind: 'primitive', name: 'void' };
export const ANY: BubbleType = { kind: 'primitive', name: 'any' };

export function listOf(element: BubbleType): BubbleType {
  return { kind: 'list', element };
}

export function isAny(type: BubbleType): boolean {
  return type.kind === 'primitive' && type.name === 'any';
}

export function isVoid(type: BubbleType): boolean {
  return type.kind === 'primitive' && type.name === 'void';
}

export function isNumeric(type: BubbleType): boolean {
  return type.kind === 'primitive' && type.name === 'num';
}

export function isBool(type: BubbleType): boolean {
  return type.kind === 'primitive' && type.name === 'bool';
}

export function isText(type: BubbleType): boolean {
  return type.kind === 'primitive' && type.name === 'text';
}

export function typeToString(type: BubbleType): string {
  switch (type.kind) {
    case 'primitive':
      return type.name;
    case 'list':
      return `list<${typeToString(type.element)}>`;
    case 'struct':
      return type.name;
  }
}

/** Lê a notação textual usada nas assinaturas da biblioteca padrão. */
export function parseTypeString(source: string): BubbleType {
  const trimmed = source.trim();
  if (trimmed.startsWith('list<') && trimmed.endsWith('>')) {
    return listOf(parseTypeString(trimmed.slice(5, -1)));
  }
  if (trimmed === 'num' || trimmed === 'text' || trimmed === 'bool' || trimmed === 'void' || trimmed === 'any') {
    return { kind: 'primitive', name: trimmed };
  }
  return { kind: 'struct', name: trimmed };
}

export function typesEqual(a: BubbleType, b: BubbleType): boolean {
  if (a.kind === 'primitive' && b.kind === 'primitive') return a.name === b.name;
  if (a.kind === 'list' && b.kind === 'list') return typesEqual(a.element, b.element);
  if (a.kind === 'struct' && b.kind === 'struct') return a.name === b.name;
  return false;
}

/** `any` funciona como curinga dos dois lados (usado nas assinaturas nativas). */
export function isAssignable(from: BubbleType, to: BubbleType): boolean {
  if (isAny(from) || isAny(to)) return true;
  if (from.kind === 'list' && to.kind === 'list') return isAssignable(from.element, to.element);
  return typesEqual(from, to);
}

/** Resolve uma anotação de tipo escrita no código. `null` = tipo desconhecido. */
export function resolveTypeRef(
  ref: TypeRef,
  structs: Map<string, { name: string }>,
): BubbleType | null {
  if (ref.kind === 'list') {
    const element = resolveTypeRef(ref.element, structs);
    return element ? listOf(element) : null;
  }
  if (ref.name === 'num' || ref.name === 'text' || ref.name === 'bool' || ref.name === 'void' || ref.name === 'any') {
    return { kind: 'primitive', name: ref.name };
  }
  if (structs.has(ref.name)) return { kind: 'struct', name: ref.name };
  return null;
}
