import * as THREE from 'three';
import type { Vec3Tuple } from '../../engine/math';

export const GEM_COLOUR = 0xb05bff;

export type HiddenGem = {
  position: Vec3Tuple;
  taken: boolean;
  collect: () => void;
  reset: () => void;
  animate: (clock: number, dt: number) => void;
};

/** The level's optional gem, off the main path (PLAN.md § 5.3): faceted, purple, slowly turning. */
export const createHiddenGem = (scene: THREE.Object3D, position: Vec3Tuple): HiddenGem => {
  const geometry = new THREE.OctahedronGeometry(0.34, 1);
  geometry.scale(1, 1.25, 1);
  const material = new THREE.MeshStandardMaterial({
    color: GEM_COLOUR,
    emissive: 0x6a1fd0,
    emissiveIntensity: 0.55,
    flatShading: true,
    roughness: 0.1,
    metalness: 0.3,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  scene.add(mesh);
  let fade = 0;
  const gem: HiddenGem = {
    position,
    taken: false,
    collect: () => {
      gem.taken = true;
      fade = 1;
    },
    reset: () => {
      gem.taken = false;
      fade = 0;
      mesh.visible = true;
      mesh.scale.setScalar(1);
    },
    animate: (clock, dt) => {
      if (gem.taken) {
        fade = Math.max(0, fade - dt * 2.5);
        mesh.scale.setScalar(fade * 2);
        mesh.position.y += dt * 4;
        mesh.rotation.y += dt * 12;
        mesh.visible = fade > 0;
        return;
      }
      const [x, y, z] = position;
      mesh.position.set(x, y + 0.8 + Math.sin(clock * 1.7) * 0.15, z);
      mesh.rotation.y = clock * 0.9;
      material.emissiveIntensity = 0.45 + Math.max(0, Math.sin(clock * 3)) * 0.4;
    },
  };
  return gem;
};
