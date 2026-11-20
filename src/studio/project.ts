/**
 * Projeto do Studio: arquivos em memória + persistência local.
 *
 * O projeto de exemplo usa a estrutura sugerida pela especificação
 * (core/, arms/, legs/, modules/, assets/) com código Bubble real que
 * compila sem erros no núcleo provisório 0.1.
 */

export interface ProjectFile {
  path: string;
  content: string;
}

export interface Project {
  name: string;
  files: ProjectFile[];
}

export const PROJECT_STORAGE_KEY = 'bubble.studio.project.v1';

const MAIN_BUBBLE = `// Bubble Studio 0.1 — projeto de exemplo
// Criado por Ruan. Todo o código abaixo é Bubble, não JavaScript.
module main

use core.game.performance.frame_budget
use core.game.rendering.pipeline

const LIMITE_ENERGIA: num = 100

struct Bloco {
  id: num
  dureza: num
}

let energia: num = 100

fn aplicar_dano(base: num, multiplicador: num) -> num {
  let total: num = base * multiplicador
  if total > energia {
    return energia
  }
  return total
}

fn criar_rotulo(nome: text) -> text {
  return "Bubble: " + nome
}

on start {
  print(criar_rotulo("Minecraft Bubble Edition"))
  let materiais: list<text> = ["grama", "pedra", "areia"]
  for material in materiais {
    print(material)
  }
  let camera: vec3 = vec3(0, 2, 8)
  let altura: num = camera.y
  print("altura da câmera")
}

on update {
  energia = energia - 0.1
  if energia < 0 {
    energia = 0
  }
}
`;

const FRAME_BUDGET_BUBBLE = `// Orçamento de quadro — core/game/performance
module core.game.performance.frame_budget

const ALVO_FPS: num = 60

fn orcamento_ms(alvo: num) -> num {
  if alvo <= 0 {
    return 16.6
  }
  return 1000 / alvo
}

fn dentro_do_orcamento(tempo_ms: num) -> bool {
  return tempo_ms <= orcamento_ms(ALVO_FPS)
}
`;

const RENDERING_BUBBLE = `// Pipeline de renderização — core/game/rendering
module core.game.rendering.pipeline

struct Camera {
  fov: num
  near: num
  far: num
}

fn distancia_visivel(camera: Camera) -> num {
  return camera.far - camera.near
}

fn campo_visual_valido(fov: num) -> bool {
  return fov > 0 and fov < 180
}
`;

const STRUCTURE_JSON = `{
  "format": "bubble-arms",
  "version": "0.1",
  "project": "Minecraft Bubble Edition",
  "scene": {
    "objects": [
      { "id": "world", "type": "group" },
      { "id": "camera", "type": "camera", "fov": 60 }
    ]
  }
}
`;

const MANIFEST_JSON = `{
  "format": "bubble-manifest",
  "name": "MinecraftBubbleEdition",
  "version": "0.1.0",
  "entry": "core/main.bubble",
  "executor": { "minVersion": "0.1" },
  "permissions": []
}
`;

const ENGINE_HTML = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Minecraft Bubble Edition — engine</title>
  </head>
  <body>
    <!-- Estrutura de interface (LEGS). A renderização 3D pertence ao Omni 3D. -->
    <canvas id="omni-viewport"></canvas>
    <div id="hud"></div>
  </body>
</html>
`;

export const SAMPLE_PROJECT: Project = {
  name: 'Minecraft Bubble Edition',
  files: [
    { path: 'manifest.json', content: MANIFEST_JSON },
    { path: 'core/main.bubble', content: MAIN_BUBBLE },
    { path: 'core/game/performance/frame_budget.bubble', content: FRAME_BUDGET_BUBBLE },
    { path: 'core/game/rendering/pipeline.bubble', content: RENDERING_BUBBLE },
    { path: 'arms/structure.json', content: STRUCTURE_JSON },
    { path: 'legs/engine.html', content: ENGINE_HTML },
  ],
};

export function createSampleProject(): Project {
  return {
    name: SAMPLE_PROJECT.name,
    files: SAMPLE_PROJECT.files.map((file) => ({ ...file })),
  };
}

export function loadProject(): Project {
  try {
    const raw = window.localStorage.getItem(PROJECT_STORAGE_KEY);
    if (!raw) return createSampleProject();
    const parsed = JSON.parse(raw) as Project;
    if (!parsed || !Array.isArray(parsed.files) || parsed.files.length === 0) {
      return createSampleProject();
    }
    const files = parsed.files.filter(
      (file) => typeof file?.path === 'string' && typeof file?.content === 'string',
    );
    if (files.length === 0) return createSampleProject();
    return { name: typeof parsed.name === 'string' ? parsed.name : 'Projeto', files };
  } catch {
    return createSampleProject();
  }
}

export function saveProject(project: Project): void {
  try {
    window.localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project));
  } catch {
    /* quota cheia ou modo privado: o projeto continua em memória */
  }
}

export function bubbleFiles(project: Project): ProjectFile[] {
  return project.files.filter((file) => file.path.endsWith('.bubble'));
}

/** Normaliza caminhos digitados pelo usuário. */
export function normalizePath(path: string): string {
  return path
    .trim()
    .replace(/^\/+/, '')
    .replace(/\/{2,}/g, '/')
    .replace(/\/+$/, '');
}

export function fileNameOf(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1] ?? path;
}

export function directoryOf(path: string): string {
  const index = path.lastIndexOf('/');
  return index === -1 ? '' : path.slice(0, index);
}
