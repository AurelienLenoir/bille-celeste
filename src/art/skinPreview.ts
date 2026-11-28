import * as THREE from 'three';
import type { SkinLook } from '../meta/skins';
import { createSkinMaterial } from './skinMaterial';

export type SkinPreview = { show: (look: SkinLook) => void; dispose: () => void };

/** A ball turning slowly on its own small canvas (shop). Released when the shop closes. */
export const createSkinPreview = (canvas: HTMLCanvasElement): SkinPreview => {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const size = () => renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  size();
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9cb3d8, 1.3));
  const sun = new THREE.DirectionalLight(0xfff1dc, 1.8);
  sun.position.set(2, 3, 4);
  scene.add(sun);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
  camera.position.set(0, 0.25, 3.2);
  camera.lookAt(0, 0, 0);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.8, 48, 32));
  ball.rotation.x = 0.35;
  scene.add(ball);
  let frame = 0;
  let last = performance.now();
  const loop = (now: number) => {
    ball.rotation.y += ((now - last) / 1000) * 0.9;
    last = now;
    renderer.render(scene, camera);
    frame = requestAnimationFrame(loop);
  };
  frame = requestAnimationFrame(loop);
  const release = () => {
    const material = ball.material;
    if (material instanceof THREE.MeshPhysicalMaterial) {
      material.map?.dispose();
      material.dispose();
    }
  };
  return {
    show: (look) => {
      release();
      ball.material = createSkinMaterial(look);
      size();
    },
    dispose: () => {
      cancelAnimationFrame(frame);
      release();
      ball.geometry.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
};
