import type { Piece, PieceOf, PieceType } from '../../levels/schema';
import { bridge } from './bridge';
import { curve } from './curve';
import { fallingTile } from './fallingTile';
import { funnel } from './funnel';
import { gap } from './gap';
import { halfPipe } from './halfPipe';
import type { BuildContext, Mover, PieceBuild, PieceModule } from './kit';
import { movingPlatform } from './movingPlatform';
import { platform } from './platform';
import { ramp } from './ramp';
import { rotatingPlatform } from './rotatingPlatform';
import { seesaw } from './seesaw';
import { stairs } from './stairs';
import { straight } from './straight';
import { wall } from './wall';

/** Piece library v1 (PLAN.md § 3.2). */
export const PIECES: { [T in PieceType]: PieceModule<PieceOf<T>> } = {
  platform,
  straight,
  curve,
  ramp,
  halfPipe,
  funnel,
  bridge,
  gap,
  wall,
  stairs,
  movingPlatform,
  rotatingPlatform,
  fallingTile,
  seesaw,
};

const moduleOf = (piece: Piece) => PIECES[piece.type] as PieceModule<Piece>;

export const buildPiece = (piece: Piece): PieceBuild => moduleOf(piece).build(piece);

export const createPieceMover = (ctx: BuildContext, piece: Piece): Mover | undefined =>
  moduleOf(piece).createMover?.(ctx, piece);
