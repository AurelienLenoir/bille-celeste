import * as THREE from 'three';
import type { GravityDirection } from './physics';

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const OFFSET = new THREE.Vector3(0, 5.6, 8.6);
const LOOK_AHEAD_Z = 1.8;
const FOLLOW_RATE = 6;

export type FollowCamera = {
  camera: THREE.PerspectiveCamera;
  snapTo: (x: number, y: number, z: number) => void;
  update: (target: THREE.Vector3, gravity: GravityDirection, dt: number) => void;
};

/**
 * Follows the ball and rolls with the tilt: the camera's "up" is the opposite of gravity,
 * so the course looks tilted while its colliders never move.
 */
export const createFollowCamera = (): FollowCamera => {
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
  const position = new THREE.Vector3(0, 6, 10);
  const up = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const offset = new THREE.Vector3();
  const desired = new THREE.Vector3();
  const look = new THREE.Vector3();

  const snapTo = (x: number, y: number, z: number) => {
    position.set(x, y + 6, z + 9);
  };

  const update = (target: THREE.Vector3, gravity: GravityDirection, dt: number) => {
    up.set(-gravity.x, -gravity.y, -gravity.z);
    rotation.setFromUnitVectors(WORLD_UP, up);
    offset.copy(OFFSET).applyQuaternion(rotation);
    desired.copy(target).add(offset);
    position.lerp(desired, 1 - Math.exp(-dt * FOLLOW_RATE));
    camera.position.copy(position);
    camera.up.copy(up);
    look.copy(target);
    look.z -= LOOK_AHEAD_Z;
    camera.lookAt(look);
  };

  return { camera, snapTo, update };
};
