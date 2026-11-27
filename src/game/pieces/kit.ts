import type * as THREE from 'three';
import type { SurfaceMaterials } from '../../art/materials';
import type { Vec3Tuple } from '../../engine/math';
import type { PhysicsWorld } from '../../engine/physics';
import { emptyShape, type Barrier, type FloorPatch, type TrackShape } from '../../engine/trackCollider';
import { CELL, edgeKey, toWorld, type Dir, type Frame } from '../../levels/grid';
import { SURFACE_NAMES, WIDTHS, type Rails, type Surface, type Width } from '../../levels/schema';

/** Where a piece can be entered or left: the midpoint of a cell edge, facing out of the piece. */
export type NavPort = { node: number; key: string; dir: Dir; y: number; tolerance?: number };
/** `jump` crosses a gap, `ride` needs a moving platform, `drop` falls down a step. */
export type NavKind = 'roll' | 'jump' | 'ride' | 'drop';
export type NavLink = { from: number; to: number; oneWay?: boolean; kind?: NavKind };
/** A wall closes the cell edge `key` for anything between `yMin` and `yMax`. */
export type NavBlock = { key: string; yMin: number; yMax: number };
export type PieceNav = { nodes: Vec3Tuple[]; links: NavLink[]; ports: NavPort[]; blocks: NavBlock[] };
/** A cell the piece occupies, with the height band of its surface. */
export type FootCell = { i: number; k: number; yMin: number; yMax: number };

export type PieceBuild = {
  /** Static geometry, merged into the course collider and meshes (world coordinates). */
  shape: TrackShape;
  /** Geometry of a moving body at rest, for previews and checks (world coordinates). */
  body?: TrackShape;
  nav: PieceNav;
  footprint: FootCell[];
};

export type BuildContext = {
  world: PhysicsWorld;
  scene: THREE.Object3D;
  materials: SurfaceMaterials;
};

export type BallProbe = { position: { x: number; y: number; z: number }; radius: number };

/** A piece that moves on its own: stepped with the physics, blended for rendering. */
export type Mover = {
  step: (dt: number, ball: BallProbe) => void;
  reset: () => void;
  syncMesh: (alpha: number) => void;
  /** Called when the ball respawns after a fall (falling tiles come back). */
  onRespawn?: () => void;
  /** Where the moving body is now (moving platforms), for the bot. */
  position?: () => Vec3Tuple;
};

export type PieceModule<P> = {
  build: (piece: P) => PieceBuild;
  createMover?: (ctx: BuildContext, piece: P) => Mover;
};

export const RAIL = { thickness: 0.3, height: 0.6 } as const;

export const surfaceTag = (surface: Surface): number => SURFACE_NAMES.indexOf(surface);
export const RAIL_TAG = surfaceTag('lav');

export const widthOf = (width: Width): number => WIDTHS[width];

export const emptyNav = (): PieceNav => ({ nodes: [], links: [], ports: [], blocks: [] });

/** Local rectangle (s0..s1 × f0..f1) whose height is y0 at (s0, f0) and changes by ks per s, kf per f. */
export const rectFloor = (
  frame: Frame,
  [s0, s1]: readonly [number, number],
  [f0, f1]: readonly [number, number],
  { y0, ks = 0, kf = 0 }: { y0: number; ks?: number; kf?: number },
  tag: number,
): FloorPatch => {
  const a = toWorld(frame, s0, f0);
  const b = toWorld(frame, s1, f1);
  const minX = Math.min(a[0], b[0]);
  const minZ = Math.min(a[2], b[2]);
  const { origin, right, forward } = frame;
  const s = (minX - origin[0]) * right[0] + (minZ - origin[2]) * right[1];
  const f = (minX - origin[0]) * forward[0] + (minZ - origin[2]) * forward[1];
  return {
    minX,
    maxX: Math.max(a[0], b[0]),
    minZ,
    maxZ: Math.max(a[2], b[2]),
    y: origin[1] + y0 + ks * (s - s0) + kf * (f - f0),
    slopeX: ks * right[0] + kf * forward[0],
    slopeZ: ks * right[1] + kf * forward[1],
    tag,
  };
};

