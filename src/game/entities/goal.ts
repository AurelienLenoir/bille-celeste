import * as THREE from 'three';
import { GOAL_OPEN, INACTIVE } from '../../art/palette';
import type { Vec3Tuple } from '../../engine/math';

export type Goal = {
  x: number;
  y: number;
  z: number;
  open: () => void;
  reset: () => void;
  animate: (clock: number, isOpen: boolean) => void;
};

/** Finish ring: grey while crystals remain, golden and spinning once it opens. */
export const createGoal = (scene: THREE.Object3D, [x, y, z]: Vec3Tuple): Goal => {
  const material = new THREE.MeshStandardMaterial({
    color: INACTIVE,
    emissive: 0x000000,
    metalness: 0.3,
    roughness: 0.3,
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.16, 14, 40), material);
  ring.position.set(x, y + 1.3, z);
  ring.castShadow = true;
  scene.add(ring);

  return {
    x,
    y,
    z,
    open: () => {
      material.color.set(GOAL_OPEN.color);
      material.emissive.set(GOAL_OPEN.emissive);
    },
    reset: () => {
      material.color.set(INACTIVE);
      material.emissive.set(0x000000);
    },
    animate: (clock, isOpen) => {
      ring.rotation.y = isOpen ? clock * 1.5 : Math.sin(clock) * 0.2;
    },
  };
};
