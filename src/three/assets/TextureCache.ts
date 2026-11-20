/**
 * Carregamento assíncrono de texturas com cache e descarte explícito.
 *
 * As texturas do projeto de exemplo ainda não estão no repositório (a
 * especificação registra assets externos), então o Studio gera texturas
 * procedurais localmente e as carrega pelo caminho real de imagem
 * (`TextureLoader`), mantendo a mesma assinatura que será usada quando os
 * assets oficiais forem adicionados.
 */

import * as THREE from 'three';

export type TextureFactory = () => string;

function createCanvas(size: number): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D indisponível');
  return context;
}

export const gridTextureFactory: TextureFactory = () => {
  const size = 256;
  const context = createCanvas(size);
  context.fillStyle = '#0e1726';
  context.fillRect(0, 0, size, size);
  context.strokeStyle = 'rgba(110, 231, 249, 0.55)';
  context.lineWidth = 3;
  context.strokeRect(0, 0, size, size);
  context.strokeStyle = 'rgba(110, 231, 249, 0.18)';
  context.lineWidth = 1;
  for (let step = size / 4; step < size; step += size / 4) {
    context.beginPath();
    context.moveTo(step, 0);
    context.lineTo(step, size);
    context.moveTo(0, step);
    context.lineTo(size, step);
    context.stroke();
  }
  return context.canvas.toDataURL('image/png');
};

export const bubbleTextureFactory: TextureFactory = () => {
  const size = 256;
  const context = createCanvas(size);
  const gradient = context.createRadialGradient(size * 0.35, size * 0.3, size * 0.05, size * 0.5, size * 0.5, size * 0.7);
  gradient.addColorStop(0, '#bff4ff');
  gradient.addColorStop(0.45, '#4fc3f7');
  gradient.addColorStop(1, '#1a237e');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  context.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  context.lineWidth = 2;
  for (let ring = 24; ring < size / 2; ring += 26) {
    context.beginPath();
    context.arc(size / 2, size / 2, ring, 0, Math.PI * 2);
    context.stroke();
  }
  return context.canvas.toDataURL('image/png');
};

export class TextureCache {
  private readonly loader = new THREE.TextureLoader();
  private readonly entries = new Map<string, THREE.Texture>();

  async load(key: string, factory: TextureFactory, repeat = 1): Promise<THREE.Texture> {
    const cached = this.entries.get(key);
    if (cached) return cached;
    const texture = await this.loader.loadAsync(factory());
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeat, repeat);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    this.entries.set(key, texture);
    return texture;
  }

  dispose(): void {
    for (const texture of this.entries.values()) texture.dispose();
    this.entries.clear();
  }
}
