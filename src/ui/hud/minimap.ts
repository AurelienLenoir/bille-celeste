import { buildPiece } from '../../game/pieces';
import { CELL } from '../../levels/grid';
import type { Level } from '../../levels/schema';

type Flat = { x: number; z: number };
export type MapMarks = {
  ball: Flat;
  crystals: readonly (Flat & { taken: boolean })[];
  checkpoints: readonly (Flat & { active: boolean })[];
  goal: Flat & { open: boolean };
};

export type Minimap = {
  /** Draws the course of a new level once, in the background layer. */
  setLevel: (level: Level) => void;
  /** Redraws the marks: ball, crystals left, checkpoints, goal. */
  draw: (marks: MapMarks) => void;
};

const SIZE = 104;
const PAD = 7;

/**
 * Small map in the corner of the screen (top-down, far end at the top like the camera's view):
 * the course, the crystals still to pick up, the checkpoints, the goal and the ball. The hidden
 * gem is not shown. The course is drawn once per level; only the marks are redrawn.
 */
export const createMinimap = (canvas: HTMLCanvasElement): Minimap => {
  const ratio = Math.min(2, devicePixelRatio || 1);
  canvas.width = canvas.height = SIZE * ratio;
  const ctx = canvas.getContext('2d');
  const course = document.createElement('canvas');
  course.width = course.height = SIZE * ratio;
  const courseCtx = course.getContext('2d');
  let toMap = (p: Flat): Flat => p;
  let unit = 1;

  const setLevel = (level: Level) => {
    if (!courseCtx) return;
    const cells: Flat[] = [];
    const paths: Flat[][] = [];
    for (const piece of level.pieces) {
      buildPiece(piece).footprint.forEach(({ i, k }) => cells.push({ x: i * CELL, z: k * CELL }));
      if (piece.type === 'movingPlatform') paths.push(piece.path.map(([i, , k]) => ({ x: i * CELL, z: k * CELL })));
    }
    const all = [...cells, ...paths.flat()];
    const xs = all.map((p) => p.x);
    const zs = all.map((p) => p.z);
    const [x0, x1, z0, z1] = [
      Math.min(...xs) - CELL,
      Math.max(...xs) + CELL,
      Math.min(...zs) - CELL,
      Math.max(...zs) + CELL,
    ];
    unit = ((SIZE - PAD * 2) * ratio) / Math.max(x1 - x0, z1 - z0, 1);
    const ox = (SIZE * ratio - (x1 - x0) * unit) / 2;
    const oz = (SIZE * ratio - (z1 - z0) * unit) / 2;
    toMap = (p) => ({ x: ox + (p.x - x0) * unit, z: oz + (p.z - z0) * unit });

    courseCtx.clearRect(0, 0, course.width, course.height);
    courseCtx.fillStyle = 'rgba(255, 250, 240, 0.85)';
    for (const c of cells) {
      const { x, z } = toMap({ x: c.x - CELL / 2, z: c.z - CELL / 2 });
      courseCtx.fillRect(x, z, CELL * unit + 0.5, CELL * unit + 0.5);
    }
    courseCtx.strokeStyle = 'rgba(210, 199, 255, 0.95)';
    courseCtx.lineWidth = Math.max(1.5, unit * 1.2);
    courseCtx.setLineDash([unit, unit * 0.8]);
    for (const path of paths) {
      courseCtx.beginPath();
      path.map(toMap).forEach(({ x, z }, n) => (n ? courseCtx.lineTo(x, z) : courseCtx.moveTo(x, z)));
      courseCtx.stroke();
    }
    courseCtx.setLineDash([]);
  };

  const dot = (p: Flat, radius: number, fill: string, stroke?: string) => {
    if (!ctx) return;
    const { x, z } = toMap(p);
    ctx.beginPath();
    ctx.arc(x, z, radius * ratio, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.lineWidth = 1.5 * ratio;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  };

  const draw = ({ ball, crystals, checkpoints, goal }: MapMarks) => {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(course, 0, 0);
    checkpoints.forEach((c) => dot(c, 2.5, c.active ? '#3fcf8e' : '#b8c3d6'));
    crystals.forEach((c) => !c.taken && dot(c, 2.5, '#4fd8ff', '#ffffff'));
    dot(goal, 3.5, goal.open ? '#ffc93c' : 'rgba(255, 255, 255, 0.2)', goal.open ? '#8a5a00' : '#b8c3d6');
    dot(ball, 3.5, '#ff5d86', '#ffffff');
  };

  return { setLevel, draw };
};
