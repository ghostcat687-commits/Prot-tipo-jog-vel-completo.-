/** Painel de compilação: status, estatísticas, diagnósticos e artefatos. */

import { useState } from 'react';
import { useI18n, type MessageKey } from '../i18n';
import type { CompileArtifact, CompileResult } from '../bubble/compiler/compiler';
import type { Diagnostic } from '../bubble/compiler/diagnostics';
import { BoltIcon, DownloadIcon } from './Icons';

export interface BuildPanelProps {
  result: CompileResult | null;
  compiling: boolean;
  onSelectDiagnostic: (diagnostic: Diagnostic) => void;
}

function downloadArtifact(artifact: CompileArtifact): void {
  const blob = new Blob([artifact.content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = artifact.path.split('/').pop() ?? 'artifact.json';
  anchor.click();
  URL.revokeObjectURL(url);
}

export function BuildPanel({ result, compiling, onSelectDiagnostic }: BuildPanelProps): JSX.Element {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState<string | null>(null);

  const status = compiling
    ? 'running'
    : result === null
      ? 'idle'
      : result.ok
        ? 'ok'
        : 'failed';

  return (
    <section className="panel build-panel" aria-busy={compiling}>
      <header className="panel-header">
        <h2>
          <BoltIcon size={14} /> {t('build.title')}
        </h2>
        <div className="build-status">
          {compiling && <span className="status-pill running">{t('toolbar.compiling')}</span>}
          {!compiling && result && (
            <span className={`status-pill ${status}`}>
              {result.ok ? t('build.ok') : t('build.failed')} · {t('build.duration', { ms: result.stats.durationMs })}
            </span>
          )}
        </div>
      </header>

      <div className="build-body">
        {!result && !compiling && (
          <p className="empty-hint">
            <strong>{t('build.idle')}</strong> — {t('build.idleHint')}
          </p>
        )}

        {result && (
          <>
            <div className="build-counts">
              <span className={`count error${result.counts.error === 0 ? ' is-zero' : ''}`}>
                {t('build.errors', { count: result.counts.error })}
              </span>
              <span className={`count warning${result.counts.warning === 0 ? ' is-zero' : ''}`}>
                {t('build.warnings', { count: result.counts.warning })}
              </span>
            </div>

            <div className="stats-grid">
              <div>
                <span className="stat-label">{t('build.tokens')}</span>
                <span className="stat-value">{result.stats.tokens}</span>
              </div>
              <div>
                <span className="stat-label">{t('build.nodes')}</span>
                <span className="stat-value">{result.stats.astNodes}</span>
              </div>
              <div>
                <span className="stat-label">{t('build.functions')}</span>
                <span className="stat-value">{result.stats.functions}</span>
              </div>
              <div>
                <span className="stat-label">{t('build.modules')}</span>
                <span className="stat-value">{result.stats.modules}</span>
              </div>
              <div>
                <span className="stat-label">{t('build.folds')}</span>
                <span className="stat-value">{result.stats.constantFolds}</span>
              </div>
            </div>

            <h3 className="section-title">{t('build.diagnostics')}</h3>
            {result.diagnostics.length === 0 ? (
              <p className="empty-hint">{t('build.noDiagnostics')}</p>
            ) : (
              <ul className="diagnostic-list">
                {result.diagnostics.map((diagnostic, index) => (
                  <li key={`${diagnostic.code}-${diagnostic.span.start.offset}-${index}`}>
                    <button
                      type="button"
                      className={`diagnostic severity-${diagnostic.severity}`}
                      onClick={() => onSelectDiagnostic(diagnostic)}
                    >
                      <span className="diagnostic-code">{diagnostic.code}</span>
                      <span className="diagnostic-message">{t(diagnostic.messageKey as MessageKey, diagnostic.params)}</span>
                      <span className="diagnostic-location">
                        {diagnostic.file}:{diagnostic.span.start.line}:{diagnostic.span.start.column}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <h3 className="section-title">{t('build.artifacts')}</h3>
            {result.artifacts.length === 0 ? (
              <p className="empty-hint">{t('build.noArtifacts')}</p>
            ) : (
              <ul className="artifact-list">
                {result.artifacts.map((artifact) => (
                  <li key={artifact.path}>
                    <div className="artifact-row">
                      <button
                        type="button"
                        className="artifact-name"
                        onClick={() => setExpanded(expanded === artifact.path ? null : artifact.path)}
                        aria-expanded={expanded === artifact.path}
                      >
                        {artifact.path}
                        <span className="artifact-size">{artifact.bytes} B</span>
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        title={t('build.viewArtifact')}
                        aria-label={t('build.viewArtifact')}
                        onClick={() => downloadArtifact(artifact)}
                      >
                        <DownloadIcon size={14} />
                      </button>
                    </div>
                    {expanded === artifact.path && (
                      <pre className="artifact-view">{artifact.content}</pre>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </section>
  );
}
