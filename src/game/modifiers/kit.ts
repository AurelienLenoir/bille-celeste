import * as THREE from 'three';
import type { SoundNote } from '../../engine/audio';
import type { HapticPattern } from '../../engine/haptics';
import type { Vec3Tuple } from '../../engine/math';
import { RAPIER, type PhysicsWorld } from '../../engine/physics';
import { surfaceHeightsAt, type TrackShape } from '../../engine/trackCollider';
import { CELL, cellToWorld, forwardOf, STEP, type CellCoord, type Dir } from '../../levels/grid';
import type { Ball, Grip } from '../ball';
import type { TimedEffect } from '../effects';
import type { BuildContext } from '../pieces/kit';

type Point = { x: number; y: number; z: number };

/** What the zones the ball is in do to it during one physics step. Rebuilt every step. */
export type StepEffects = {
  grip: Grip;
  /** Extra acceleration on the ball (units/s²), on top of gravity. */
  push: Point;
  /** Controls are inverted. */
  invert: boolean;
  /** 0: clear view, 1: thickest fog. */
  fog: number;
};

/** What a modifier may do to the run. */
export type ModifierRun = {
  ball: Ball;
  effects: StepEffects;
  grant: (effect: TimedEffect) => void;
  /** Adds (or with a negative value, removes) seconds on the chrono. */
  shiftTimer: (seconds: number) => void;
  /** Announces that the modifier went off: sound, vibration and HUD. */
  fire: () => void;
};

/** Volume that triggers a modifier, in world units. */
export type Trigger =
  { kind: 'box'; min: Vec3Tuple; max: Vec3Tuple } | { kind: 'sphere'; centre: Vec3Tuple; radius: number };

/** A moving obstacle, so the bot can wait for a gap (deterministic: it only depends on time). */
export type Hazard = {
  /** Is (x, z) a place this obstacle can reach at all? */
  covers: (x: number, z: number) => boolean;
  /** Will the obstacle be within `margin` of (x, z) in `seconds` (game time) from now? */
  hitsAt: (x: number, z: number, seconds: number, margin: number) => boolean;
};

export type ModifierInstance = {
  trigger?: Trigger;
  /** Once, when the ball enters the trigger. */
  onEnter?: (run: ModifierRun) => void;
  onExit?: (run: ModifierRun) => void;
  /** Every step while the ball is inside the trigger. */
  inside?: (run: ModifierRun) => void;
  /** Every step, in game time (slowed down by slow motion). */
  step?: (dt: number, run: ModifierRun) => void;
  /** Blends the visuals between the last two steps. `clock` is real time, for idle animations. */
  syncMesh: (alpha: number, clock: number) => void;
  reset: () => void;
  hazard?: Hazard;
};

/** Build context of a modifier: the piece context plus the course surfaces, to lay decals on. */
export type ModifierContext = BuildContext & { ground: readonly TrackShape[] };

export type ModifierModule<M> = {
  kind: 'bonus' | 'malus';
  sound: readonly SoundNote[];
  haptic: HapticPattern;
  /** Trigger volume, without building anything (validator, editor). */
  trigger?: (m: M) => Trigger;
  /** Cells blocked by something solid (bumper post, sweeper hub): routes go around them. */
  solidCells?: (m: M) => [number, number][];
  /** Cells a moving obstacle sweeps: routes avoid them when they can. */
  hazardCells?: (m: M) => [number, number][];
  create: (ctx: ModifierContext, m: M) => ModifierInstance;
};

/** Height of a zone's trigger above its floor. */
export const ZONE_HEIGHT = 2.5;
/** Pickups float this high above the floor. */
export const PICKUP_HEIGHT = 0.7;
export const PICKUP_RADIUS = 0.85;

/** Cell range of a zone of `size` cells centred on `cell` (the cell before the middle when even). */
export const zoneCells = ({ cell: [ci, , ck], size }: { cell: CellCoord; size: readonly [number, number] }) => {
  const i0 = ci - Math.floor((size[0] - 1) / 2);
  const k0 = ck - Math.floor((size[1] - 1) / 2);
  return { i0, i1: i0 + size[0] - 1, k0, k1: k0 + size[1] - 1 };
};

