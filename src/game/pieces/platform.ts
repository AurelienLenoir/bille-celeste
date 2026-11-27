import { emptyShape } from '../../engine/trackCollider';
import { CELL, STEP } from '../../levels/grid';
import type { PieceOf } from '../../levels/schema';
import { emptyNav, perimeterPorts, surfaceTag, type PieceBuild, type PieceModule } from './kit';

type Platform = PieceOf<'platform'>;

/** Cell range covered by a platform: `cell` is its centre (the cell just before it when the size is even). */
export const platformCells = ({ cell: [ci, , ck], size, rot }: Platform) => {
  const [w, d] = rot === 90 || rot === 270 ? [size[1], size[0]] : size;
  const i0 = ci - Math.floor((w - 1) / 2);
  const k0 = ck - Math.floor((d - 1) / 2);
  return { i0, i1: i0 + w - 1, k0, k1: k0 + d - 1 };
};

/** Flat rest area, one nav node per cell, open on every side. */
const build = (piece: Platform): PieceBuild => {
  const { i0, i1, k0, k1 } = platformCells(piece);
  const y = piece.cell[1] * STEP;
  const shape = emptyShape();
  const half = CELL / 2;
  shape.floors.push({
    minX: i0 * CELL - half,
    maxX: i1 * CELL + half,
    minZ: k0 * CELL - half,
    maxZ: k1 * CELL + half,
    y,
    tag: surfaceTag(piece.surface),
  });

  const nav = emptyNav();
  const footprint = [];
  const index = new Map<string, number>();
  for (let i = i0; i <= i1; i++) {
    for (let k = k0; k <= k1; k++) {
      const node = nav.nodes.length;
      index.set(`${i},${k}`, node);
      nav.nodes.push([i * CELL, y, k * CELL]);
      footprint.push({ i, k, yMin: y, yMax: y });
      const left = index.get(`${i - 1},${k}`);
      const up = index.get(`${i},${k - 1}`);
      if (left !== undefined) nav.links.push({ from: left, to: node });
      if (up !== undefined) nav.links.push({ from: up, to: node });
      const box = [i * CELL - half, i * CELL + half, k * CELL - half, k * CELL + half] as const;
      const outer = perimeterPorts(node, box, y).filter(({ dir: [dx, dz] }) => {
        const [ni, nk] = [i + dx, k + dz];
        return ni < i0 || ni > i1 || nk < k0 || nk > k1;
      });
      nav.ports.push(...outer);
    }
  }
  return { shape, nav, footprint };
};

export const platform: PieceModule<Platform> = { build };
