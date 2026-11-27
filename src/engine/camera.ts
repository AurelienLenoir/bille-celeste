import * as THREE from 'three';
import type { GravityDirection } from './physics';

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const OFFSET = new THREE.Vector3(0, 5.6, 8.6);
const LOOK_AHEAD_Z = 1.8;
/** Horizontal follow rate (1/s). */
const FOLLOW_RATE = 6;
/** Vertical follow is softer so bumps, joints and small hops do not shake the view. */
const VERTICAL_FOLLOW_RATE = 3.5;
/** The aim point lags a little behind the ball, which hides the last bits of physics jitter. */
const LOOK_RATE = 14;

export type FollowCamera = {
  camera: THREE.PerspectiveCamera;
  snapTo: (x: number, y: number, z: number) => void;
  update: (target: THREE.Vector3, gravity: GravityDirection, dt: number) => void;
};

/** Frame-rate independent exponential smoothing factor. */
export const followFactor = (rate: number, dt: number): number => 1 - Math.exp(-dt * rate);

/**
 * Follows the ball and rolls with the tilt: the camera's "up" is the opposite of gravity,
 * so the course looks tilted while its colliders never move.
 */
export const createFollowCamera = (): FollowCamera => {
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
  const position = new THREE.Vector3(0, 6, 10);
  const aim = new THREE.Vector3(0, 0, -LOOK_AHEAD_Z);
  const up = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const offset = new THREE.Vector3();
  const desired = new THREE.Vector3();

  const snapTo = (x: number, y: number, z: number) => {
    position.set(x, y + 6, z + 9);
    aim.set(x, y, z - LOOK_AHEAD_Z);
  };

  const update = (target: THREE.Vector3, gravity: GravityDirection, dt: number) => {
    up.set(-gravity.x, -gravity.y, -gravity.z);
    rotation.setFromUnitVectors(WORLD_UP, up);
    offset.copy(OFFSET).applyQuaternion(rotation);
    desired.copy(target).add(offset);
    const horizontal = followFactor(FOLLOW_RATE, dt);
    position.x += (desired.x - position.x) * horizontal;
    position.z += (desired.z - position.z) * horizontal;
    position.y += (desired.y - position.y) * followFactor(VERTICAL_FOLLOW_RATE, dt);
    aim.lerp(desired.set(target.x, target.y, target.z - LOOK_AHEAD_Z), followFactor(LOOK_RATE, dt));
    camera.position.copy(position);
    camera.up.copy(up);
    camera.lookAt(aim);
  };

  return { camera, snapTo, update };
};
