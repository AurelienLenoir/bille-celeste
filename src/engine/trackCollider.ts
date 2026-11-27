import type { Vec3Tuple } from './math';

/** Walkable rectangle in the xz plane whose height varies linearly along z (flat when both match). */
export type FloorPatch = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  heightAtMinZ: number;
  heightAtMaxZ: number;
};

/** Closed box that sticks out of the floor (wall, rail), optionally pitched around x. */
export type SolidBox = { center: Vec3Tuple; size: Vec3Tuple; pitch?: number };

export type TrackMesh = { vertices: Float32Array; indices: Uint32Array };

type Vec3 = readonly [number, number, number];

const FLOOR_THICKNESS = 0.5;
/** Solids are pushed this far into the floor so they never share a vertex with it. */
const SOLID_SINK = 0.05;
const PRECISION = 1e4;

const round = (n: number) => Math.round(n * PRECISION) / PRECISION;

const heightAt = (patch: FloorPatch, z: number) => {
  const t = (z - patch.minZ) / (patch.maxZ - patch.minZ);
  return patch.heightAtMinZ + (patch.heightAtMaxZ - patch.heightAtMinZ) * t;
};

const cross = (u: Vec3, w: Vec3): Vec3 => [
  u[1] * w[2] - u[2] * w[1],
  u[2] * w[0] - u[0] * w[2],
  u[0] * w[1] - u[1] * w[0],
];

/** Accumulates welded vertices and outward-facing triangles. */
const createMeshBuilder = () => {
  const positions: number[] = [];
  const indices: number[] = [];
  const ids = new Map<string, number>();

  const vertex = (x: number, y: number, z: number): number => {
    const p = [round(x), round(y), round(z)] as const;
    const key = p.join(',');
    const known = ids.get(key);
    if (known !== undefined) return known;
    const id = positions.length / 3;
    positions.push(...p);
    ids.set(key, id);
    return id;
  };

  const at = (i: number): Vec3 => [positions[i * 3] ?? 0, positions[i * 3 + 1] ?? 0, positions[i * 3 + 2] ?? 0];

  /** Adds a triangle wound so that its normal points along `outward`. */
  const triangle = (a: number, b: number, c: number, outward: Vec3) => {
    const [pa, pb, pc] = [at(a), at(b), at(c)];
    const n = cross([pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]], [pc[0] - pa[0], pc[1] - pa[1], pc[2] - pa[2]]);
    const facing = n[0] * outward[0] + n[1] * outward[1] + n[2] * outward[2];
    indices.push(...(facing < 0 ? [a, c, b] : [a, b, c]));
  };

  const quad = (q: readonly [number, number, number, number], outward: Vec3) => {
    triangle(q[0], q[1], q[2], outward);
    triangle(q[0], q[2], q[3], outward);
  };

  return {
    vertex,
    quad,
    build: (): TrackMesh => ({ vertices: new Float32Array(positions), indices: new Uint32Array(indices) }),
  };
};

type Builder = ReturnType<typeof createMeshBuilder>;

const sortedCuts = (values: number[]) => [...new Set(values.map(round))].sort((a, b) => a - b);

/**
 * Cuts every floor on one shared x/z grid so that touching patches at the same height share their
 * exact vertices (no T-junctions), then closes the result with sides and a bottom. Sides are only
 * emitted on the real outline: an edge used by a single grid cell.
 */
const addFloors = (mesh: Builder, floors: readonly FloorPatch[]) => {
  const xs = sortedCuts(floors.flatMap((f) => [f.minX, f.maxX]));
  const zs = sortedCuts(floors.flatMap((f) => [f.minZ, f.maxZ]));
  type Edge = { uses: number; top: [number, number]; bottom: [number, number]; outward: Vec3 };
  const edges = new Map<string, Edge>();

  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < zs.length - 1; j++) {
      const [x0, x1, z0, z1] = [xs[i] ?? 0, xs[i + 1] ?? 0, zs[j] ?? 0, zs[j + 1] ?? 0];
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      const patch = floors.find((f) => cx > f.minX && cx < f.maxX && cz > f.minZ && cz < f.maxZ);
      if (!patch) continue;

      const corners = [
        [x0, z0],
        [x1, z0],
        [x1, z1],
        [x0, z1],
      ] as const;
      const top = corners.map(([x, z]) => mesh.vertex(x, heightAt(patch, z), z));
      const bottom = corners.map(([x, z]) => mesh.vertex(x, heightAt(patch, z) - FLOOR_THICKNESS, z));
      mesh.quad(top as [number, number, number, number], [0, 1, 0]);
      mesh.quad(bottom as [number, number, number, number], [0, -1, 0]);

      corners.forEach(([ax, az], k) => {
        const next = (k + 1) % 4;
        const [bx, bz] = corners[next] ?? corners[0];
        const a = top[k] ?? 0;
        const b = top[next] ?? 0;
        const key = a < b ? `${a},${b}` : `${b},${a}`;
        const edge = edges.get(key) ?? {
          uses: 0,
          top: [a, b],
          bottom: [bottom[k] ?? 0, bottom[next] ?? 0],
          outward: [(ax + bx) / 2 - cx, 0, (az + bz) / 2 - cz],
        };
        edge.uses++;
        edges.set(key, edge);
      });
    }
  }

  for (const { uses, top, bottom, outward } of edges.values()) {
    if (uses === 1) mesh.quad([top[0], top[1], bottom[1], bottom[0]], outward);
  }
};

const BOX_FACES = [
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [2, 1],
  [2, -1],
] as const;
const FACE_CORNERS = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
] as const;

const addSolid = (mesh: Builder, { center, size, pitch = 0 }: SolidBox) => {
  const cos = Math.cos(pitch);
  const sin = Math.sin(pitch);
  const rotate = ([x, y, z]: Vec3): Vec3 => [x, y * cos - z * sin, y * sin + z * cos];
  // Grow the box downwards by SOLID_SINK, keeping its top where it was.
  const down = rotate([0, -SOLID_SINK / 2, 0]);
  const c: Vec3 = [center[0] + down[0], center[1] + down[1], center[2] + down[2]];
  const half: Vec3 = [size[0] / 2, size[1] / 2 + SOLID_SINK / 2, size[2] / 2];

  for (const [axis, sign] of BOX_FACES) {
    const [u, v] = [0, 1, 2].filter((a) => a !== axis) as [number, number];
    const quad = FACE_CORNERS.map(([su, sv]) => {
      const local: [number, number, number] = [0, 0, 0];
      local[axis] = sign * half[axis];
      local[u] = su * (half[u] ?? 0);
      local[v] = sv * (half[v] ?? 0);
      const [x, y, z] = rotate(local);
      return mesh.vertex(c[0] + x, c[1] + y, c[2] + z);
    });
    const normal: [number, number, number] = [0, 0, 0];
    normal[axis] = sign;
    mesh.quad(quad as [number, number, number, number], rotate(normal));
  }
};

/**
 * One welded, outward-facing triangle mesh for the whole static course. Used as a single trimesh
 * collider with internal-edge fixing, so the ball rolls across piece joints without catching.
 */
export const buildTrackMesh = (floors: readonly FloorPatch[], solids: readonly SolidBox[]): TrackMesh => {
  const mesh = createMeshBuilder();
  addFloors(mesh, floors);
  solids.forEach((solid) => addSolid(mesh, solid));
  return mesh.build();
};
