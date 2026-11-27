import type { ModifierOf } from '../../levels/schema';
import { createDecal, hash2, zoneTrigger, type ModifierModule } from './kit';

/** Friction of the ball on ice: almost none. */
export const ICE_GRIP = { friction: 0.02, damping: 0 } as const;

/** Ice (malus): the ball slides, it no longer rolls to a stop. */
export const ice: ModifierModule<ModifierOf<'ice'>> = {
  kind: 'malus',
  sound: [
    { frequency: 2093, duration: 0.12, wave: 'triangle', volume: 0.07 },
    { frequency: 2637, duration: 0.18, wave: 'triangle', volume: 0.06, at: 0.06 },
  ],
  haptic: 'light',
  trigger: zoneTrigger,
  create: (ctx, m) => {
    const decal = createDecal(ctx, m, { base: 0xbfe9ff, accent: 0xffffff }, (x, z) =>
      hash2(Math.floor(x * 2), Math.floor(z * 2)) > 0.8 ? 1 : 0.25,
    );
    const material = decal.material as { opacity: number };
    return {
      trigger: zoneTrigger(m),
      onEnter: (run) => run.fire(),
      inside: (run) => (run.effects.grip = ICE_GRIP),
      reset: () => undefined,
      syncMesh: (_alpha, clock) => (material.opacity = 0.75 + Math.sin(clock * 1.3) * 0.08),
    };
  },
};