/** Rails along both edges of a straight run, from f0 to f1, following a floor that drops linearly. */
export const sideRails = (
  frame: Frame,
  rails: Rails,
  halfWidth: number,
  [f0, f1]: readonly [number, number],
  [y0, y1]: readonly [number, number],
): Barrier[] => {
  const sides = halfWidth * 2 < MIN_RAILED_WIDTH ? [] : { none: [], left: [-1], right: [1], both: [-1, 1] }[rails];
  const offset = halfWidth + RAIL.thickness / 2;
  return sides.map((side) => ({
    points: [toWorld(frame, side * offset, f0, y0), toWorld(frame, side * offset, f1, y1)],
    thickness: RAIL.thickness,
    height: RAIL.height,
    tag: RAIL_TAG,
  }));
};

/** A track this narrow gets no rails: they would leave no room for the ball between them. */
export const MIN_RAILED_WIDTH = 1.2;

export const hasRail = (rails: Rails, side: 'left' | 'right', width = Infinity): boolean =>
  width >= MIN_RAILED_WIDTH && (rails === 'both' || rails === side);

export const port = (frame: Frame, node: number, s: number, f: number, dir: Dir, y: number, tolerance?: number) => {
  const [x, , z] = toWorld(frame, s, f);
  const p: NavPort = { node, key: edgeKey(x, z), dir, y: frame.origin[1] + y };
  if (tolerance !== undefined) p.tolerance = tolerance;
  return p;
};

export const back = (frame: Frame): Dir => [-frame.forward[0], -frame.forward[1]];
export const leftOf = (frame: Frame): Dir => [-frame.right[0], -frame.right[1]];

/**
 * A run of cells along `f` (one node per cell), entered at f = 0 and left at f = 2 × length.
 * `yAt(f)` is the local floor height. Side ports are added where `sides` allows.
 */
export const linearNav = (
  frame: Frame,
  length: number,
  yAt: (f: number) => number,
  sides: { left: boolean; right: boolean } = { left: false, right: false },
  ends: { entry?: boolean; exit?: boolean } = {},
): PieceNav => {
  const nav = emptyNav();
  for (let c = 0; c < length; c++) {
    const f = c * CELL + CELL / 2;
    nav.nodes.push(toWorld(frame, 0, f, yAt(f)));
    if (c > 0) nav.links.push({ from: c - 1, to: c });
    if (sides.left) nav.ports.push(port(frame, c, -CELL / 2, f, leftOf(frame), yAt(f)));
    if (sides.right) nav.ports.push(port(frame, c, CELL / 2, f, frame.right, yAt(f)));
  }
  if (ends.entry !== false) nav.ports.push(port(frame, 0, 0, 0, back(frame), yAt(0)));
  if (ends.exit !== false) nav.ports.push(port(frame, length - 1, 0, length * CELL, frame.forward, yAt(length * CELL)));
  return nav;
};

/** Cells covered by a local rectangle of whole cells: columns s, rows f (cell centres). */
export const rectFootprint = (
  frame: Frame,
  columns: readonly number[],
  rows: readonly number[],
  band: (f: number) => [number, number],
): FootCell[] =>
  columns.flatMap((s) =>
    rows.map((f) => {
      const [x, , z] = toWorld(frame, s, f);
      const [a, b] = band(f);
      return {
        i: Math.round(x / CELL),
        k: Math.round(z / CELL),
        yMin: frame.origin[1] + Math.min(a, b),
        yMax: frame.origin[1] + Math.max(a, b),
      };
    }),
  );

const isEdgeLine = (v: number) => Math.abs(v - Math.round(v)) < 1e-6 && Math.abs(Math.round(v)) % 2 === 1;

/** Ports for every cell edge along the outline of an axis-aligned rectangle, all linked to `node`. */
export const perimeterPorts = (
  node: number,
  [minX, maxX, minZ, maxZ]: readonly [number, number, number, number],
  y: number,
  tolerance?: number,
): NavPort[] => {
  const ports: NavPort[] = [];
  const add = (x: number, z: number, dir: Dir) => {
    const p: NavPort = { node, key: edgeKey(x, z), dir, y };
    if (tolerance !== undefined) p.tolerance = tolerance;
    ports.push(p);
  };
  const centres = (a: number, b: number) => {
    const out: number[] = [];
    for (let c = Math.ceil(a / CELL) * CELL; c < b; c += CELL) if (c > a) out.push(c);
    return out;
  };
  for (const x of centres(minX, maxX)) {
    if (isEdgeLine(minZ)) add(x, minZ, [0, -1]);
    if (isEdgeLine(maxZ)) add(x, maxZ, [0, 1]);
  }
  for (const z of centres(minZ, maxZ)) {
    if (isEdgeLine(minX)) add(minX, z, [-1, 0]);
    if (isEdgeLine(maxX)) add(maxX, z, [1, 0]);
  }
  return ports;
};

export { emptyShape };
