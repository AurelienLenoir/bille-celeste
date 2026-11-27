import { SURFACES } from '../../src/art/palette';
import type { TrackShape } from '../../src/engine/trackCollider';
import { cellsOf } from '../../src/game/modifiers/kit';
import { buildPiece } from '../../src/game/pieces';
import type { PieceBuild } from '../../src/game/pieces/kit';
import { CELL, cellToWorld, forwardOf, STEP } from '../../src/levels/grid';
import { SURFACE_NAMES, type Level, type Modifier, type ModifierType, type Piece } from '../../src/levels/schema';
import type { Selection } from './model';

export type View = { cx: number; cz: number; zoom: number; width: number; height: number };

export const toScreen = (v: View, x: number, z: number): [number, number] => [
  (x - v.cx) * v.zoom + v.width / 2,
  (z - v.cz) * v.zoom + v.height / 2,
];

export const toWorldXZ = (v: View, sx: number, sy: number): [number, number] => [
  (sx - v.width / 2) / v.zoom + v.cx,
  (sy - v.height / 2) / v.zoom + v.cz,
];

export const cellAt = (v: View, sx: number, sy: number): [number, number] => {
  const [x, z] = toWorldXZ(v, sx, sy);
  return [Math.round(x / CELL), Math.round(z / CELL)];
};

/** A view that shows the whole level, with a margin of two cells. */
export const fitView = (level: Level, width: number, height: number): View => {
  const cells = level.pieces.flatMap((piece) => built(piece).footprint);
  const xs = cells.map((c) => c.i * CELL);
  const zs = cells.map((c) => c.k * CELL);
  const [minX, maxX, minZ, maxZ] = [Math.min(...xs, 0), Math.max(...xs, 0), Math.min(...zs, 0), Math.max(...zs, 0)];
  const zoom = Math.min(40, Math.max(4, Math.min(width / (maxX - minX + 4 * CELL), height / (maxZ - minZ + 4 * CELL))));
  return { cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2, zoom, width, height };
};

const builds = new WeakMap<Piece, PieceBuild>();
/** Built geometry of a piece, cached per piece object (pieces are immutable in the editor). */
export const built = (piece: Piece): PieceBuild => {
  const known = builds.get(piece);
  if (known) return known;
  const fresh = buildPiece(piece);
  builds.set(piece, fresh);
  return fresh;
};

const colour = (tag = 0) => {
  const surface = SURFACE_NAMES[tag] ?? 'cream';
  return SURFACES[surface].top[1];
};

const ENTITY_STYLE = {
  crystal: { colour: '#25b7e6', glyph: '◆' },
  checkpoint: { colour: '#2fb57a', glyph: '⚑' },
  hiddenGem: { colour: '#a35be8', glyph: '★' },
  goal: { colour: '#e3a600', glyph: '◎' },
} as const;

const MODIFIER_STYLE: Record<ModifierType, { colour: string; glyph: string }> = {
  speedPad: { colour: '#ff8a1f', glyph: '»' },
  spring: { colour: '#2fb55a', glyph: '⤒' },
  magnet: { colour: '#e0394e', glyph: 'U' },
  shield: { colour: '#1aa3c8', glyph: '◯' },
  slowMo: { colour: '#4f7fe0', glyph: '◷' },
  hourglass: { colour: '#d9a400', glyph: '⧗' },
  feather: { colour: '#7d8db0', glyph: '❦' },
  ice: { colour: '#6cc8f0', glyph: '❄' },
  sand: { colour: '#b88a4a', glyph: '∴' },
  wind: { colour: '#7fa6c8', glyph: '≋' },
  conveyor: { colour: '#4a5068', glyph: '⇶' },
  pusher: { colour: '#ff6a30', glyph: '▶' },
  sweeper: { colour: '#e24f6a', glyph: '↻' },
  bumper: { colour: '#2a8cff', glyph: '●' },
  heavy: { colour: '#3b3f52', glyph: '⬤' },
  invert: { colour: '#9b4fe8', glyph: '⇄' },
  fog: { colour: '#9aa8c0', glyph: '☁' },
};

