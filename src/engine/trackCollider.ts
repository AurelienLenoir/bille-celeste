import type { Vec3Tuple } from './math';

/**
 * Walkable rectangle in the xz plane. Its height is a plane: `y` at (minX, minZ), changing by
 * `slopeX` per unit of x and `slopeZ` per unit of z (flat when both are zero).
 */
export type FloorPatch = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  y: number;
  slopeX?: number;
  slopeZ?: number;
  /** Opaque material id, carried to the render groups. */
  tag?: number;
};

/** Walkable triangle given by its three top corners (curves, funnels). Any winding. */
export type FloorTriangle = { points: readonly [Vec3Tuple, Vec3Tuple, Vec3Tuple]; tag?: number };

/** Closed box that sticks out of the floor, optionally pitched around x then turned around y. */
export type SolidBox = { center: Vec3Tuple; size: Vec3Tuple; pitch?: number; yaw?: number; tag?: number };

/**
 * Wall or rail following a polyline. Each point is on the floor line the barrier stands on; the
 * barrier is `thickness` wide, centred on the line, and rises `height` above it.
 */
export type Barrier = { points: readonly Vec3Tuple[]; thickness: number; height: number; tag?: number };

export type TrackShape = {
  floors: FloorPatch[];
  triangles: FloorTriangle[];
  solids: SolidBox[];
  barriers: Barrier[];
};

export type TrackMesh = {
  vertices: Float32Array;
  indices: Uint32Array;
  /** Material tag of each triangle (indices.length / 3 entries). */
  tags: Uint16Array;
};

type Vec3 = readonly [number, number, number];
type Tri = [number, number, number];

export const FLOOR_THICKNESS = 0.55;
/** Solids are pushed this far into the floor so they never share a vertex with it. */
const SOLID_SINK = 0.05;
const PRECISION = 1e4;
const ON_EDGE = 2e-4;

const round = (n: number) => Math.round(n * PRECISION) / PRECISION;

export const emptyShape = (): TrackShape => ({ floors: [], triangles: [], solids: [], barriers: [] });

/** Appends every part of `from` to `into`. */
export const mergeShape = (into: TrackShape, from: TrackShape): TrackShape => {
  into.floors.push(...from.floors);
  into.triangles.push(...from.triangles);
  into.solids.push(...from.solids);
  into.barriers.push(...from.barriers);
  return into;
};

export const floorHeight = (patch: FloorPatch, x: number, z: number): number =>
  patch.y + (patch.slopeX ?? 0) * (x - patch.minX) + (patch.slopeZ ?? 0) * (z - patch.minZ);

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (u: Vec3, w: Vec3): Vec3 => [
  u[1] * w[2] - u[2] * w[1],
  u[2] * w[0] - u[0] * w[2],
  u[0] * w[1] - u[1] * w[0],
];

/** Accumulates welded vertices and outward-facing, tagged triangles. */
const createMeshBuilder = () => {
  const positions: number[] = [];
  const indices: number[] = [];
  const tags: number[] = [];
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

  const normalOf = (a: number, b: number, c: number): Vec3 => {
    const pa = at(a);
    return cross(sub(at(b), pa), sub(at(c), pa));
  };

  /** Returns the triangle wound so that its normal points along `outward`. */
  const orient = (a: number, b: number, c: number, outward: Vec3): Tri =>
    dot(normalOf(a, b, c), outward) < 0 ? [a, c, b] : [a, b, c];

  const push = ([a, b, c]: Tri, tag: number) => {
    if (a === b || b === c || c === a) return;
    indices.push(a, b, c);
    tags.push(tag);
  };

  const triangle = (a: number, b: number, c: number, outward: Vec3, tag: number) => push(orient(a, b, c, outward), tag);

  const quad = (q: readonly [number, number, number, number], outward: Vec3, tag: number) => {
    triangle(q[0], q[1], q[2], outward, tag);
    triangle(q[0], q[2], q[3], outward, tag);
  };

  return {
    vertex,
    at,
    orient,
    push,
    triangle,
    quad,
    build: (): TrackMesh => ({
      vertices: new Float32Array(positions),
      indices: new Uint32Array(indices),
      tags: new Uint16Array(tags),
    }),
  };
};

type Builder = ReturnType<typeof createMeshBuilder>;
type TaggedTri = { tri: Tri; tag: number };

const sortedCuts = (values: number[]) => [...new Set(values.map(round))].sort((a, b) => a - b);

