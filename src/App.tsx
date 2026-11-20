/**
 * Bubble Studio 0.1 — aplicação principal.
 *
 * Organização:
 *  - `bubble/`     linguagem, lexer, parser, AST, semântica, tipos, IR e compilador
 *  - `editor/`     editor de código Bubble (CodeMirror) e destaque/autocompletar
 *  - `three/`      prévia 3D (render, cena e assets separados)
 *  - `components/` painéis da interface
 *  - `i18n/`       traduções (pt-BR padrão, en, es, ar)
 *  - `studio/`     projeto, persistência e preferências
 */

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { compileProject, type CompileResult } from './bubble/compiler/compiler';
import type { Diagnostic } from './bubble/compiler/diagnostics';
import { CodeEditor } from './editor/CodeEditor';
import { Explorer } from './components/Explorer';
import { BuildPanel } from './components/BuildPanel';
import { ConsolePanel, type LogEntry, type LogLevel } from './components/ConsolePanel';
import { SettingsPanel } from './components/SettingsPanel';
import { useI18n, type MessageKey } from './i18n';
import { useSettings } from './studio/settings';
import {
  createSampleProject,
  fileNameOf,
  loadProject,
  saveProject,
  type Project,
} from './studio/project';
import { useInstallPrompt } from './pwa';
import {
  BoltIcon,
  BubbleLogo,
  CloseIcon,
  DownloadIcon,
  MoonIcon,
  SettingsIcon,
  SunIcon,
} from './components/Icons';
import type { PreviewQuality } from './three/render/PreviewEngine';

const PreviewPanel = lazy(() => import('./components/PreviewPanel'));

type MobileTab = 'files' | 'editor' | 'build' | 'preview' | 'console';

const MOBILE_TABS: { id: MobileTab; labelKey: MessageKey }[] = [
  { id: 'files', labelKey: 'tab.files' },
  { id: 'editor', labelKey: 'tab.editor' },
  { id: 'build', labelKey: 'tab.build' },
  { id: 'preview', labelKey: 'tab.preview' },
  { id: 'console', labelKey: 'tab.console' },
];