/** Cells a modifier covers on the top view: its zone, or its own cell. */
export const modifierCells = (m: Modifier): [number, number][] => ('size' in m ? cellsOf(m) : [[m.cell[0], m.cell[2]]]);

const drawModifier = (ctx: CanvasRenderingContext2D, v: View, m: Modifier, layer: number, chosen: boolean) => {
  const style = MODIFIER_STYLE[m.type];
  ctx.globalAlpha = m.cell[1] === layer ? 1 : 0.45;
  const cells = modifierCells(m);
  if ('size' in m) {
    ctx.fillStyle = style.colour;
    ctx.globalAlpha *= 0.35;
    for (const [i, k] of cells) {
      const [sx, sy] = toScreen(v, i * CELL - CELL / 2, k * CELL - CELL / 2);
      ctx.fillRect(sx, sy, CELL * v.zoom, CELL * v.zoom);
    }
    ctx.globalAlpha = m.cell[1] === layer ? 1 : 0.45;
  }
  const [x, , z] = cellToWorld(m.cell);
  const [sx, sy] = toScreen(v, x, z);
  if (m.type === 'sweeper') {
    ctx.strokeStyle = style.colour;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(sx, sy, m.length * CELL * v.zoom, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if ('rot' in m) {
    const [fx, fz] = forwardOf(m.rot);
    const reach = CELL * 0.45 * v.zoom;
    ctx.strokeStyle = style.colour;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx - fx * reach, sy - fz * reach);
    ctx.lineTo(sx + fx * reach, sy + fz * reach);
    ctx.lineTo(sx + fx * reach * 0.5 - fz * reach * 0.4, sy + fz * reach * 0.5 + fx * reach * 0.4);
    ctx.moveTo(sx + fx * reach, sy + fz * reach);
    ctx.lineTo(sx + fx * reach * 0.5 + fz * reach * 0.4, sy + fz * reach * 0.5 - fx * reach * 0.4);
    ctx.stroke();
    ctx.lineWidth = 1;
  }
  ctx.fillStyle = style.colour;
  ctx.font = `bold ${Math.max(11, v.zoom * 0.9)}px system-ui, sans-serif`;
  ctx.fillText(style.glyph, sx, sy + ('rot' in m ? v.zoom * 0.55 : 0));
  if (chosen) {
    ctx.strokeStyle = '#1f6fff';
    ctx.lineWidth = 2;
    for (const [i, k] of cells) {
      const [cx, cy] = toScreen(v, i * CELL - CELL / 2, k * CELL - CELL / 2);
      ctx.strokeRect(cx + 2, cy + 2, CELL * v.zoom - 4, CELL * v.zoom - 4);
    }
    ctx.lineWidth = 1;
  }
  ctx.globalAlpha = 1;
};

const drawShape = (ctx: CanvasRenderingContext2D, v: View, shape: TrackShape, alpha: number) => {
  ctx.globalAlpha = alpha;
  for (const f of shape.floors) {
    const [x0, y0] = toScreen(v, f.minX, f.minZ);
    const [x1, y1] = toScreen(v, f.maxX, f.maxZ);
    ctx.fillStyle = colour(f.tag);
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.strokeStyle = 'rgba(60,70,110,.35)';
    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
  }
  for (const t of shape.triangles) {
    ctx.beginPath();
    t.points.forEach(([x, , z], i) => {
      const [sx, sy] = toScreen(v, x, z);
      if (i) ctx.lineTo(sx, sy);
      else ctx.moveTo(sx, sy);
    });
    ctx.closePath();
    ctx.fillStyle = colour(t.tag);
    ctx.strokeStyle = colour(t.tag);
    ctx.fill();
    ctx.stroke();
  }
  for (const b of shape.barriers) {
    ctx.beginPath();
    b.points.forEach(([x, , z], i) => {
      const [sx, sy] = toScreen(v, x, z);
      if (i) ctx.lineTo(sx, sy);
      else ctx.moveTo(sx, sy);
    });
    ctx.lineWidth = Math.max(2, b.thickness * v.zoom);
    ctx.strokeStyle = '#7a6ad0';
    ctx.stroke();
    ctx.lineWidth = 1;
  }
  ctx.globalAlpha = 1;
};

/** Lowest height of a piece, in steps, used to fade pieces on other layers. */
export const pieceLayer = (piece: Piece): number =>
  piece.type === 'movingPlatform' ? (piece.path[0]?.[1] ?? 0) : piece.cell[1];

const drawGrid = (ctx: CanvasRenderingContext2D, v: View) => {
  const [minX, minZ] = toWorldXZ(v, 0, 0);
  const [maxX, maxZ] = toWorldXZ(v, v.width, v.height);
  ctx.strokeStyle = 'rgba(80,100,150,.12)';
  ctx.beginPath();
  for (let x = Math.floor(minX / CELL) * CELL - 1; x <= maxX; x += CELL) {
    const [sx] = toScreen(v, x, 0);
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, v.height);
  }
  for (let z = Math.floor(minZ / CELL) * CELL - 1; z <= maxZ; z += CELL) {
    const [, sy] = toScreen(v, 0, z);
    ctx.moveTo(0, sy);
    ctx.lineTo(v.width, sy);
  }
  ctx.stroke();
};

