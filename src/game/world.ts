import { addTrackCollider } from '../engine/physics';
import { buildTrackMesh, emptyShape, mergeShape, type TrackMesh } from '../engine/trackCollider';
import { cellToWorld } from '../levels/grid';
import type { Level } from '../levels/schema';
import { createCheckpoint, type Checkpoint } from './entities/checkpoint';
import { createCrystal, type Crystal } from './entities/crystal';
import { createGoal, type Goal } from './entities/goal';
import { buildPiece, createPieceMover } from './pieces';
import { COURSE_GROUPS } from './pieces/body';
import type { BuildContext, Mover } from './pieces/kit';
import { createTrackMeshes } from './trackView';

export type Point = { x: number; y: number; z: number };

export type LevelWorld = {
  spawn: Point;
  movers: Mover[];
  /** The mover built for each piece, by piece index (undefined for static pieces). */
  moverByPiece: (Mover | undefined)[];
  crystals: Crystal[];
  checkpoints: Checkpoint[];
  goal: Goal;
  track: TrackMesh;
};

const point = ([x, y, z]: readonly [number, number, number]): Point => ({ x, y, z });

/** Merged static geometry of a level (every non-moving piece). */
export const levelTrackMesh = (level: Level): TrackMesh => {
  const shape = emptyShape();
  level.pieces.forEach((piece) => mergeShape(shape, buildPiece(piece).shape));
  return buildTrackMesh(shape);
};

/**
 * Builds the course, collectibles and goal of a level into the physics world and scene. Every
 * static piece goes into one merged trimesh collider so joints between pieces are seamless, and
 * into one mesh per material so the whole course costs a handful of draw calls.
 */
export const buildLevel = (ctx: BuildContext, level: Level): LevelWorld => {
  const track = levelTrackMesh(level);
  addTrackCollider(ctx.world, track, COURSE_GROUPS);
  createTrackMeshes(track, ctx.materials).forEach((mesh) => ctx.scene.add(mesh));

  const moverByPiece = level.pieces.map((piece) => createPieceMover(ctx, piece));
  const movers = moverByPiece.flatMap((m) => m ?? []);
  movers.forEach((mover) => {
    mover.reset();
    mover.syncMesh(1);
  });

  const cells = (type: string) => level.entities.filter((e) => e.type === type).map((e) => cellToWorld(e.cell));
  const [goal] = cells('goal');
  return {
    spawn: point(cellToWorld(level.spawn.cell)),
    movers,
    moverByPiece,
    crystals: cells('crystal').map((p, i) => createCrystal(ctx.scene, p, i)),
    checkpoints: cells('checkpoint').map((p) => createCheckpoint(ctx.scene, p)),
    goal: createGoal(ctx.scene, goal ?? [0, 0, 0]),
    track,
  };
};