function templateFor(path: string): string {
  if (path.endsWith('.bubble')) {
    const moduleName = path.replace(/\.bubble$/, '').replace(/\//g, '.');
    return `// ${path}\nmodule ${moduleName}\n\non start {\n  print("olá, Bubble")\n}\n`;
  }
  if (path.endsWith('.json')) return '{\n}\n';
  if (path.endsWith('.html')) return '<!doctype html>\n<html lang="pt-BR">\n  <body>\n  </body>\n</html>\n';
  return '';
}

export default function App(): JSX.Element {
  const { t } = useI18n();
  const { settings, resolved, update } = useSettings();
  const install = useInstallPrompt();

  const [project, setProject] = useState<Project>(() => loadProject());
  const [activePath, setActivePath] = useState<string | null>(
    () => project.files.find((file) => file.path.endsWith('.bubble'))?.path ?? null,
  );
  const [openTabs, setOpenTabs] = useState<string[]>(() => {
    const first = project.files.find((file) => file.path.endsWith('.bubble'));
    return first ? [first.path] : [];
  });
  const [compileResult, setCompileResult] = useState<CompileResult | null>(null);
  const [compiling, setCompiling] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const [goto, setGoto] = useState<{ line: number; column: number; nonce: number } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>('editor');
  const [previewQuality, setPreviewQuality] = useState<PreviewQuality>('medium');
  const [updateReady, setUpdateReady] = useState(false);

  const logIdRef = useRef(0);
  const pushLog = useCallback((level: LogLevel, message: string) => {
    logIdRef.current += 1;
    const entry: LogEntry = {
      id: logIdRef.current,
      time: new Date().toLocaleTimeString(),
      level,
      message,
    };
    setLogs((current) => [...current.slice(-199), entry]);
  }, []);

  // ---------------------------------------------------------------- persistência
  useEffect(() => {
    const timer = window.setTimeout(() => saveProject(project), 350);
    return () => window.clearTimeout(timer);
  }, [project]);

  useEffect(() => {
    pushLog('info', t('console.ready'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onUpdate = (): void => setUpdateReady(true);
    window.addEventListener('bubble:update-ready', onUpdate);
    return () => window.removeEventListener('bubble:update-ready', onUpdate);
  }, []);

  useEffect(() => {
    const panel = new URLSearchParams(window.location.search).get('panel');
    if (panel === 'preview' || panel === 'files' || panel === 'build' || panel === 'console' || panel === 'editor') {
      setMobileTab(panel);
    }
  }, []);

  // ---------------------------------------------------------------- compilação
  const runCompile = useCallback(
    (options: { silent?: boolean } = {}) => {
      const files = project.files;
      setCompiling(true);
      window.requestAnimationFrame(() => {
        const result = compileProject(files);
        setCompileResult(result);
        setCompiling(false);
        if (!options.silent) {
          pushLog(
            result.ok ? 'success' : 'error',
            `${result.ok ? t('build.ok') : t('build.failed')} · ${t('build.errors', {
              count: result.counts.error,
            })} · ${t('build.warnings', { count: result.counts.warning })} · ${t('build.duration', {
              ms: result.stats.durationMs,
            })}`,
          );
          for (const diagnostic of result.diagnostics.slice(0, 8)) {
            pushLog(
              diagnostic.severity === 'error' ? 'error' : 'warn',
              `${diagnostic.code} ${diagnostic.file}:${diagnostic.span.start.line}:${diagnostic.span.start.column} — ${t(
                diagnostic.messageKey as MessageKey,
                diagnostic.params,
              )}`,
            );
          }
        }
      });
    },
    [project.files, pushLog, t],
  );

  useEffect(() => {
    if (!settings.autoCompile) return;
    const timer = window.setTimeout(() => runCompile({ silent: true }), 400);
    return () => window.clearTimeout(timer);
  }, [runCompile, settings.autoCompile]);

  useEffect(() => {
    runCompile({ silent: true });
    // Primeira análise do projeto ao abrir o Studio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------- arquivos
  const activeFile = useMemo(
    () => project.files.find((file) => file.path === activePath) ?? null,
    [project.files, activePath],
  );

  const openFile = useCallback((path: string) => {
    setActivePath(path);
    setOpenTabs((current) => (current.includes(path) ? current : [...current, path]));
    setMobileTab('editor');
  }, []);

  const updateFileContent = useCallback(
    (content: string) => {
      if (!activePath) return;
      setProject((current) => ({
        ...current,
        files: current.files.map((file) => (file.path === activePath ? { ...file, content } : file)),
      }));
    },
    [activePath],
  );

  const createFile = useCallback(
    (path: string) => {
      setProject((current) => ({
        ...current,
        files: [...current.files, { path, content: templateFor(path) }].sort((a, b) =>
          a.path.localeCompare(b.path),
        ),
      }));
      openFile(path);
      pushLog('info', `${t('explorer.newFile')}: ${path}`);
    },
    [openFile, pushLog, t],
  );

  const renameFile = useCallback(
    (from: string, to: string) => {
      setProject((current) => ({
        ...current,
        files: current.files.map((file) => (file.path === from ? { ...file, path: to } : file)),
      }));
      setOpenTabs((current) => current.map((path) => (path === from ? to : path)));
      setActivePath((current) => (current === from ? to : current));
    },
    [],
  );

  const deleteFile = useCallback(
    (path: string) => {
      setProject((current) => ({
        ...current,
        files: current.files.filter((file) => file.path !== path),
      }));
      setOpenTabs((current) => {
        const next = current.filter((tab) => tab !== path);
        setActivePath((active) => (active === path ? next[next.length - 1] ?? null : active));
        return next;
      });
    },
    [],
  );

  const closeTab = useCallback((path: string) => {
    setOpenTabs((current) => {
      const next = current.filter((tab) => tab !== path);
      setActivePath((active) => (active === path ? next[next.length - 1] ?? null : active));
      return next;
    });
  }, []);

  const resetProject = useCallback(() => {
    const sample = createSampleProject();
    setProject(sample);
    const first = sample.files.find((file) => file.path.endsWith('.bubble'))?.path ?? null;
    setActivePath(first);
    setOpenTabs(first ? [first] : []);
    setSettingsOpen(false);
    pushLog('info', t('settings.reset'));
  }, [pushLog, t]);

  // ---------------------------------------------------------------- diagnósticos
  const activeDiagnostics = useMemo<Diagnostic[]>(
    () => (compileResult?.diagnostics ?? []).filter((diagnostic) => diagnostic.file === activePath),
    [compileResult, activePath],
  );

  const translateDiagnostic = useCallback(
    (diagnostic: Diagnostic) => t(diagnostic.messageKey as MessageKey, diagnostic.params),
    [t],
  );

  const selectDiagnostic = useCallback(
    (diagnostic: Diagnostic) => {
      if (!diagnostic.file) return;
      openFile(diagnostic.file);
      setGoto({
        line: diagnostic.span.start.line,
        column: diagnostic.span.start.column,
        nonce: Date.now(),
      });
    },
    [openFile],
  );

  const themeIcon = resolved === 'dark' ? <SunIcon size={15} /> : <MoonIcon size={15} />;

  return (
    <div className="app">
      <header className="toolbar">
        <div className="brand">
          <BubbleLogo size={26} />
          <div className="brand-text">
            <strong>{t('app.name')}</strong>
            <span>{t('app.version')}</span>
          </div>
          <span className="brand-project" title={project.name}>
            {project.name}
          </span>
        </div>

        <div className="toolbar-actions">
          <button type="button" className="button primary" onClick={() => runCompile()} disabled={compiling}>
            <BoltIcon size={15} />
            {compiling ? t('toolbar.compiling') : t('toolbar.compile')}
          </button>
          <button
            type="button"
            className="icon-button"
            title={t('toolbar.install')}
            aria-label={t('toolbar.install')}
            onClick={() => (install.canInstall ? void install.install() : setSettingsOpen(true))}
            disabled={install.installed}
          >
            <DownloadIcon size={15} />
          </button>
          <button
            type="button"
            className="icon-button"
            title={t('toolbar.theme')}
            aria-label={t('toolbar.theme')}
            onClick={() => update({ theme: resolved === 'dark' ? 'light' : 'dark' })}
          >
            {themeIcon}
          </button>
          <button
            type="button"
            className="icon-button"
            title={t('tab.settings')}
            aria-label={t('tab.settings')}
            onClick={() => setSettingsOpen(true)}
          >
            <SettingsIcon size={16} />
          </button>
        </div>
      </header>

      <main className="workspace" data-mobile-tab={mobileTab}>
        <div className="panel-slot slot-files">
          <Explorer
            files={project.files}
            activePath={activePath}
            onOpen={openFile}
            onCreate={createFile}
            onRename={renameFile}
            onDelete={deleteFile}
          />
        </div>

        <div className="panel-slot slot-editor">
          <section className="panel editor-panel">
            <div className="tabbar" role="tablist">
              {openTabs.map((path) => (
                <div
                  key={path}
                  className={`tab${path === activePath ? ' is-active' : ''}`}
                  role="tab"
                  aria-selected={path === activePath}
                >
                  <button type="button" className="tab-label" onClick={() => openFile(path)}>
                    {fileNameOf(path)}
                  </button>
                  <button
                    type="button"
                    className="tab-close"
                    aria-label={t('editor.closeTab')}
                    title={t('editor.closeTab')}
                    onClick={() => closeTab(path)}
                  >
                    <CloseIcon size={11} />
                  </button>
                </div>
              ))}
              <span className="tabbar-spacer" />
              <span className="tabbar-path">{activePath ?? ''}</span>
            </div>

            {activeFile ? (
              <CodeEditor
                value={activeFile.content}
                onChange={updateFileContent}
                onCursorChange={(line, column) => setCursor({ line, column })}
                diagnostics={activeDiagnostics}
                translateDiagnostic={translateDiagnostic}
                goto={goto}
              />
            ) : (
              <div className="editor-empty">
                <strong>{t('editor.empty')}</strong>
                <p>{t('editor.emptyHint')}</p>
              </div>
            )}
          </section>

          <div className="panel-slot slot-build">
            <BuildPanel result={compileResult} compiling={compiling} onSelectDiagnostic={selectDiagnostic} />
          </div>
        </div>

        <div className="panel-slot slot-preview">
          <Suspense fallback={<div className="panel preview-loading">{t('preview.loading')}</div>}>
            <PreviewPanel quality={previewQuality} onQualityChange={setPreviewQuality} />
          </Suspense>
          <div className="panel-slot slot-console">
            <ConsolePanel logs={logs} onClear={() => setLogs([])} />
          </div>
        </div>
      </main>

      <footer className="statusbar">
        <span className="status-item">
          {t('status.languageStatus', { version: '0.1' })}
        </span>
        <span className="status-item">
          {t('status.line', { line: cursor.line })} · {t('status.column', { column: cursor.column })}
        </span>
        <span className="status-item status-right">
          {compileResult
            ? t('status.diagnostics', {
                errors: compileResult.counts.error,
                warnings: compileResult.counts.warning,
              })
            : t('status.ok')}
        </span>
        <span className="status-item status-dim">{t('toolbar.autosave')}</span>
      </footer>

      <nav className="mobile-nav" aria-label={t('toolbar.menu')}>
        {MOBILE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={mobileTab === tab.id ? 'is-active' : ''}
            onClick={() => setMobileTab(tab.id)}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </nav>

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onChange={update}
        onResetProject={resetProject}
        canInstall={install.canInstall}
        installed={install.installed}
        onInstall={() => void install.install()}
      />

      {updateReady && (
        <div className="toast" role="status">
          <span>{t('pwa.updateReady')}</span>
          <button
            type="button"
            className="button primary small"
            onClick={() => {
              navigator.serviceWorker?.getRegistration().then((registration) => {
                registration?.waiting?.postMessage('skip-waiting');
                window.location.reload();
              });
            }}
          >
            {t('pwa.updateNow')}
          </button>
        </div>
      )}
    </div>
  );
}
