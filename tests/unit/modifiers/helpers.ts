import { startHeadless, type HeadlessRun } from '../../../src/game/headless';
import type { LevelInput } from '../../../src/levels/schema';
import { levelWith } from '../helpers';

type ModifierInput = NonNullable<LevelInput['modifiers']>[number];
type Point = { x: number; y: number; z: number };

/** A 9 × 9 platform (cells -4..4) with some modifiers on it; crystal and goal in a far corner. */
export const playground = (modifiers: ModifierInput[], extra: Partial<LevelInput> = {}): HeadlessRun =>
  startHeadless(
    levelWith([{ type: 'platform', cell: [0, 0, 0], size: [9, 9] }], {
      entities: [
        { type: 'crystal', cell: [4, 0, 4] },
        { type: 'goal', cell: [-4, 0, 4] },
      ],
      modifiers,
      ...extra,
    }),
  );

const STILL = { x: 0, y: 0 };

export const steps = (run: HeadlessRun, n: number, input = STILL): void => {
  for (let i = 0; i < n; i++) run.step(input);
};

export const seconds = (run: HeadlessRun, s: number, input = STILL): void => steps(run, Math.round(s * 120), input);

/** Puts the ball at rest on the floor of cell (i, k). */
export const placeOn = (run: HeadlessRun, i: number, k: number, y = 0.42): void => run.ball.placeAt(i * 2, y, k * 2);

export const copy = ({ x, y, z }: Point): Point => ({ x, y, z });

/** Records the events of a run by name. */
export const record = (run: HeadlessRun) => {
  const seen: string[] = [];
  for (const type of [
    'modifierFired',
    'effectEnded',
    'shieldSaved',
    'fell',
    'crystalCollected',
    'hiddenGemFound',
  ] as const)
    run.events.on(type, () => seen.push(type));
  return seen;
};
