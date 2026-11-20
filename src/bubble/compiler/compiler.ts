/**
 * COMPILADOR BUBBLE — orquestração do pipeline.
 *
 * Pipeline real (nada é simulado):
 *   lexer → parser → AST → análise semântica → verificação de tipos → IR →
 *   pacote/manifesto.
 *
 * Regras aplicadas:
 *  - sem código válido não existe IR (o build falha com erro);
 *  - todo diagnóstico traz arquivo, linha e coluna;
 *  - JSON do projeto é validado antes de entrar no pacote;
 *  - o resultado é determinístico para o mesmo conjunto de arquivos.
 */

import { childNodes } from './ast';
import {
  countBySeverity,
  hasErrors,
  makeDiagnostic,
  sortDiagnostics,
  type Diagnostic,
} from './diagnostics';
import { buildIr, type IrModule } from './ir';
import { lex } from './lexer';
import { parseTokens } from './parser';
import { analyzeModule } from './semantic';
import { typecheckModule } from './typecheck';
import { FILE_EXTENSION, LANGUAGE_VERSION } from '../language/spec';

export interface SourceFile {
  path: string;
  content: string;
}

export interface CompileStats {
  files: number;
  modules: number;
  tokens: number;
  astNodes: number;
  functions: number;
  structs: number;
  globals: number;
  events: number;
  constantFolds: number;
  durationMs: number;
}

export interface CompileArtifact {
  path: string;
  kind: 'ir' | 'manifest' | 'report';
  content: string;
  bytes: number;
}

export interface CompileResult {
  ok: boolean;
  diagnostics: Diagnostic[];
  counts: Record<'error' | 'warning' | 'info', number>;
  artifacts: CompileArtifact[];
  modules: IrModule[];
  stats: CompileStats;
}

export interface CompileOptions {
  /** Módulo de entrada; padrão: primeiro módulo encontrado. */
  entry?: string;
}

const now = (): number =>
  typeof performance !== 'undefined' ? performance.now() : Date.now();

function countNodes(node: unknown): number {
  if (!node || typeof node !== 'object') return 0;
  const record = node as { kind?: string } & Record<string, unknown>;
  let total = 1;
  for (const child of childNodes(record as never)) total += countNodes(child);
  return total;
}

export function compileProject(
  files: SourceFile[],
  options: CompileOptions = {},
): CompileResult {
  const started = now();
  const diagnostics: Diagnostic[] = [];
  const bubbleFiles = files.filter((file) => file.path.endsWith(FILE_EXTENSION));

  if (bubbleFiles.length === 0) {
    diagnostics.push(
      makeDiagnostic('BUB501', 'error', {
        start: { offset: 0, line: 1, column: 1 },
        end: { offset: 0, line: 1, column: 1 },
      }),
    );
  }

  // ---------------------------------------------------------------- JSON do projeto
  for (const file of files) {
    if (!file.path.endsWith('.json')) continue;
    try {
      JSON.parse(file.content);
    } catch (error) {
      diagnostics.push(
        makeDiagnostic('BUB502', 'error', {
          start: { offset: 0, line: 1, column: 1 },
          end: { offset: 0, line: 1, column: 1 },
        }, { file: file.path, reason: error instanceof Error ? error.message : 'JSON inválido' }, file.path),
      );
    }
  }

  // ---------------------------------------------------------------- lexer + parser
  let tokens = 0;
  let astNodes = 0;
  const parsedFiles = bubbleFiles.map((file) => {
    const lexed = lex(file.content, file.path);
    tokens += lexed.tokens.length;
    const parsed = parseTokens(lexed.tokens, file.path);
    diagnostics.push(...lexed.diagnostics, ...parsed.diagnostics);
    astNodes += countNodes(parsed.program);
    return { file, program: parsed.program };
  });

  // ---------------------------------------------------------------- módulos conhecidos
  const moduleNames = new Set<string>();
  for (const parsed of parsedFiles) {
    const name = parsed.program.module?.name;
    if (name) moduleNames.add(name);
    // O caminho do arquivo também identifica o módulo: core/main.bubble → core.main
    moduleNames.add(parsed.file.path.replace(/\.bubble$/, '').replace(/\//g, '.'));
  }

  // ---------------------------------------------------------------- semântica + tipos
  const checked = parsedFiles.map(({ file, program }) => {
    const semantic = analyzeModule(program, file.path, moduleNames);
    diagnostics.push(...semantic.diagnostics);
    const typed = typecheckModule(semantic.model);
    diagnostics.push(...typed.diagnostics);
    return { model: semantic.model, expressionTypes: typed.expressionTypes };
  });

  // ---------------------------------------------------------------- IR
  const modules: IrModule[] = [];
  let constantFolds = 0;
  if (!hasErrors(diagnostics)) {
    for (const entry of checked) {
      const built = buildIr(entry.model, entry.expressionTypes);
      modules.push(built.module);
      constantFolds += built.constantFolds;
    }
  }

  const sorted = sortDiagnostics(diagnostics);
  const ok = !hasErrors(sorted);
  const stats: CompileStats = {
    files: bubbleFiles.length,
    modules: modules.length,
    tokens,
    astNodes,
    functions: modules.reduce((total, module) => total + module.functions.length, 0),
    structs: modules.reduce((total, module) => total + module.structs.length, 0),
    globals: modules.reduce((total, module) => total + module.globals.length, 0),
    events: modules.reduce((total, module) => total + module.events.length, 0),
    constantFolds,
    durationMs: Math.max(0, Math.round(now() - started)),
  };

  // ---------------------------------------------------------------- artefatos
  const artifacts: CompileArtifact[] = [];
  if (ok) {
    for (const module of modules) {
      const content = JSON.stringify(module, null, 2);
      artifacts.push({
        path: `ir/${module.module}.bubbleir.json`,
        kind: 'ir',
        content,
        bytes: content.length,
      });
    }
    const manifest = {
      format: 'bubble-package',
      version: LANGUAGE_VERSION,
      language: { name: 'Bubble', version: LANGUAGE_VERSION },
      entry: options.entry ?? modules[0]?.module ?? 'main',
      modules: modules.map((module) => ({ name: module.module, file: module.file })),
      assets: files
        .filter((file) => !file.path.endsWith(FILE_EXTENSION) && !file.path.endsWith('.json'))
        .map((file) => file.path),
      executor: { required: true, minVersion: LANGUAGE_VERSION },
      permissions: [],
    };
    const manifestContent = JSON.stringify(manifest, null, 2);
    artifacts.push({
      path: 'package/manifest.json',
      kind: 'manifest',
      content: manifestContent,
      bytes: manifestContent.length,
    });
    const report = JSON.stringify({ ok, stats, counts: countBySeverity(sorted) }, null, 2);
    artifacts.push({ path: 'build-report.json', kind: 'report', content: report, bytes: report.length });
  }

  return { ok, diagnostics: sorted, counts: countBySeverity(sorted), artifacts, modules, stats };
}
