import { addTrackCollider } from '../engine/physics';
import { buildTrackMesh } from '../engine/trackCollider';
import type { LevelData, PieceData } from '../levels/types';
import { buildBoxMesh, type BoxSpec, type BuildContext } from './pieces/box';
import { createMovingPlatform, movingPlatformBox, type MovingPlatform } from './pieces/movingPlatform';
import { ramp, rampCollision } from './pieces/ramp';
import type { PieceCollision } from './pieces/shape';
import { slab, slabCollision } from './pieces/slab';
import { wall, wallCollision } from './pieces/wall';
import { createCheckpoint, type Checkpoint } from './entities/checkpoint';
import { createCrystal, type Crystal } from './entities/crystal';
import { createGoal, type Goal } from './entities/goal';

export type LevelWorld = {
  movers: MovingPlatform[];
  crystals: Crystal[];
  checkpoints: Checkpoint[];
  goal: Goal;
};

type StaticPiece = Exclude<PieceData, { type: 'movingPlatform' }>;

const staticPiece = (piece: StaticPiece): { boxes: BoxSpec[]; collision: PieceCollision } => {
  switch (piece.type) {
    case 'slab':
      return { boxes: slab(piece), collision: slabCollision(piece) };
    case 'wall':
      return { boxes: wall(piece), collision: wallCollision(piece) };
    case 'ramp':
      return { boxes: ramp(piece), collision: rampCollision(piece) };
  }
};

/**
 * Builds the course, collectibles and goal of a level into the physics world and scene.
 * Every static piece goes into one merged trimesh collider so joints between pieces are seamless.
 */
export const buildLevel = (ctx: BuildContext, level: LevelData): LevelWorld => {
  const movers: MovingPlatform[] = [];
  const track: PieceCollision = { floors: [], solids: [] };
  for (const piece of level.pieces) {
    if (piece.type === 'movingPlatform') {
      movers.push(createMovingPlatform(ctx.world, piece, buildBoxMesh(ctx, movingPlatformBox(piece))));
      continue;
    }
    const { boxes, collision } = staticPiece(piece);
    boxes.forEach((spec) => buildBoxMesh(ctx, spec));
    track.floors.push(...collision.floors);
    track.solids.push(...collision.solids);
  }
  addTrackCollider(ctx.world, buildTrackMesh(track.floors, track.solids));
  return {
    movers,
    crystals: level.crystals.map((p, i) => createCrystal(ctx.scene, p, i)),
    checkpoints: level.checkpoints.map((p) => createCheckpoint(ctx.scene, p)),
    goal: createGoal(ctx.scene, level.goal),
  };
};
