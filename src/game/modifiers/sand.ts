import type { ModifierOf } from '../../levels/schema';
import { createDecal, hash2, zoneTrigger, type ModifierModule } from './kit';

/** Sand or mud: high friction and a lot of drag, the ball crawls. */
export const SAND_GRIP = { friction: 1, damping: 2.6 } as const;

/** Sand / mud (malus): slows the ball down a lot. */
export const sand: ModifierModule<ModifierOf<'sand'>> = {
  kind: 'malus',
  sound: [{ frequency: 420, to: 180, duration: 0.4, wave: 'noise', volume: 0.14 }],
  haptic: 'buzz',
  trigger: zoneTrigger,
  create: (ctx, m) => {
    createDecal(
      ctx,
      m,
      { base: 0xd9b878, accent: 0x9a7444 },
      (x, z) => hash2(Math.floor(x * 3), Math.floor(z * 3)) * 0.8,
      1,
    );
    return {
      trigger: zoneTrigger(m),
      onEnter: (run) => run.fire(),
      inside: (run) => (run.effects.grip = SAND_GRIP),
      reset: () => undefined,
      syncMesh: () => undefined,
    };
  },
};
