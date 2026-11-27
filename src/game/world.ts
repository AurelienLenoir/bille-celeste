import type { LevelData, PieceData } from '../levels/types';
import { buildBox, type BoxSpec, type BuildContext } from './pieces/box';
import { createMovingPlatform, movingPlatformBox, type MovingPlatform } from './pieces/movingPlatform';
import { ramp } from './pieces/ramp';
import { slab } from './pieces/slab';
import { wall } from './pieces/wall';
import { createCheckpoint, type Checkpoint } from './entities/checkpoint';
import { createCrystal, type Crystal } from './entities/crystal';
import { createGoal, type Goal } from './entities/goal';

export type LevelWorld = {
  movers: MovingPlatform[];
  crystals: Crystal[];
  checkpoints: Checkpoint[];
  goal: Goal;
};

const staticBoxes = (piece: Exclude<PieceData, { type: 'movingPlatform' }>): BoxSpec[] => {
  switch (piece.type) {
    case 'slab':
      return slab(piece);
    case 'wall':
      return wall(piece);
    case 'ramp':
      return ramp(piece);
  }
};

/** Builds the course, collectibles and goal of a level into the physics world and scene. */
export const buildLevel = (ctx: BuildContext, level: LevelData): LevelWorld => {
  const movers: MovingPlatform[] = [];
  for (const piece of level.pieces) {
    if (piece.type === 'movingPlatform') {
      movers.push(createMovingPlatform(piece, buildBox(ctx, movingPlatformBox(piece))));
    } else {
      staticBoxes(piece).forEach((spec) => buildBox(ctx, spec));
    }
  }
  return {
    movers,
    crystals: level.crystals.map((p, i) => createCrystal(ctx.scene, p, i)),
    checkpoints: level.checkpoints.map((p) => createCheckpoint(ctx.scene, p)),
    goal: createGoal(ctx.scene, level.goal),
  };
};
