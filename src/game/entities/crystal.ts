import * as THREE from 'three';
import { CRYSTAL_HUES } from '../../art/palette';
import type { Vec3Tuple } from '../../engine/math';

const geometry = (() => {
  const g = new THREE.OctahedronGeometry(0.3, 0);
  g.scale(1, 1.6, 1);
  return g;
})();

export type Crystal = {
  /** Where the crystal is now: its cell, unless a magnet is pulling it. */
  position: Vec3Tuple;
  /** Moves the crystal `distance` units towards `target` (magnet). */
  pull: (target: Vec3Tuple, distance: number) => void;
  taken: boolean;
  collect: () => void;
  reset: () => void;
  animate: (clock: number, dt: number) => void;
};

export const createCrystal = (scene: THREE.Scene, position: Vec3Tuple, index: number): Crystal => {
  const hue = CRYSTAL_HUES[index % CRYSTAL_HUES.length] ?? CRYSTAL_HUES[0];
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color: hue,
      emissive: hue,
      emissiveIntensity: 0.45,
      flatShading: true,
      roughness: 0.15,
    }),
  );
  mesh.castShadow = true;
  scene.add(mesh);

  /** Pop-out animation progress after pickup: 1 → 0. */
  let fade = 0;
  const home = position;
  const crystal: Crystal = {
    position,
    pull: (target, distance) => {
      const [x, y, z] = crystal.position;
      const d = Math.hypot(target[0] - x, target[1] - y, target[2] - z);
      const k = d > distance ? distance / d : 1;
      crystal.position = [x + (target[0] - x) * k, y + (target[1] - y) * k, z + (target[2] - z) * k];
    },
    taken: false,
    collect: () => {
      crystal.taken = true;
      fade = 1;
    },
    reset: () => {
      crystal.position = home;
      crystal.taken = false;
      fade = 0;
      mesh.visible = true;
      mesh.scale.setScalar(1);
    },
    animate: (clock, dt) => {
      if (crystal.taken) {
        if (fade > 0) {
          fade = Math.max(0, fade - dt * 4);
          mesh.scale.setScalar(fade * 1.6);
          mesh.position.y += dt * 3;
        }
        mesh.visible = fade > 0;
        return;
      }
      const [x, y, z] = crystal.position;
      mesh.position.set(x, y + 0.75 + Math.sin(clock * 2.4 + index) * 0.12, z);
      mesh.rotation.y = clock * 1.8 + index;
    },
  };
  return crystal;
};
