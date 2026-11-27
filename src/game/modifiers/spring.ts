import * as THREE from 'three';
import { GRAVITY } from '../../engine/physics';
import { cellToWorld } from '../../levels/grid';
import type { ModifierOf } from '../../levels/schema';
import { direction, mergeGeometries, padTrigger, type ModifierModule } from './kit';

type Spring = ModifierOf<'spring'>;

/** Upward speed that lifts the ball `height` units against normal gravity. */
export const launchSpeed = (height: number): number => Math.sqrt(2 * GRAVITY * height);

/** Velocity given by the spring: straight up (sideways speed kept), or in an arc along `rot`. */
export const springVelocity = (m: Pick<Spring, 'rot' | 'height' | 'forward'>, v: { x: number; z: number }) => {
  const dir = direction(m.rot);
  const y = launchSpeed(m.height);
  if (!m.forward) return { x: v.x, y, z: v.z };
  return { x: dir.x * m.forward, y, z: dir.z * m.forward };
};

/** Where the ball comes down at the launch height (flat ground, normal gravity). */
export const springLanding = (m: Spring): [number, number, number] => {
  const [x, y, z] = cellToWorld(m.cell);
  const flight = (2 * launchSpeed(m.height)) / GRAVITY;
  const dir = direction(m.rot);
  return [x + dir.x * m.forward * flight, y, z + dir.z * m.forward * flight];
};

const springGeometry = () => {
  const parts: THREE.BufferGeometry[] = [new THREE.CylinderGeometry(0.75, 0.8, 0.1, 20).translate(0, 0.05, 0)];
  for (let i = 0; i < 3; i++)
    parts.push(new THREE.TorusGeometry(0.42, 0.05, 6, 18).rotateX(Math.PI / 2).translate(0, 0.14 + i * 0.09, 0));
  parts.push(new THREE.CylinderGeometry(0.6, 0.6, 0.06, 20).translate(0, 0.42, 0));
  return mergeGeometries(parts);
};

/** Spring (bonus): bounces the ball up, or launches it in an arc. */
export const spring: ModifierModule<Spring> = {
  kind: 'bonus',
  sound: [
    { frequency: 180, to: 640, duration: 0.3, wave: 'sine', volume: 0.14 },
    { frequency: 360, to: 940, duration: 0.25, wave: 'triangle', volume: 0.06, at: 0.04 },
  ],
  haptic: 'medium',
  trigger: (m) => padTrigger(m, 0.7),
  create: (ctx, m) => {
    const material = new THREE.MeshStandardMaterial({ color: 0x5fd17a, emissive: 0x1f8a3a, emissiveIntensity: 0.25 });
    const mesh = new THREE.Mesh(springGeometry(), material);
    const [x, y, z] = cellToWorld(m.cell);
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    ctx.scene.add(mesh);
    let squash = 0;
    let lastClock = 0;
    return {
      trigger: padTrigger(m, 0.7),
      onEnter: (run) => {
        run.ball.launch(springVelocity(m, run.ball.velocity()));
        squash = 1;
        run.fire();
      },
      reset: () => (squash = 0),
      syncMesh: (_alpha, clock) => {
        squash = Math.max(0, squash - (clock - lastClock) * 4);
        lastClock = clock;
        mesh.scale.y = 1 + Math.sin(squash * Math.PI * 3) * squash * 0.5;
      },
    };
  },
};
