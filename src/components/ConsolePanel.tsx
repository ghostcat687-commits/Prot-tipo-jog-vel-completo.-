/** Console Bubble: registra ações reais do Studio (compilação, erros, avisos). */

import { useEffect, useRef } from 'react';
import { useI18n } from '../i18n';
import { TerminalIcon, TrashIcon } from './Icons';

export type LogLevel = 'info' | 'warn' | 'error' | 'success';

export interface LogEntry {
  id: number;
  time: string;
  level: LogLevel;
  message: string;
}

export interface ConsolePanelProps {
  logs: LogEntry[];
  onClear: () => void;
}

export function ConsolePanel({ logs, onClear }: ConsolePanelProps): JSX.Element {
  const { t } = useI18n();
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = listRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [logs]);

  return (
    <section className="panel console-panel">
      <header className="panel-header">
        <h2>
          <TerminalIcon size={14} /> {t('console.title')}
        </h2>
        <button
          type="button"
          className="icon-button"
          title={t('console.clear')}
          aria-label={t('console.clear')}
          onClick={onClear}
        >
          <TrashIcon size={14} />
        </button>
      </header>
      <div className="console-list" ref={listRef} role="log" aria-live="polite">
        {logs.length === 0 && <p className="empty-hint">{t('console.empty')}</p>}
        {logs.map((entry) => (
          <div key={entry.id} className={`console-line level-${entry.level}`}>
            <span className="console-time">{entry.time}</span>
            <span className="console-message">{entry.message}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
