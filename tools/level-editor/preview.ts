import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createSurfaceMaterials } from '../../src/art/materials';
import { createPhysicsWorld } from '../../src/engine/physics';
import { buildLevel } from '../../src/game/world';
import { cellToWorld } from '../../src/levels/grid';
import type { Level } from '../../src/levels/schema';

export type Preview = { show: (level: Level) => void; resize: () => void; dispose: () => void };

const disposeScene = (scene: THREE.Scene) =>
  scene.traverse((o) => {
    if (o instanceof THREE.Mesh) o.geometry.dispose();
  });

/** Orbitable 3D view of the level, rebuilt with the game's own level builder. Call initPhysics() first. */
export const createPreview = (canvas: HTMLCanvasElement): Preview => {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 600);
  const controls = new OrbitControls(camera, canvas);
  const materials = createSurfaceMaterials();
  let scene = new THREE.Scene();
  let physics: ReturnType<typeof createPhysicsWorld> | undefined;
  let framed = false;

  const render = () => renderer.render(scene, camera);
  controls.addEventListener('change', render);

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = canvas;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    render();
  };

  const show = (level: Level) => {
    disposeScene(scene);
    physics?.free();
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xcde9ff);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x9cb3d8, 1.3));
    const sun = new THREE.DirectionalLight(0xfff1dc, 1.4);
    sun.position.set(30, 60, 20);
    scene.add(sun);
    physics = createPhysicsWorld();
    const world = buildLevel({ world: physics, scene, materials }, level);
    world.crystals.forEach((c) => c.animate(0, 0));
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 20, 12),
      new THREE.MeshStandardMaterial({ color: 0xff5d86 }),
    );
    const [x, y, z] = cellToWorld(level.spawn.cell);
    ball.position.set(x, y + 0.42, z);
    scene.add(ball);

    if (!framed) {
      const box = new THREE.Box3().setFromArray(world.track.vertices);
      const centre = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3()).length() || 20;
      controls.target.copy(centre);
      camera.position.set(centre.x + size * 0.35, centre.y + size * 0.6, centre.z + size * 0.6);
      controls.update();
      framed = true;
    }
    resize();
  };

  return {
    show,
    resize,
    dispose: () => {
      controls.dispose();
      disposeScene(scene);
      physics?.free();
      renderer.dispose();
    },
  };
};
