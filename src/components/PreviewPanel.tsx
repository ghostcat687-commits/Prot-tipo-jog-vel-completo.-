/**
 * Painel de prévia 3D.
 *
 * A interface apenas comanda o motor (`PreviewEngine`), que por sua vez usa a
 * cena (`StudioScene`) e o carregamento de assets (`TextureCache`). Este
 * componente é carregado sob demanda para não pesar na abertura do editor.
 */

import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import {
  PreviewEngine,
  type PreviewMetrics,
  type PreviewQuality,
} from '../three/render/PreviewEngine';
import { CubeIcon, PauseIcon, PlayIcon, RestartIcon, StopIcon } from './Icons';

export interface PreviewPanelProps {
  quality: PreviewQuality;
  onQualityChange: (quality: PreviewQuality) => void;
}

type Status = 'loading' | 'running' | 'paused' | 'stopped' | 'error';

const EMPTY_METRICS: PreviewMetrics = {
  fps: 0,
  frameTime: 0,
  drawCalls: 0,
  triangles: 0,
  objects: 0,
};

export default function PreviewPanel({ quality, onQualityChange }: PreviewPanelProps): JSX.Element {
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<PreviewEngine | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [metrics, setMetrics] = useState<PreviewMetrics>(EMPTY_METRICS);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new PreviewEngine(
      canvas,
      {
        onMetrics: setMetrics,
        onReady: () => {
          setStatus('running');
          setError(null);
        },
        onError: (message) => {
          setError(message);
          setStatus('error');
        },
      },
      quality,
    );
    engineRef.current = engine;
    void engine.start();
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
    // O motor é criado uma única vez por montagem do painel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    engineRef.current?.applyQuality(quality);
  }, [quality]);

  const togglePause = (): void => {
    const engine = engineRef.current;
    if (!engine) return;
    if (status === 'stopped' || status === 'error') {
      setStatus('loading');
      void engine.start();
      return;
    }
    const next = !engine.isPaused();
    engine.setPaused(next);
    setStatus(next ? 'paused' : 'running');
  };

  const restart = (): void => {
    const engine = engineRef.current;
    if (!engine) return;
    setStatus('loading');
    void engine.restart().then(() => setStatus('running'));
  };

  const stop = (): void => {
    engineRef.current?.stop();
    setStatus('stopped');
  };

  return (
    <section className="panel preview-panel">
      <header className="panel-header">
        <h2>
          <CubeIcon size={14} /> {t('preview.title')}
        </h2>
        <div className="preview-controls">
          <button
            type="button"
            className="icon-button"
            title={status === 'paused' ? t('preview.play') : t('preview.pause')}
            aria-label={status === 'paused' ? t('preview.play') : t('preview.pause')}
            onClick={togglePause}
          >
            {status === 'paused' || status === 'stopped' ? <PlayIcon size={14} /> : <PauseIcon size={14} />}
          </button>
          <button
            type="button"
            className="icon-button"
            title={t('preview.restart')}
            aria-label={t('preview.restart')}
            onClick={restart}
          >
            <RestartIcon size={14} />
          </button>
          <button
            type="button"
            className="icon-button"
            title={t('preview.stop')}
            aria-label={t('preview.stop')}
            onClick={stop}
          >
            <StopIcon size={14} />
          </button>
          <label className="quality-select">
            <span>{t('preview.quality')}</span>
            <select
              value={quality}
              onChange={(event) => onQualityChange(event.target.value as PreviewQuality)}
            >
              <option value="low">{t('preview.quality.low')}</option>
              <option value="medium">{t('preview.quality.medium')}</option>
              <option value="high">{t('preview.quality.high')}</option>
            </select>
          </label>
        </div>
      </header>

      <div className="preview-stage">
        <canvas ref={canvasRef} className="preview-canvas" />
        <div className="metrics">
          <div>
            <span className="metric-value">{metrics.fps}</span>
            <span className="metric-label">{t('preview.fps')}</span>
          </div>
          <div>
            <span className="metric-value">{metrics.frameTime.toFixed(1)}</span>
            <span className="metric-label">ms</span>
          </div>
          <div>
            <span className="metric-value">{metrics.drawCalls}</span>
            <span className="metric-label">{t('preview.drawCalls')}</span>
          </div>
          <div>
            <span className="metric-value">{metrics.triangles.toLocaleString()}</span>
            <span className="metric-label">{t('preview.triangles')}</span>
          </div>
          <div>
            <span className="metric-value">{metrics.objects}</span>
            <span className="metric-label">{t('preview.objects')}</span>
          </div>
        </div>

        {status === 'paused' && <div className="preview-badge">{t('preview.paused')}</div>}
        {status === 'loading' && <div className="preview-overlay">{t('preview.loading')}</div>}
        {status === 'stopped' && <div className="preview-overlay">{t('preview.play')}</div>}
        {status === 'error' && (
          <div className="preview-overlay error">
            {error?.toLowerCase().includes('webgl') ? t('preview.noWebgl') : t('preview.error', { message: error ?? '' })}
          </div>
        )}
      </div>

      <footer className="preview-footer">
        <p className="preview-hint">{t('preview.hint')}</p>
        <p className="preview-note">{t('preview.adapterNote')}</p>
      </footer>
    </section>
  );
}
