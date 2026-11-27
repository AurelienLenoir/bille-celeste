import type { PieceOf } from '../../levels/schema';
import type { PieceModule } from './kit';
import { buildRun } from './straight';

/** Narrow plank without rails. */
export const bridge: PieceModule<PieceOf<'bridge'>> = {
  build: (piece) => buildRun({ ...piece, rails: 'none' }),
};
