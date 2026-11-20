/**
 * Editor de código Bubble (CodeMirror 6).
 *
 * Recursos: numeração de linhas, dobra de blocos, indentação, casamento de
 * parênteses, autocompletar da linguagem e diagnósticos do compilador
 * marcados diretamente no texto (linha e coluna reais).
 */

import { useEffect, useRef } from 'react';
import {
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  drawSelection,
  dropCursor,
} from '@codemirror/view';
import { Compartment, EditorState } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { bracketMatching, foldGutter, foldKeymap } from '@codemirror/language';
import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from '@codemirror/autocomplete';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import { setDiagnostics } from '@codemirror/lint';
import type { Diagnostic } from '../bubble/compiler/diagnostics';
import { bubbleCompletionSource, bubbleHighlighting, bubbleStreamLanguage } from './bubbleLanguage';

export interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  onCursorChange?: (line: number, column: number) => void;
  diagnostics: Diagnostic[];
  translateDiagnostic: (diagnostic: Diagnostic) => string;
  /** Posição para onde o cursor deve ir (ao clicar num diagnóstico). */
  goto?: { line: number; column: number; nonce: number } | null;
  readOnly?: boolean;
}

const themeCompartment = new Compartment();
const readOnlyCompartment = new Compartment();

const bubbleTheme = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: 'var(--editor-bg)',
    color: 'var(--text)',
    fontSize: '13.5px',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': {
    fontFamily: 'var(--font-mono)',
    lineHeight: '1.55',
    overflow: 'auto',
  },
  '.cm-content': { padding: '10px 0', caretColor: 'var(--accent)' },
  '.cm-line': { padding: '0 12px 0 6px' },
  '.cm-gutters': {
    backgroundColor: 'var(--editor-gutter)',
    color: 'var(--text-dim)',
    border: 'none',
    borderRight: '1px solid var(--border)',
  },
  '.cm-activeLineGutter': { backgroundColor: 'var(--surface-2)', color: 'var(--text)' },
  '.cm-activeLine': { backgroundColor: 'var(--editor-active-line)' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': {
    backgroundColor: 'var(--selection)',
  },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent)', borderLeftWidth: '2px' },
  '.cm-foldPlaceholder': {
    backgroundColor: 'var(--surface-2)',
    border: '1px solid var(--border)',
    color: 'var(--text-dim)',
  },
  '.cm-tooltip': {
    backgroundColor: 'var(--surface-2)',
    border: '1px solid var(--border)',
    color: 'var(--text)',
  },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
    backgroundColor: 'var(--accent-soft)',
    color: 'var(--text)',
  },
  '.cm-panels': { backgroundColor: 'var(--surface-2)', color: 'var(--text)' },
});

export function CodeEditor({
  value,
  onChange,
  onCursorChange,
  diagnostics,
  translateDiagnostic,
  goto = null,
  readOnly = false,
}: CodeEditorProps): JSX.Element {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onCursorRef = useRef(onCursorChange);

  onChangeRef.current = onChange;
  onCursorRef.current = onCursorChange;

  useEffect(() => {
    if (!hostRef.current) return;
    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        foldGutter(),
        drawSelection(),
        dropCursor(),
        history(),
        bracketMatching(),
        closeBrackets(),
        autocompletion({ override: [bubbleCompletionSource], activateOnTyping: true }),
        highlightSelectionMatches(),
        bubbleStreamLanguage,
        bubbleHighlighting,
        EditorView.lineWrapping,
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...searchKeymap,
          ...historyKeymap,
          ...foldKeymap,
          ...completionKeymap,
          indentWithTab,
        ]),
        themeCompartment.of(bubbleTheme),
        readOnlyCompartment.of(EditorState.readOnly.of(readOnly)),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChangeRef.current(update.state.doc.toString());
          if (update.selectionSet && onCursorRef.current) {
            const head = update.state.selection.main.head;
            const line = update.state.doc.lineAt(head);
            onCursorRef.current(line.number, head - line.from + 1);
          }
        }),
      ],
    });

    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // O editor é criado uma única vez; o conteúdo é sincronizado abaixo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === value) return;
    view.dispatch({
      changes: { from: 0, to: current.length, insert: value },
    });
  }, [value]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: readOnlyCompartment.reconfigure(EditorState.readOnly.of(readOnly)),
    });
  }, [readOnly]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || !goto) return;
    const lineNumber = Math.min(Math.max(1, goto.line), view.state.doc.lines);
    const line = view.state.doc.line(lineNumber);
    const position = Math.min(line.from + Math.max(0, goto.column - 1), line.to);
    view.dispatch({
      selection: { anchor: position },
      scrollIntoView: true,
    });
    view.focus();
    // `nonce` garante que clicar no mesmo diagnóstico reposicione o cursor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goto?.nonce]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const length = view.state.doc.length;
    const items = diagnostics.map((diagnostic) => {
      const from = Math.min(Math.max(0, diagnostic.span.start.offset), length);
      const to = Math.min(Math.max(from, diagnostic.span.end.offset), length);
      return {
        from,
        to: to === from ? Math.min(from + 1, length) : to,
        severity: diagnostic.severity === 'error' ? ('error' as const) : diagnostic.severity === 'warning' ? ('warning' as const) : ('info' as const),
        message: translateDiagnostic(diagnostic),
        source: diagnostic.code,
      };
    });
    view.dispatch(setDiagnostics(view.state, items));
  }, [diagnostics, translateDiagnostic]);

  return <div className="code-editor" ref={hostRef} />;
}
