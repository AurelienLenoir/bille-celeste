import * as THREE from 'three';
import { CRYSTAL_HUES } from '../../art/palette';
import type { Vec3Tuple } from '../../engine/math';

const geometry = (() => {
  const g = new THREE.OctahedronGeometry(0.3, 0);
  g.scale(1, 1.6, 1);
  return g;
})();

export type Crystal = {
  position: Vec3Tuple;
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
  const crystal: Crystal = {
    position,
    taken: false,
    collect: () => {
      crystal.taken = true;
      fade = 1;
    },
    reset: () => {
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
      const [x, y, z] = position;
      mesh.position.set(x, y + 0.75 + Math.sin(clock * 2.4 + index) * 0.12, z);
      mesh.rotation.y = clock * 1.8 + index;
    },
  };
  return crystal;
};
