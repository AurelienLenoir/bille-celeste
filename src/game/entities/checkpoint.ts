import * as THREE from 'three';
import { CHECKPOINT_ON, INACTIVE } from '../../art/palette';
import type { Vec3Tuple } from '../../engine/math';

const flagGeometry = (() => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, -0.5, 0, 0.75, -0.25, 0], 3));
  g.computeVertexNormals();
  return g;
})();

/** The flag stands beside the respawn point so it does not block the ball. */
const FLAG_OFFSET_X = -2.4;

export type Checkpoint = {
  x: number;
  y: number;
  z: number;
  active: boolean;
  activate: () => void;
  reset: () => void;
};

export const createCheckpoint = (scene: THREE.Scene, [x, y, z]: Vec3Tuple): Checkpoint => {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 1.6, 8),
    new THREE.MeshStandardMaterial({ color: 0xffffff }),
  );
  pole.position.y = 0.8;
  const material = new THREE.MeshStandardMaterial({ color: INACTIVE, side: THREE.DoubleSide });
  const flag = new THREE.Mesh(flagGeometry, material);
  flag.position.set(0.05, 1.55, 0);
  group.add(pole, flag);
  group.position.set(x + FLAG_OFFSET_X, y, z);
  group.traverse((o) => {
    o.castShadow = true;
  });
  scene.add(group);

  const checkpoint: Checkpoint = {
    x,
    y,
    z,
    active: false,
    activate: () => {
      checkpoint.active = true;
      material.color.set(CHECKPOINT_ON);
    },
    reset: () => {
      checkpoint.active = false;
      material.color.set(INACTIVE);
    },
  };
  return checkpoint;
};
