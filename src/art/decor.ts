import * as THREE from 'three';
import { createRandom } from '../engine/math';
import { DECOR } from './palette';

export type Decor = { update: (clock: number, dt: number) => void };

const ISLANDS = 16;
const CLOUDS = 12;

/** Floating islands and drifting clouds on both sides of the course. */
export const createDecor = (scene: THREE.Scene, seed: number): Decor => {
  const rnd = createRandom(seed);
  const rock = new THREE.MeshStandardMaterial({ color: DECOR.rock, flatShading: true });
  const grass = new THREE.MeshStandardMaterial({ color: DECOR.grass, flatShading: true });
  const leaf = new THREE.MeshStandardMaterial({ color: DECOR.leaf, flatShading: true });
  const cloud = new THREE.MeshStandardMaterial({
    color: DECOR.cloud,
    emissive: DECOR.cloud,
    emissiveIntensity: 0.25,
    flatShading: true,
  });

  for (let i = 0; i < ISLANDS; i++) {
    const side = i % 2 ? 1 : -1;
    const r = 1.8 + rnd() * 2.5;
    const group = new THREE.Group();
    const base = new THREE.Mesh(new THREE.ConeGeometry(r, r * 1.8, 7), rock);
    base.rotation.x = Math.PI;
    base.position.y = -r * 0.9;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.35, 7), grass);
    group.add(base, top);
    for (let t = 0; t < 1 + rnd() * 3; t++) {
      const tree = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.6, 6), leaf);
      tree.position.set((rnd() - 0.5) * r, 1, (rnd() - 0.5) * r);
      group.add(tree);
    }
    group.position.set(7 + side * (16 + rnd() * 14), -12 + rnd() * 9, 8 - rnd() * 100);
    scene.add(group);
  }

  const clouds: THREE.Group[] = [];
  for (let i = 0; i < CLOUDS; i++) {
    const group = new THREE.Group();
    for (let k = 0; k < 4; k++) {
      const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(1 + rnd() * 1.2, 1), cloud);
      puff.position.set(k * 1.4, rnd() * 0.6, rnd() * 0.8);
      group.add(puff);
    }
    const side = i % 2 ? 1 : -1;
    group.position.set(7 + side * (22 + rnd() * 16), -2 + rnd() * 10, 10 - rnd() * 100);
    scene.add(group);
    clouds.push(group);
  }

  return {
    update: (clock, dt) => {
      clouds.forEach((c, i) => {
        c.position.x += Math.sin(clock * 0.2 + i) * dt * 0.3;
      });
    },
  };
};