/** First index i with cuts[i] >= value (cuts are sorted and rounded). */
const lowerBound = (cuts: number[], value: number) => {
  let lo = 0;
  let hi = cuts.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((cuts[mid] ?? 0) < value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
};

/**
 * Cuts every rectangular floor on one shared x/z grid, so that touching patches share their exact
 * vertices and overlapping patches at the same height are emitted once.
 */
const rectangleTops = (mesh: Builder, floors: readonly FloorPatch[]): TaggedTri[] => {
  const xs = sortedCuts(floors.flatMap((f) => [f.minX, f.maxX]));
  const zs = sortedCuts(floors.flatMap((f) => [f.minZ, f.maxZ]));
  const done = new Map<string, number[][]>();
  const tops: TaggedTri[] = [];

  for (const patch of floors) {
    const i0 = lowerBound(xs, round(patch.minX));
    const i1 = lowerBound(xs, round(patch.maxX));
    const j0 = lowerBound(zs, round(patch.minZ));
    const j1 = lowerBound(zs, round(patch.maxZ));
    for (let i = i0; i < i1; i++) {
      for (let j = j0; j < j1; j++) {
        const [x0, x1, z0, z1] = [xs[i] ?? 0, xs[i + 1] ?? 0, zs[j] ?? 0, zs[j + 1] ?? 0];
        const corners = [
          [x0, z0],
          [x1, z0],
          [x1, z1],
          [x0, z1],
        ] as const;
        const heights = corners.map(([x, z]) => floorHeight(patch, x, z));
        const key = `${i},${j}`;
        const seen = done.get(key) ?? [];
        if (seen.some((h) => h.every((v, k) => Math.abs(v - (heights[k] ?? 0)) < 1e-3))) continue;
        seen.push(heights);
        done.set(key, seen);
        const v = corners.map(([x, z], k) => mesh.vertex(x, heights[k] ?? 0, z));
        const [a, b, c, d] = v as [number, number, number, number];
        const tag = patch.tag ?? 0;
        tops.push({ tri: mesh.orient(a, b, c, [0, 1, 0]), tag }, { tri: mesh.orient(a, c, d, [0, 1, 0]), tag });
      }
    }
  }
  return tops;
};

/** Splits triangles whose edges pass through another floor vertex, so the surface has no T-junctions. */
const removeTJunctions = (mesh: Builder, tops: TaggedTri[]): TaggedTri[] => {
  const CELL = 2;
  const grid = new Map<string, number[]>();
  const used = new Set(tops.flatMap((t) => t.tri));
  for (const id of used) {
    const [x, , z] = mesh.at(id);
    const key = `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
    grid.set(key, [...(grid.get(key) ?? []), id]);
  }

  const vertexOn = (p: number, q: number): number | undefined => {
    const a = mesh.at(p);
    const b = mesh.at(q);
    const ab = sub(b, a);
    const len2 = dot(ab, ab);
    for (let gx = Math.floor(Math.min(a[0], b[0]) / CELL); gx <= Math.floor(Math.max(a[0], b[0]) / CELL); gx++) {
      for (let gz = Math.floor(Math.min(a[2], b[2]) / CELL); gz <= Math.floor(Math.max(a[2], b[2]) / CELL); gz++) {
        for (const v of grid.get(`${gx},${gz}`) ?? []) {
          if (v === p || v === q) continue;
          const av = sub(mesh.at(v), a);
          const s = dot(av, ab) / len2;
          if (s <= 1e-6 || s >= 1 - 1e-6) continue;
          const off = sub(av, [ab[0] * s, ab[1] * s, ab[2] * s]);
          if (dot(off, off) < ON_EDGE * ON_EDGE) return v;
        }
      }
    }
    return undefined;
  };

  const queue = [...tops];
  const out: TaggedTri[] = [];
  while (queue.length) {
    const item = queue.pop() as TaggedTri;
    const [a, b, c] = item.tri;
    const edges: [number, number, number][] = [
      [a, b, c],
      [b, c, a],
      [c, a, b],
    ];
    const split = edges.find(([p, q]) => vertexOn(p, q) !== undefined);
    if (!split) {
      out.push(item);
      continue;
    }
    const [p, q, r] = split;
    const v = vertexOn(p, q) as number;
    queue.push({ tri: [p, v, r], tag: item.tag }, { tri: [v, q, r], tag: item.tag });
  }
  return out;
};

/** Gives the floor its thickness: a bottom under every top triangle and sides on the real outline. */
const closeFloors = (mesh: Builder, tops: TaggedTri[]) => {
  const below = new Map<number, number>();
  const down = (id: number) => {
    const known = below.get(id);
    if (known !== undefined) return known;
    const [x, y, z] = mesh.at(id);
    const d = mesh.vertex(x, y - FLOOR_THICKNESS, z);
    below.set(id, d);
    return d;
  };
  type Edge = { uses: number; a: number; b: number; tag: number; outward: Vec3 };
  const edges = new Map<string, Edge>();

  for (const { tri, tag } of tops) {
    mesh.push(tri, tag);
    const [a, b, c] = tri;
    mesh.push([down(a), down(c), down(b)], tag);
    const centre = [a, b, c].map(mesh.at).reduce((s, p) => [s[0] + p[0] / 3, 0, s[2] + p[2] / 3], [0, 0, 0]);
    for (const [p, q] of [
      [a, b],
      [b, c],
      [c, a],
    ] as const) {
      const key = p < q ? `${p},${q}` : `${q},${p}`;
      const pp = mesh.at(p);
      const qp = mesh.at(q);
      const edge = edges.get(key) ?? {
        uses: 0,
        a: p,
        b: q,
        tag,
        outward: [(pp[0] + qp[0]) / 2 - (centre[0] ?? 0), 0, (pp[2] + qp[2]) / 2 - (centre[2] ?? 0)],
      };
      edge.uses++;
      edges.set(key, edge);
    }
  }

  for (const { uses, a, b, tag, outward } of edges.values()) {
    if (uses === 1) mesh.quad([a, b, down(b), down(a)], outward, tag);
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

const addSolid = (mesh: Builder, { center, size, pitch = 0, yaw = 0, tag = 0 }: SolidBox) => {
  const [cp, sp, cy, sy] = [Math.cos(pitch), Math.sin(pitch), Math.cos(yaw), Math.sin(yaw)];
  const rotate = ([x, y, z]: Vec3): Vec3 => {
    const [py, pz] = [y * cp - z * sp, y * sp + z * cp];
    return [x * cy + pz * sy, py, -x * sy + pz * cy];
  };
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
    mesh.quad(quad as [number, number, number, number], rotate(normal), tag);
  }
};

/** Left-hand horizontal normal of each polyline point, mitred at the joints. */
const sideOffsets = (points: readonly Vec3Tuple[]): [number, number][] => {
  const normals = points.slice(1).map((p, i) => {
    const q = points[i] ?? p;
    const len = Math.hypot(p[0] - q[0], p[2] - q[2]) || 1;
    return [-(p[2] - q[2]) / len, (p[0] - q[0]) / len] as [number, number];
  });
  return points.map((_, i) => {
    const a = normals[Math.max(0, i - 1)] ?? [1, 0];
    const b = normals[Math.min(normals.length - 1, i)] ?? a;
    const mx = a[0] + b[0];
    const mz = a[1] + b[1];
    const len = Math.hypot(mx, mz) || 1;
    const cos = (mx / len) * a[0] + (mz / len) * a[1];
    const scale = 1 / Math.max(0.3, cos) / len;
    return [mx * scale, mz * scale];
  });
};

const addBarrier = (mesh: Builder, { points, thickness, height, tag = 0 }: Barrier) => {
  if (points.length < 2) return;
  const offsets = sideOffsets(points);
  const ring = points.map((p, i) => {
    const [nx, nz] = offsets[i] ?? [0, 0];
    const h = thickness / 2;
    const corner = (side: number, y: number) => mesh.vertex(p[0] + nx * h * side, y, p[2] + nz * h * side);
    const bottom = p[1] - SOLID_SINK;
    const top = p[1] + height;
    // left-bottom, right-bottom, right-top, left-top
    return [corner(1, bottom), corner(-1, bottom), corner(-1, top), corner(1, top)] as const;
  });
  for (let i = 0; i < points.length - 1; i++) {
    const [a, b] = [ring[i], ring[i + 1]];
    const [p, q] = [points[i], points[i + 1]];
    if (!a || !b || !p || !q) continue;
    const d: Vec3 = [q[0] - p[0], 0, q[2] - p[2]];
    const left: Vec3 = [-d[2], 0, d[0]];
    mesh.quad([a[0], b[0], b[3], a[3]], left, tag);
    mesh.quad([a[1], b[1], b[2], a[2]], [-left[0], 0, -left[2]], tag);
    mesh.quad([a[3], b[3], b[2], a[2]], [0, 1, 0], tag);
    mesh.quad([a[0], b[0], b[1], a[1]], [0, -1, 0], tag);
  }
  const [first, last] = [ring[0], ring[ring.length - 1]];
  const [p0, p1] = [points[0], points[1]];
  const [pn, pm] = [points[points.length - 1], points[points.length - 2]];
  if (first && p0 && p1) mesh.quad([first[0], first[1], first[2], first[3]], [p0[0] - p1[0], 0, p0[2] - p1[2]], tag);
  if (last && pn && pm) mesh.quad([last[0], last[1], last[2], last[3]], [pn[0] - pm[0], 0, pn[2] - pm[2]], tag);
};

/**
 * One welded, outward-facing triangle mesh for the whole static course. Used as a single trimesh
 * collider with internal-edge fixing, so the ball rolls across piece joints without catching, and
 * as the source of the merged course meshes (grouped by tag).
 */
export const buildTrackMesh = (shape: Partial<TrackShape>): TrackMesh => {
  const mesh = createMeshBuilder();
  const tops = rectangleTops(mesh, shape.floors ?? []);
  for (const { points, tag = 0 } of shape.triangles ?? []) {
    const [a, b, c] = points.map(([x, y, z]) => mesh.vertex(x, y, z)) as Tri;
    tops.push({ tri: mesh.orient(a, b, c, [0, 1, 0]), tag });
  }
  closeFloors(mesh, removeTJunctions(mesh, tops));
  (shape.solids ?? []).forEach((solid) => addSolid(mesh, solid));
  (shape.barriers ?? []).forEach((barrier) => addBarrier(mesh, barrier));
  return mesh.build();
};
