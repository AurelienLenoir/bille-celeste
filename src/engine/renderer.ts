import * as THREE from 'three';

export type RenderContext = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  sun: THREE.DirectionalLight;
};

type SceneLook = { background: THREE.Texture; fogColor: number; fogNear: number; fogFar: number };

export const createRenderContext = (canvas: HTMLCanvasElement, look: SceneLook): RenderContext => {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = look.background;
  scene.fog = new THREE.Fog(look.fogColor, look.fogNear, look.fogFar);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x9cb3d8, 1.15));
  const sun = new THREE.DirectionalLight(0xfff1dc, 1.7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 60 });
  sun.shadow.bias = -0.0005;
  scene.add(sun, sun.target);

  return { renderer, scene, sun };
};

/** Keeps the single shadow-casting light centred on the target so the shadow map stays small. */
export const followSun = (sun: THREE.DirectionalLight, target: THREE.Vector3): void => {
  sun.position.set(target.x + 8, target.y + 16, target.z + 6);
  sun.target.position.copy(target);
};

export const bindResize = (renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera): void => {
  const resize = () => {
    const w = innerWidth;
    const h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < h ? 62 : 50;
    camera.updateProjectionMatrix();
  };
  addEventListener('resize', resize);
  resize();
};
