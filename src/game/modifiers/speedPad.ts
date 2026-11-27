import * as THREE from 'three';
import { cellToWorld } from '../../levels/grid';
import type { ModifierOf } from '../../levels/schema';
import { direction, mergeGeometries, padTrigger, type ModifierModule } from './kit';

type SpeedPad = ModifierOf<'speedPad'>;

/** New velocity after crossing the pad: at least `speed` along its direction, sideways speed kept. */
export const padVelocity = (v: { x: number; y: number; z: number }, dir: { x: number; z: number }, speed: number) => {
  const along = v.x * dir.x + v.z * dir.z;
  const boost = Math.max(0, speed - along);
  return { x: v.x + dir.x * boost, y: v.y, z: v.z + dir.z * boost };
};

/** Plate with three chevrons pointing forward (local -z). */
const padGeometry = () => {
  const parts: THREE.BufferGeometry[] = [new THREE.BoxGeometry(1.6, 0.06, 1.6).translate(0, 0.03, 0)];
  for (const f of [-0.45, 0, 0.45]) {
    for (const side of [-1, 1]) {
      const bar = new THREE.BoxGeometry(0.5, 0.05, 0.12);
      bar.rotateY((-side * Math.PI) / 4);
      bar.translate(side * 0.16, 0.08, f - 0.16);
      parts.push(bar);
    }
  }
  return mergeGeometries(parts);
};

/** Speed pad (bonus): launches the ball in its direction. */
export const speedPad: ModifierModule<SpeedPad> = {
  kind: 'bonus',
  sound: [
    { frequency: 220, to: 880, duration: 0.25, wave: 'sawtooth', volume: 0.06 },
    { frequency: 900, to: 3200, duration: 0.3, wave: 'noise', volume: 0.12 },
  ],
  haptic: 'medium',
  trigger: (m) => padTrigger(m),
  create: (ctx, m) => {
    const material = new THREE.MeshStandardMaterial({ color: 0xff9a3d, emissive: 0xff6a00, emissiveIntensity: 0.4 });
    const mesh = new THREE.Mesh(padGeometry(), material);
    const [x, y, z] = cellToWorld(m.cell);
    mesh.position.set(x, y, z);
    mesh.rotation.y = (-m.rot * Math.PI) / 180;
    mesh.receiveShadow = true;
    ctx.scene.add(mesh);
    const dir = direction(m.rot);
    let flash = 0;
    let lastClock = 0;
    return {
      trigger: padTrigger(m),
      onEnter: (run) => {
        run.ball.launch(padVelocity(run.ball.velocity(), dir, m.speed));
        flash = 1;
        run.fire();
      },
      reset: () => (flash = 0),
      syncMesh: (_alpha, clock) => {
        flash = Math.max(0, flash - (clock - lastClock) * 3);
        lastClock = clock;
        material.emissiveIntensity = 0.35 + Math.sin(clock * 6) * 0.15 + flash;
      },
    };
  },
};
