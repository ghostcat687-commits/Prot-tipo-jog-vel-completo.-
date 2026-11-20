/**
 * Renderização da prévia 3D (WebGL via three.js).
 *
 * Responsabilidades exclusivas deste módulo:
 *  - criar/redimensionar o renderer e a câmera;
 *  - controlar o laço de renderização e o estado (executando/pausado/parado);
 *  - aplicar níveis de qualidade;
 *  - medir FPS, tempo de quadro, draw calls e triângulos REAIS;
 *  - liberar geometrias, materiais, texturas e o contexto WebGL ao encerrar.
 *
 * A cena vem de `StudioScene`; a interface React apenas comanda o motor.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TextureCache } from '../assets/TextureCache';
import { buildStudioScene, type StudioScene } from '../scene/StudioScene';

export type PreviewQuality = 'low' | 'medium' | 'high';

export interface PreviewMetrics {
  fps: number;
  frameTime: number;
  drawCalls: number;
  triangles: number;
  objects: number;
}

export interface PreviewEngineCallbacks {
  onMetrics: (metrics: PreviewMetrics) => void;
  onReady: () => void;
  onError: (message: string) => void;
}

const QUALITY: Record<PreviewQuality, { pixelRatio: number; shadow: number }> = {
  low: { pixelRatio: 1, shadow: 512 },
  medium: { pixelRatio: 1.5, shadow: 1024 },
  high: { pixelRatio: 2, shadow: 2048 },
};

export class PreviewEngine {
  private readonly canvas: HTMLCanvasElement;
  private readonly callbacks: PreviewEngineCallbacks;
  private readonly textures = new TextureCache();

  private renderer: THREE.WebGLRenderer | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private controls: OrbitControls | null = null;
  private studio: StudioScene | null = null;

  private raf = 0;
  private lastFrame = 0;
  private frames = 0;
  private metricsWindow = 0;
  private frameTimeSum = 0;
  private paused = false;
  private quality: PreviewQuality = 'medium';
  private disposed = false;
  private resizeObserver: ResizeObserver | null = null;

  constructor(canvas: HTMLCanvasElement, callbacks: PreviewEngineCallbacks, quality: PreviewQuality = 'medium') {
    this.canvas = canvas;
    this.callbacks = callbacks;
    this.quality = quality;
  }

  async start(): Promise<void> {
    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      });
    } catch (error) {
      this.callbacks.onError(error instanceof Error ? error.message : 'WebGL indisponível');
      return;
    }

    const renderer = this.renderer;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 120);
    this.camera.position.set(7, 6, 9);

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 24;
    this.controls.maxPolarAngle = Math.PI / 2.05;
    this.controls.target.set(0, 1.6, 0);

    await this.rebuildScene();
    this.applyQuality(this.quality);
    this.resize();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    if (this.canvas.parentElement) this.resizeObserver.observe(this.canvas.parentElement);

    this.lastFrame = performance.now();
    this.loop(this.lastFrame);
    this.callbacks.onReady();
  }

  private async rebuildScene(): Promise<void> {
    if (!this.renderer) return;
    this.studio?.dispose();
    this.studio = await buildStudioScene(this.textures);
    this.studio.setShadowQuality(QUALITY[this.quality].shadow);
    this.callbacks.onMetrics({
      fps: 0,
      frameTime: 0,
      drawCalls: 0,
      triangles: 0,
      objects: this.studio.scene.children.length,
    });
  }

  private loop = (timeMs: number): void => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);

    const delta = Math.min((timeMs - this.lastFrame) / 1000, 0.1);
    this.lastFrame = timeMs;

    this.controls?.update();
    if (!this.paused) this.studio?.update(delta);
    this.render();

    this.frames += 1;
    this.frameTimeSum += delta * 1000;
    this.metricsWindow += delta * 1000;
    if (this.metricsWindow >= 500) {
      const frameTime = this.frameTimeSum / this.frames;
      const info = this.renderer?.info.render;
      this.callbacks.onMetrics({
        fps: Math.round((this.frames * 1000) / this.metricsWindow),
        frameTime: Math.round(frameTime * 100) / 100,
        drawCalls: info?.calls ?? 0,
        triangles: info?.triangles ?? 0,
        objects: this.studio?.scene.children.length ?? 0,
      });
      this.frames = 0;
      this.frameTimeSum = 0;
      this.metricsWindow = 0;
    }
  };

  private render(): void {
    if (!this.renderer || !this.camera || !this.studio) return;
    this.renderer.render(this.studio.scene, this.camera);
  }

  resize(): void {
    if (!this.renderer || !this.camera) return;
    const parent = this.canvas.parentElement;
    const width = Math.max(1, parent?.clientWidth ?? this.canvas.clientWidth);
    const height = Math.max(1, parent?.clientHeight ?? this.canvas.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  applyQuality(quality: PreviewQuality): void {
    this.quality = quality;
    if (!this.renderer) return;
    const preset = QUALITY[quality];
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, preset.pixelRatio));
    this.studio?.setShadowQuality(preset.shadow);
    this.resize();
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  isPaused(): boolean {
    return this.paused;
  }

  async restart(): Promise<void> {
    this.paused = false;
    await this.rebuildScene();
    this.lastFrame = performance.now();
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.studio?.dispose();
    this.studio = null;
    this.renderer?.clear();
    this.callbacks.onMetrics({ fps: 0, frameTime: 0, drawCalls: 0, triangles: 0, objects: 0 });
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObserver?.disconnect();
    this.controls?.dispose();
    this.studio?.dispose();
    this.textures.dispose();
    this.renderer?.dispose();
    this.renderer = null;
    this.camera = null;
    this.controls = null;
  }
}