export type Ghost = { piece?: Piece; cell?: [number, number] };

/** Top view of the level: grid, pieces (faded off the current layer), entities, spawn, selection. */
export const drawLevel = (
  ctx: CanvasRenderingContext2D,
  v: View,
  level: Level,
  selection: readonly Selection[],
  layer: number,
  ghost: Ghost,
) => {
  ctx.clearRect(0, 0, v.width, v.height);
  ctx.fillStyle = '#eef4ff';
  ctx.fillRect(0, 0, v.width, v.height);
  drawGrid(ctx, v);

  const chosen = new Set(selection.filter((s) => s.kind === 'piece').map((s) => s.index));
  level.pieces.forEach((piece, i) => {
    const b = built(piece);
    const alpha = pieceLayer(piece) === layer ? 1 : 0.4;
    drawShape(ctx, v, b.shape, alpha);
    if (b.body) {
      ctx.setLineDash([4, 3]);
      drawShape(ctx, v, b.body, alpha * 0.9);
      ctx.setLineDash([]);
    }
    if (piece.type === 'movingPlatform') {
      ctx.strokeStyle = '#7a6ad0';
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      piece.path.forEach((p, n) => {
        const [x, , z] = cellToWorld(p);
        const [sx, sy] = toScreen(v, x, z);
        if (n) ctx.lineTo(sx, sy);
        else ctx.moveTo(sx, sy);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (chosen.has(i)) {
      ctx.strokeStyle = '#1f6fff';
      ctx.lineWidth = 2;
      const cells = b.footprint.length ? b.footprint : [];
      for (const c of cells) {
        const [sx, sy] = toScreen(v, c.i * CELL - CELL / 2, c.k * CELL - CELL / 2);
        ctx.strokeRect(sx + 1, sy + 1, CELL * v.zoom - 2, CELL * v.zoom - 2);
      }
      for (const barrier of b.shape.barriers) {
        const [a, z] = [barrier.points[0], barrier.points[barrier.points.length - 1]];
        if (!a || !z) continue;
        ctx.beginPath();
        ctx.moveTo(...toScreen(v, a[0], a[2]));
        ctx.lineTo(...toScreen(v, z[0], z[2]));
        ctx.lineWidth = 6;
        ctx.strokeStyle = 'rgba(31,111,255,.5)';
        ctx.stroke();
      }
      if (b.body) {
        ctx.strokeStyle = '#1f6fff';
        drawShape(ctx, v, b.body, 0.6);
      }
      ctx.lineWidth = 1;
    }
    const height = pieceLayer(piece);
    if (height !== 0 && b.nav.nodes[0]) {
      const [x, , z] = b.nav.nodes[0];
      const [sx, sy] = toScreen(v, x, z);
      ctx.fillStyle = 'rgba(40,50,90,.6)';
      ctx.font = '10px system-ui, sans-serif';
      ctx.fillText(`${height * STEP > 0 ? '+' : ''}${height * STEP}`, sx - 8, sy + 12);
    }
  });

  const entityChosen = new Set(selection.filter((s) => s.kind === 'entity').map((s) => s.index));
  const modifierChosen = new Set(selection.filter((s) => s.kind === 'modifier').map((s) => s.index));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  level.modifiers.forEach((m, i) => drawModifier(ctx, v, m, layer, modifierChosen.has(i)));
  level.entities.forEach((e, i) => {
    const [x, , z] = cellToWorld(e.cell);
    const [sx, sy] = toScreen(v, x, z);
    const style = ENTITY_STYLE[e.type];
    ctx.font = `${Math.max(12, v.zoom * 1.1)}px system-ui, sans-serif`;
    ctx.fillStyle = style.colour;
    ctx.globalAlpha = e.cell[1] === layer ? 1 : 0.5;
    ctx.fillText(style.glyph, sx, sy);
    ctx.globalAlpha = 1;
    if (entityChosen.has(i)) {
      ctx.strokeStyle = '#1f6fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy, v.zoom * 0.8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1;
    }
  });
  const [spx, , spz] = cellToWorld(level.spawn.cell);
  const [ssx, ssy] = toScreen(v, spx, spz);
  ctx.fillStyle = '#ff5d86';
  ctx.beginPath();
  ctx.arc(ssx, ssy, Math.max(4, v.zoom * 0.42), 0, Math.PI * 2);
  ctx.fill();
  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';

  if (ghost.piece) {
    const b = buildPiece(ghost.piece);
    drawShape(ctx, v, b.shape, 0.45);
    if (b.body) drawShape(ctx, v, b.body, 0.45);
  } else if (ghost.cell) {
    const [sx, sy] = toScreen(v, ghost.cell[0] * CELL - CELL / 2, ghost.cell[1] * CELL - CELL / 2);
    ctx.strokeStyle = 'rgba(31,111,255,.6)';
    ctx.strokeRect(sx, sy, CELL * v.zoom, CELL * v.zoom);
  }
};

/** What is under a click: entities first, then the last piece covering the cell or with a wall there. */
export const hitTest = (level: Level, v: View, sx: number, sy: number, layer: number): Selection | undefined => {
  const [x, z] = toWorldXZ(v, sx, sy);
  const [i, k] = [Math.round(x / CELL), Math.round(z / CELL)];
  const entity = level.entities.findIndex((e) => e.cell[0] === i && e.cell[2] === k);
  if (entity >= 0) return { kind: 'entity', index: entity };
  const modifiers = level.modifiers
    .map((m, index) => ({ m, index }))
    .filter(({ m }) => modifierCells(m).some(([mi, mk]) => mi === i && mk === k));
  const modifier = (modifiers.filter(({ m }) => m.cell[1] === layer).at(-1) ?? modifiers.at(-1))?.index;
  if (modifier !== undefined) return { kind: 'modifier', index: modifier };
  const hits = level.pieces
    .map((piece, index) => ({ piece, index, b: built(piece) }))
    .filter(({ b, piece }) => {
      if (b.footprint.some((c) => c.i === i && c.k === k)) return true;
      if (piece.type === 'movingPlatform')
        return piece.path.some(([px, , pz]) => Math.abs(px - i) <= 0.5 && Math.abs(pz - k) <= 0.5);
      return b.shape.barriers.some(({ points }) =>
        points.slice(1).some((p, n) => {
          const a = points[n] ?? p;
          const [dx, dz] = [p[0] - a[0], p[2] - a[2]];
          const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[2]) * dz) / (dx * dx + dz * dz || 1)));
          return Math.hypot(x - a[0] - dx * t, z - a[2] - dz * t) < 0.6;
        }),
      );
    });
  const onLayer = hits.filter(({ piece }) => pieceLayer(piece) === layer);
  const best = (onLayer.length ? onLayer : hits).at(-1);
  return best && { kind: 'piece', index: best.index };
};
