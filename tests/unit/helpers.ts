import { readFileSync } from 'node:fs';
import { loadLevel } from '../../src/levels/loader';
import { LEVEL_VERSION, type Level, type LevelInput, type Piece } from '../../src/levels/schema';

type PieceInput = LevelInput['pieces'][number];

/** Smallest valid level around some pieces (one crystal and the goal at the spawn). */
export const levelWith = (pieces: PieceInput[], extra: Partial<LevelInput> = {}): Level =>
  loadLevel({
    id: 'test',
    version: LEVEL_VERSION,
    name: { fr: 'Test', en: 'Test' },
    world: 1,
    parTimeSec: 30,
    spawn: { cell: [0, 0, 0] },
    pieces,
    entities: [
      { type: 'crystal', cell: [0, 0, 0] },
      { type: 'goal', cell: [0, 0, 0] },
    ],
    decor: {},
    ...extra,
  });

/** A piece with every default filled in by the schema. */
export const piece = <P extends PieceInput>(input: P): Extract<Piece, { type: P['type'] }> =>
  levelWith([input]).pieces[0] as Extract<Piece, { type: P['type'] }>;

export const shippedLevel = (id: string): Level =>
  loadLevel(JSON.parse(readFileSync(`src/levels/data/${id}.json`, 'utf8')));