export const zoneTrigger = (zone: { cell: CellCoord; size: readonly [number, number] }): Trigger => {
  const { i0, i1, k0, k1 } = zoneCells(zone);
  const y = zone.cell[1] * STEP;
  return {
    kind: 'box',
    min: [i0 * CELL - CELL / 2, y - 0.6, k0 * CELL - CELL / 2],
    max: [i1 * CELL + CELL / 2, y + ZONE_HEIGHT, k1 * CELL + CELL / 2],
  };
};

export const pickupTrigger = ({ cell }: { cell: CellCoord }): Trigger => {
  const [x, y, z] = cellToWorld(cell);
  return { kind: 'sphere', centre: [x, y + PICKUP_HEIGHT - 0.25, z], radius: PICKUP_RADIUS };
};

/** Pad on one cell (speed pad, spring): a flat trigger just above the floor. */
export const padTrigger = ({ cell }: { cell: CellCoord }, half = 0.8): Trigger => {
  const [x, y, z] = cellToWorld(cell);
  return { kind: 'box', min: [x - half, y - 0.3, z - half], max: [x + half, y + 1, z + half] };
};

export const isInside = (t: Trigger, p: Point): boolean =>
  t.kind === 'sphere'
    ? Math.hypot(p.x - t.centre[0], p.y - t.centre[1], p.z - t.centre[2]) < t.radius
    : p.x > t.min[0] && p.x < t.max[0] && p.y > t.min[1] && p.y < t.max[1] && p.z > t.min[2] && p.z < t.max[2];

/** Rapier sensor (no physical collision) matching a trigger. */
export const createSensor = (world: PhysicsWorld, t: Trigger): RAPIER.Collider => {
  const desc =
    t.kind === 'sphere'
      ? RAPIER.ColliderDesc.ball(t.radius).setTranslation(...t.centre)
      : RAPIER.ColliderDesc.cuboid(
          (t.max[0] - t.min[0]) / 2,
          (t.max[1] - t.min[1]) / 2,
          (t.max[2] - t.min[2]) / 2,
        ).setTranslation((t.min[0] + t.max[0]) / 2, (t.min[1] + t.max[1]) / 2, (t.min[2] + t.max[2]) / 2);
  return world.createCollider(desc.setSensor(true));
};

/** Unit vector (x, z) of a rotation, as a 3D direction. */
export const direction = (rot: number): Point => {
  const [x, z]: Dir = forwardOf(rot);
  return { x, y: 0, z };
};

/** Every cell of a zone, as (i, k). */
export const cellsOf = (zone: { cell: CellCoord; size: readonly [number, number] }): [number, number][] => {
  const { i0, i1, k0, k1 } = zoneCells(zone);
  const cells: [number, number][] = [];
  for (let i = i0; i <= i1; i++) for (let k = k0; k <= k1; k++) cells.push([i, k]);
  return cells;
};

/** Floor height under (x, z) closest to `near`, within 1.5 units, from the course surfaces. */
export const groundAt = (ground: readonly TrackShape[], x: number, z: number, near: number): number | undefined =>
  surfaceHeightsAt(ground, x, z)
    .filter((h) => Math.abs(h - near) < 1.5)
    .sort((a, b) => Math.abs(a - near) - Math.abs(b - near))[0];

const DECAL_STEP = 0.5;
const DECAL_LIFT = 0.03;

/**
 * Flat-coloured sheet lying on the course over a zone's cells, following ramps. `shade(u, v)`
 * returns a brightness (0..1) for each corner, from which vertex colours are mixed.
 */
