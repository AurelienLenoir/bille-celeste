import * as THREE from 'three';
import { createRandom } from '../engine/math';
import { pointsMaterial } from './particles';

type Point = { x: number; y: number; z: number };

/** Floating specks around the ball that give each world its air: pollen, petals, snow, stars. */
export type AmbientLook = {
  colors: readonly number[];
  count: number;
  /** Drift in units/s (y < 0 falls). */
  drift: Point;
  /** Side-to-side sway (units). */
  sway: number;
  size: number;
  /** Half-size of the box of air kept around the ball. */
  extent: Point;
  /** 0 steady, 1 strong twinkle. */
  twinkle: number;
  opacity: number;
};

export const AMBIENT_LOOKS: Record<string, AmbientLook> = {
  garden: {
    colors: [0xfff6b0, 0xffffff, 0xd8ffb0],
    count: 70,
    drift: { x: 0.15, y: 0.25, z: 0 },
    sway: 0.6,
    size: 0.12,
    extent: { x: 14, y: 6, z: 14 },
    twinkle: 0.3,
    opacity: 0.85,
  },
  sunset: {
    colors: [0xffb3c6, 0xffd08a, 0xff8fa3],
    count: 60,
    drift: { x: 0.5, y: -0.35, z: 0.1 },
    sway: 1,
    size: 0.16,
    extent: { x: 14, y: 6, z: 14 },
    twinkle: 0.1,
    opacity: 0.8,
  },
  glacier: {
    colors: [0xffffff, 0xe8f6ff],
    count: 140,
    drift: { x: 0.2, y: -1.1, z: 0 },
    sway: 0.5,
    size: 0.11,
    extent: { x: 13, y: 7, z: 13 },
    twinkle: 0,
    opacity: 0.9,
  },
  factory: {
    colors: [0xfff4d0, 0xd8d0ff, 0xffc8e0],
    count: 120,
    drift: { x: 0, y: 0.05, z: 0 },
    sway: 0.1,
    size: 0.9,
    extent: { x: 40, y: 14, z: 40 },
    twinkle: 1,
    opacity: 1,
  },
};

export type Ambient = { update: (center: Point, clock: number) => void; dispose: () => void };

const wrap = (value: number, center: number, half: number) => {
  const span = half * 2;
  return center - half + ((((value - center + half) % span) + span) % span);
};

/** One draw call. Specks live in a box that follows the ball and wrap around its sides. */
export const createAmbient = (parent: THREE.Object3D, look: AmbientLook, seed: number): Ambient => {
  const rnd = createRandom(seed + 99);
  const n = look.count;
  const home = new Float32Array(n * 3);
  const phase = new Float32Array(n);
  const position = new Float32Array(n * 3);
  const tint = new Float32Array(n * 3);
  const size = new Float32Array(n);
  const alpha = new Float32Array(n);
  const color = new THREE.Color();
  for (let i = 0; i < n; i++) {
    home.set([(rnd() - 0.5) * 2, (rnd() - 0.5) * 2, (rnd() - 0.5) * 2], i * 3);
    phase[i] = rnd() * Math.PI * 2;
    color.setHex(look.colors[i % look.colors.length] ?? 0xffffff);
    tint.set([color.r, color.g, color.b], i * 3);
    size[i] = look.size * (0.6 + rnd() * 0.8);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('tint', new THREE.BufferAttribute(tint, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(size, 1));
  geometry.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1));
  const points = new THREE.Points(geometry, pointsMaterial());
  points.frustumCulled = false;
  parent.add(points);

  return {
    update: (center, clock) => {
      const { extent: e, drift: d } = look;
      for (let i = 0; i < n; i++) {
        const j = i * 3;
        const p = phase[i] ?? 0;
        const sway = Math.sin(clock * 0.7 + p) * look.sway;
        position[j] = wrap((home[j] ?? 0) * e.x + d.x * clock + sway, center.x, e.x);
        position[j + 1] = wrap((home[j + 1] ?? 0) * e.y + d.y * clock, center.y + 1, e.y);
        position[j + 2] = wrap((home[j + 2] ?? 0) * e.z + d.z * clock + sway * 0.5, center.z, e.z);
        const twinkle = 1 - look.twinkle * 0.5 * (1 + Math.sin(clock * 2.3 + p * 3));
        alpha[i] = look.opacity * twinkle;
      }
      geometry.getAttribute('position').needsUpdate = true;
      geometry.getAttribute('alpha').needsUpdate = true;
    },
    dispose: () => {
      parent.remove(points);
      geometry.dispose();
    },
  };
};
