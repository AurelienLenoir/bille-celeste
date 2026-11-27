import type RAPIER from '@dimforge/rapier3d-compat';
import { addTrackCollider } from '../engine/physics';
import { buildTrackMesh, emptyShape, mergeShape, type TrackMesh, type TrackShape } from '../engine/trackCollider';
import { cellToWorld } from '../levels/grid';
import type { Level, Modifier } from '../levels/schema';
import { createCheckpoint, type Checkpoint } from './entities/checkpoint';
import { createCrystal, type Crystal } from './entities/crystal';
import { createGoal, type Goal } from './entities/goal';
import { createHiddenGem, type HiddenGem } from './entities/hiddenGem';
import { createModifier } from './modifiers';
import { createSensor, type ModifierInstance } from './modifiers/kit';
import { buildPiece, createPieceMover } from './pieces';
import { COURSE_GROUPS } from './pieces/body';
import type { BuildContext, Mover } from './pieces/kit';
import { createTrackMeshes } from './trackView';

export type Point = { x: number; y: number; z: number };

/** A bonus or malus in play, with its Rapier sensor when it has a trigger. */
export type LiveModifier = { data: Modifier; instance: ModifierInstance; sensor?: RAPIER.Collider };

export type LevelWorld = {
  spawn: Point;
  parTimeSec: number;
  movers: Mover[];
  /** The mover built for each piece, by piece index (undefined for static pieces). */
  moverByPiece: (Mover | undefined)[];
  crystals: Crystal[];
  checkpoints: Checkpoint[];
  goal: Goal;
  gem?: HiddenGem;
  modifiers: LiveModifier[];
  track: TrackMesh;
};

const point = ([x, y, z]: readonly [number, number, number]): Point => ({ x, y, z });

/** Static surfaces of a level (every non-moving piece), merged into one shape. */
export const levelTrackShape = (level: Level): TrackShape => {
  const shape = emptyShape();
  level.pieces.forEach((piece) => mergeShape(shape, buildPiece(piece).shape));
  return shape;
};

/** Merged static geometry of a level. */
export const levelTrackMesh = (level: Level): TrackMesh => buildTrackMesh(levelTrackShape(level));

/**
 * Builds the course, collectibles and goal of a level into the physics world and scene. Every
 * static piece goes into one merged trimesh collider so joints between pieces are seamless, and
 * into one mesh per material so the whole course costs a handful of draw calls.
 */
export const buildLevel = (ctx: BuildContext, level: Level): LevelWorld => {
  const shape = levelTrackShape(level);
  const track = buildTrackMesh(shape);
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
  const [gem] = cells('hiddenGem');
  const modifiers = level.modifiers.map((data): LiveModifier => {
    const instance = createModifier({ ...ctx, ground: [shape] }, data);
    return instance.trigger
      ? { data, instance, sensor: createSensor(ctx.world, instance.trigger) }
      : { data, instance };
  });
  return {
    spawn: point(cellToWorld(level.spawn.cell)),
    parTimeSec: level.parTimeSec,
    movers,
    moverByPiece,
    crystals: cells('crystal').map((p, i) => createCrystal(ctx.scene, p, i)),
    checkpoints: cells('checkpoint').map((p) => createCheckpoint(ctx.scene, p)),
    goal: createGoal(ctx.scene, goal ?? [0, 0, 0]),
    ...(gem ? { gem: createHiddenGem(ctx.scene, gem) } : {}),
    modifiers,
    track,
  };
};