export const createDecal = (
  ctx: ModifierContext,
  zone: { cell: CellCoord; size: readonly [number, number] },
  colours: { base: THREE.ColorRepresentation; accent: THREE.ColorRepresentation },
  shade: (x: number, z: number) => number,
  opacity = 0.85,
): THREE.Mesh => {
  const { i0, i1, k0, k1 } = zoneCells(zone);
  const y = zone.cell[1] * STEP;
  const [x0, x1] = [i0 * CELL - CELL / 2, i1 * CELL + CELL / 2];
  const [z0, z1] = [k0 * CELL - CELL / 2, k1 * CELL + CELL / 2];
  const nx = Math.round((x1 - x0) / DECAL_STEP);
  const nz = Math.round((z1 - z0) / DECAL_STEP);
  const base = new THREE.Color(colours.base);
  const accent = new THREE.Color(colours.accent);
  const colour = new THREE.Color();
  const positions: number[] = [];
  const tints: number[] = [];
  const height = (x: number, z: number) => groundAt(ctx.ground, x, z, y);
  const corner = (x: number, z: number, h: number) => {
    positions.push(x, h + DECAL_LIFT, z);
    colour.copy(base).lerp(accent, shade(x, z));
    tints.push(colour.r, colour.g, colour.b);
  };
  for (let a = 0; a < nx; a++) {
    for (let b = 0; b < nz; b++) {
      const xa = x0 + a * DECAL_STEP;
      const za = z0 + b * DECAL_STEP;
      const [xb, zb] = [xa + DECAL_STEP, za + DECAL_STEP];
      // Sample just inside the quad so cell edges pick the surface of this quad's own cell.
      const e = 0.01;
      const h = [height(xa + e, za + e), height(xb - e, za + e), height(xb - e, zb - e), height(xa + e, zb - e)];
      if (h.some((v) => v === undefined)) continue;
      const [h0, h1, h2, h3] = h as [number, number, number, number];
      corner(xa, za, h0);
      corner(xa, zb, h3);
      corner(xb, zb, h2);
      corner(xa, za, h0);
      corner(xb, zb, h2);
      corner(xb, za, h1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(tints, 3));
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    transparent: opacity < 1,
    opacity,
    roughness: 0.6,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.renderOrder = 1;
  ctx.scene.add(mesh);
  return mesh;
};

export type PickupLook = { geometry: THREE.BufferGeometry; colour: number; emissive?: number; opacity?: number };

/**
 * A floating token that grants something once per run: it spins and bobs, pops when taken, and
 * comes back when the level restarts (not after a fall).
 */
export const createPickup = (
  ctx: ModifierContext,
  m: { cell: CellCoord },
  look: PickupLook,
  take: (run: ModifierRun) => void,
): ModifierInstance => {
  const [x, y, z] = cellToWorld(m.cell);
  const material = new THREE.MeshStandardMaterial({
    color: look.colour,
    emissive: look.emissive ?? look.colour,
    emissiveIntensity: 0.35,
    roughness: 0.3,
    metalness: 0.1,
    transparent: look.opacity !== undefined,
    opacity: look.opacity ?? 1,
  });
  // No shadow: one draw call per pickup.
  const mesh = new THREE.Mesh(look.geometry, material);
  ctx.scene.add(mesh);
  let taken = false;
  let fade = 0;
  let lastClock = 0;
  const phase = (x * 13 + z * 7) % 6;
  return {
    trigger: pickupTrigger(m),
    onEnter: (run) => {
      if (taken) return;
      taken = true;
      fade = 1;
      take(run);
      run.fire();
    },
    reset: () => {
      taken = false;
      fade = 0;
      mesh.visible = true;
      mesh.scale.setScalar(1);
    },
    syncMesh: (_alpha, clock) => {
      const dt = Math.max(0, clock - lastClock);
      lastClock = clock;
      if (taken) {
        fade = Math.max(0, fade - dt * 4);
        mesh.scale.setScalar(fade * 1.7);
        mesh.position.y += dt * 3;
        mesh.visible = fade > 0;
        return;
      }
      mesh.position.set(x, y + PICKUP_HEIGHT + Math.sin(clock * 2.2 + phase) * 0.1, z);
      mesh.rotation.y = clock * 1.6 + phase;
    },
  };
};

/** Merges geometries (positions and normals only) so a look stays a single draw call. */
export const mergeGeometries = (parts: THREE.BufferGeometry[]): THREE.BufferGeometry => {
  const positions: number[] = [];
  const normals: number[] = [];
  for (const part of parts) {
    const g = part.index ? part.toNonIndexed() : part;
    positions.push(...(g.getAttribute('position').array as Float32Array));
    normals.push(...(g.getAttribute('normal').array as Float32Array));
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  merged.computeBoundingSphere();
  return merged;
};

/** A neutral run for tests: records what modifiers do to it. */
export const neutralEffects = (grip: Grip): StepEffects => ({
  grip,
  push: { x: 0, y: 0, z: 0 },
  invert: false,
  fog: 0,
});

/** Deterministic pseudo-random value in 0..1 for a point (decal speckles). */
export const hash2 = (x: number, z: number): number => {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
