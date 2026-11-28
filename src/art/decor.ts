import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createRandom } from '../engine/math';
import { DECOR, type DecorColors } from './palette';

export type Decor = { update: (clock: number, dt: number) => void };

const ISLANDS = 16;
const CLOUDS = 12;

/** Bakes a transform and a flat colour into a geometry so many parts can share one draw call. */
const part = (geometry: THREE.BufferGeometry, color: number, matrix: THREE.Matrix4): THREE.BufferGeometry => {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  g.applyMatrix4(matrix);
  const c = new THREE.Color(color);
  const colors = new Float32Array(g.getAttribute('position').count * 3);
  for (let i = 0; i < colors.length; i += 3) colors.set([c.r, c.g, c.b], i);
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.deleteAttribute('uv');
  return g;
};

const merge = (parts: THREE.BufferGeometry[]): THREE.BufferGeometry => {
  const merged = mergeGeometries(parts);
  if (!merged) throw new Error('Decor parts could not be merged');
  return merged;
};

const transform = (position: THREE.Vector3, rotationX = 0) =>
  new THREE.Matrix4().compose(
    position,
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rotationX, 0, 0)),
    new THREE.Vector3(1, 1, 1),
  );

type LocalPart = { geometry: THREE.BufferGeometry; color: number; at: THREE.Vector3; flip?: boolean };
type Props = (rnd: () => number, radius: number, colors: DecorColors) => LocalPart[];

const spot = (rnd: () => number, r: number, y: number) => new THREE.Vector3((rnd() - 0.5) * r, y, (rnd() - 0.5) * r);

/** Garden: round little trees. */
const trees: Props = (rnd, r, c) => {
  const parts: LocalPart[] = [];
  for (let t = 0; t < 1 + rnd() * 3; t++)
    parts.push({ geometry: new THREE.ConeGeometry(0.5, 1.6, 6), color: c.leaf, at: spot(rnd, r, 1) });
  for (let f = 0; f < 3; f++)
    parts.push({ geometry: new THREE.IcosahedronGeometry(0.16, 0), color: c.cloud, at: spot(rnd, r * 1.2, 0.3) });
  return parts;
};

/** Sunset: palm trees, a thin trunk under a flat crown. */
const palms: Props = (rnd, r, c) => {
  const parts: LocalPart[] = [];
  for (let t = 0; t < 1 + rnd() * 2; t++) {
    const at = spot(rnd, r, 0);
    const h = 1.6 + rnd() * 1.2;
    parts.push({ geometry: new THREE.CylinderGeometry(0.1, 0.16, h, 5), color: c.rock, at: at.clone().setY(h / 2) });
    parts.push({ geometry: new THREE.ConeGeometry(0.9, 0.45, 6), color: c.leaf, at: at.clone().setY(h + 0.1) });
  }
  return parts;
};

/** Glacier: ice spikes and snow caps. */
const spikes: Props = (rnd, r, c) => {
  const parts: LocalPart[] = [];
  for (let t = 0; t < 2 + rnd() * 3; t++) {
    const h = 1 + rnd() * 2.4;
    parts.push({ geometry: new THREE.ConeGeometry(0.3 + rnd() * 0.3, h, 4), color: c.leaf, at: spot(rnd, r, h / 2) });
  }
  parts.push({ geometry: new THREE.IcosahedronGeometry(r * 0.45, 0), color: c.grass, at: spot(rnd, r * 0.4, 0.2) });
  return parts;
};

