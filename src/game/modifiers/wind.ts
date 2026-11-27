import * as THREE from 'three';
import type { ModifierOf } from '../../levels/schema';
import { direction, zoneTrigger, type ModifierModule } from './kit';

type Wind = ModifierOf<'wind'>;

/** Share of each gust period during which the wind blows. */
const GUST_SHARE = 0.45;
const STREAKS = 28;

/**
 * Strength factor of the wind after `time` seconds: 1 when steady; with gusts, a smooth swell up
 * to 1.6 during the first part of each period, then a light breeze.
 */
export const windFactor = (gusts: number, time: number): number => {
  if (!gusts) return 1;
  const phase = (time % gusts) / gusts;
  return phase < GUST_SHARE ? 0.15 + 1.45 * Math.sin((Math.PI * phase) / GUST_SHARE) : 0.15;
};

/** Wind zone (malus): pushes the ball sideways, steadily or in gusts; streaks show the direction. */
export const wind: ModifierModule<Wind> = {
  kind: 'malus',
  sound: [{ frequency: 300, to: 1300, duration: 0.7, wave: 'noise', volume: 0.12 }],
  haptic: 'light',
  trigger: zoneTrigger,
  create: (ctx, m) => {
    const t = zoneTrigger(m);
    if (t.kind !== 'box') throw new Error('wind zone must be a box');
    const dir = direction(m.rot);
    const positions = new Float32Array(STREAKS * 6);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
    const lines = new THREE.LineSegments(geometry, material);
    lines.frustumCulled = false;
    ctx.scene.add(lines);
    // Each streak has a fixed lane and height and a starting offset along the wind.
    const size = { x: t.max[0] - t.min[0], z: t.max[2] - t.min[2] };
    const span = Math.abs(dir.x) ? size.x : size.z;
    const seeds = Array.from({ length: STREAKS }, (_, i) => [
      ((i * 0.618) % 1) * span,
      (i * 0.381 + 0.17) % 1,
      0.2 + ((i * 0.27) % 1) * 1.2,
    ]);
    let time = 0;
    return {
      trigger: t,
      step: (dt) => (time += dt),
      onEnter: (run) => run.fire(),
      inside: (run) => {
        const a = m.strength * windFactor(m.gusts, time);
        run.effects.push.x += dir.x * a;
        run.effects.push.z += dir.z * a;
      },
      reset: () => (time = 0),
      syncMesh: (_alpha, clock) => {
        const factor = windFactor(m.gusts, time);
        const speed = 4 + m.strength;
        const length = 0.4 + factor * 0.6;
        seeds.forEach(([offset = 0, lane = 0, height = 0], i) => {
          const along = (offset + clock * speed) % span;
          // Position in the zone: `along` follows the wind, `lane` crosses it.
          const from = Math.abs(dir.x) ? (dir.x > 0 ? t.min[0] : t.max[0]) : dir.z > 0 ? t.min[2] : t.max[2];
          const a = from + along * (dir.x + dir.z);
          const b = a + length * (dir.x + dir.z);
          const [x0, z0, x1, z1] = Math.abs(dir.x)
            ? [a, t.min[2] + lane * size.z, b, t.min[2] + lane * size.z]
            : [t.min[0] + lane * size.x, a, t.min[0] + lane * size.x, b];
          positions.set([x0, t.min[1] + 0.6 + height, z0, x1, t.min[1] + 0.6 + height, z1], i * 6);
        });
        geometry.getAttribute('position').needsUpdate = true;
        material.opacity = 0.25 + 0.55 * Math.min(1, factor);
      },
    };
  },
};
