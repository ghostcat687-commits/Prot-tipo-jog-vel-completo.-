/**
 * Cena de prévia do Studio (lógica separada da renderização e da interface).
 *
 * Contém apenas a descrição do mundo: câmera-alvo, luzes, materiais, objetos e
 * a atualização por quadro. Quem desenha é `PreviewEngine`; quem controla é a
 * interface React.
 */

import * as THREE from 'three';
import { TextureCache, bubbleTextureFactory, gridTextureFactory } from '../assets/TextureCache';

export interface StudioScene {
  scene: THREE.Scene;
  update: (delta: number) => void;
  setShadowQuality: (size: number) => void;
  dispose: () => void;
}

interface SpinningBlock {
  mesh: THREE.Mesh;
  baseY: number;
  phase: number;
  speed: number;
}

const SHADER_VERTEX = `
  varying vec2 vUv;
  varying vec3 vNormal;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SHADER_FRAGMENT = `
  uniform float uTime;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  varying vec2 vUv;
  varying vec3 vNormal;
  void main() {
    float bands = sin(vUv.y * 24.0 + uTime * 1.6) * 0.5 + 0.5;
    float rim = pow(1.0 - abs(vNormal.z), 2.0);
    vec3 color = mix(uColorA, uColorB, bands);
    color += rim * 0.35;
    gl_FragColor = vec4(color, 1.0);
  }
`;

export async function buildStudioScene(textures: TextureCache): Promise<StudioScene> {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#070b14');
  scene.fog = new THREE.Fog('#070b14', 14, 34);

  const disposables: { dispose: () => void }[] = [];
  const blocks: SpinningBlock[] = [];

  // ---------------------------------------------------------------- luzes
  const ambient = new THREE.AmbientLight('#9fd8ff', 0.55);
  const hemisphere = new THREE.HemisphereLight('#8fe8ff', '#0b1220', 0.7);
  const key = new THREE.DirectionalLight('#ffffff', 2.1);
  key.position.set(6, 9, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 40;
  key.shadow.camera.left = -12;
  key.shadow.camera.right = 12;
  key.shadow.camera.top = 12;
  key.shadow.camera.bottom = -12;
  const rim = new THREE.PointLight('#4fc3f7', 40, 30);
  rim.position.set(-6, 4, -6);
  scene.add(ambient, hemisphere, key, rim);

  // ---------------------------------------------------------------- piso
  const gridTexture = await textures.load('grid', gridTextureFactory, 12);
  const floorGeometry = new THREE.PlaneGeometry(28, 28);
  const floorMaterial = new THREE.MeshStandardMaterial({
    map: gridTexture,
    roughness: 0.65,
    metalness: 0.15,
    color: '#8fbcd4',
  });
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  disposables.push(floorGeometry, floorMaterial);

  // ---------------------------------------------------------------- blocos
  const blockTexture = await textures.load('bubble', bubbleTextureFactory);
  const blockGeometry = new THREE.BoxGeometry(1.2, 1.2, 1.2);
  const blockMaterial = new THREE.MeshStandardMaterial({
    map: blockTexture,
    roughness: 0.35,
    metalness: 0.45,
  });
  disposables.push(blockGeometry, blockMaterial);

  const positions: [number, number][] = [
    [-3.2, -2.2],
    [0, -2.2],
    [3.2, -2.2],
    [-3.2, 1],
    [0, 1],
    [3.2, 1],
  ];
  positions.forEach(([x, z], index) => {
    const mesh = new THREE.Mesh(blockGeometry, blockMaterial);
    mesh.position.set(x, 0.7, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    blocks.push({
      mesh,
      baseY: 0.7,
      phase: index * 0.9,
      speed: 0.35 + index * 0.07,
    });
  });

  // ---------------------------------------------------------------- esfera com shader
  const sphereGeometry = new THREE.IcosahedronGeometry(1.9, 3);
  const shaderMaterial = new THREE.ShaderMaterial({
    vertexShader: SHADER_VERTEX,
    fragmentShader: SHADER_FRAGMENT,
    uniforms: {
      uTime: { value: 0 },
      uColorA: { value: new THREE.Color('#22d3ee') },
      uColorB: { value: new THREE.Color('#7c3aed') },
    },
  });
  const sphere = new THREE.Mesh(sphereGeometry, shaderMaterial);
  sphere.position.set(0, 3.1, 0);
  sphere.castShadow = true;
  scene.add(sphere);
  disposables.push(sphereGeometry, shaderMaterial);

  // ---------------------------------------------------------------- animação
  const update = (delta: number): void => {
    const time = performance.now() / 1000;
    for (const block of blocks) {
      block.mesh.rotation.y += delta * block.speed;
      block.mesh.position.y = block.baseY + Math.sin(time * 0.9 + block.phase) * 0.16;
    }
    sphere.rotation.y += delta * 0.25;
    sphere.position.y = 3.1 + Math.sin(time * 0.6) * 0.18;
    shaderMaterial.uniforms.uTime.value = time;
  };

  const setShadowQuality = (size: number): void => {
    if (key.shadow.mapSize.x === size) return;
    key.shadow.mapSize.set(size, size);
    key.shadow.map?.dispose();
    key.shadow.map = null;
  };

  const dispose = (): void => {
    for (const disposable of disposables) disposable.dispose();
    key.shadow.map?.dispose();
    scene.clear();
  };

  return { scene, update, setShadowQuality, dispose };
}