/** Cloud factory: chimneys and cog wheels. */
const machines: Props = (rnd, r, c) => {
  const parts: LocalPart[] = [];
  const h = 1.5 + rnd() * 2;
  parts.push({ geometry: new THREE.CylinderGeometry(0.3, 0.38, h, 8), color: c.rock, at: spot(rnd, r * 0.6, h / 2) });
  const cog = new THREE.CylinderGeometry(0.8, 0.8, 0.25, 12);
  const teeth = Array.from({ length: 8 }, (_, i) => {
    const tooth = new THREE.BoxGeometry(0.3, 0.25, 0.3);
    const a = (i / 8) * Math.PI * 2;
    tooth.translate(Math.cos(a) * 0.9, 0, Math.sin(a) * 0.9);
    return tooth.toNonIndexed();
  });
  const wheel = mergeGeometries([cog.toNonIndexed(), ...teeth]);
  if (wheel) {
    wheel.rotateX(Math.PI / 2);
    parts.push({ geometry: wheel, color: c.leaf, at: spot(rnd, r * 0.6, 1) });
  }
  return parts;
};

const PROPS: Record<string, Props> = { garden: trees, sunset: palms, glacier: spikes, factory: machines };

/**
 * Floating islands and drifting clouds on both sides of the course (its vertices give the extent). All islands share one mesh
 * and each cloud is one mesh, which keeps the decor to 13 draw calls (PLAN.md § 9).
 */
export const createDecor = (
  scene: THREE.Object3D,
  seed: number,
  course: Float32Array,
  colors: DecorColors = DECOR,
  theme = 'garden',
): Decor => {
  const rnd = createRandom(seed);
  const box = new THREE.Box3().setFromArray(course);
  const { min, max } = box.isEmpty() ? new THREE.Box3(new THREE.Vector3(), new THREE.Vector3()) : box;
  /** Somewhere beside the course on `side` (-1 left, 1 right), `gap` units away from its edge. */
  const besideX = (side: number, gap: number) => (side < 0 ? min.x - gap : max.x + gap);
  const alongZ = () => max.z + 8 - rnd() * (max.z - min.z + 16);
  const islandMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true });
  const cloudMaterial = new THREE.MeshStandardMaterial({
    color: colors.cloud,
    emissive: colors.cloud,
    emissiveIntensity: 0.25,
    flatShading: true,
  });

  const islandParts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < ISLANDS; i++) {
    const side = i % 2 ? 1 : -1;
    const r = 1.8 + rnd() * 2.5;
    const local: LocalPart[] = [
      {
        geometry: new THREE.ConeGeometry(r, r * 1.8, 7),
        color: colors.rock,
        at: new THREE.Vector3(0, -r * 0.9, 0),
        flip: true,
      },
      { geometry: new THREE.CylinderGeometry(r, r, 0.35, 7), color: colors.grass, at: new THREE.Vector3() },
    ];
    local.push(...(PROPS[theme] ?? trees)(rnd, r, colors));
    const origin = new THREE.Vector3(besideX(side, 9 + rnd() * 14), min.y - 9 + rnd() * 9, alongZ());
    for (const { geometry, color, at, flip } of local) {
      islandParts.push(part(geometry, color, transform(at.add(origin), flip ? Math.PI : 0)));
    }
  }
  scene.add(new THREE.Mesh(merge(islandParts), islandMaterial));

  const clouds: THREE.Mesh[] = [];
  for (let i = 0; i < CLOUDS; i++) {
    const puffs: THREE.BufferGeometry[] = [];
    for (let k = 0; k < 4; k++) {
      const puff = new THREE.IcosahedronGeometry(1 + rnd() * 1.2, 1);
      puff.translate(k * 1.4, rnd() * 0.6, rnd() * 0.8);
      puffs.push(puff);
    }
    const cloud = new THREE.Mesh(merge(puffs), cloudMaterial);
    const side = i % 2 ? 1 : -1;
    cloud.position.set(besideX(side, 15 + rnd() * 16), min.y + 1 + rnd() * 10, alongZ() + 2);
    scene.add(cloud);
    clouds.push(cloud);
  }

  return {
    update: (clock, dt) => {
      clouds.forEach((c, i) => {
        c.position.x += Math.sin(clock * 0.2 + i) * dt * 0.3;
      });
    },
  };
};
