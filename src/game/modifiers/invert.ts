import type { ModifierOf } from '../../levels/schema';
import { createDecal, zoneTrigger, type ModifierModule } from './kit';

/** Inverted zone (malus): left is right and forward is back while the ball is inside. */
export const invert: ModifierModule<ModifierOf<'invert'>> = {
  kind: 'malus',
  sound: [
    { frequency: 440, to: 660, duration: 0.15, wave: 'square', volume: 0.05 },
    { frequency: 660, to: 330, duration: 0.2, wave: 'square', volume: 0.05, at: 0.15 },
  ],
  haptic: 'buzz',
  trigger: zoneTrigger,
  create: (ctx, m) => {
    // Diagonal stripes, like a warning sign.
    const decal = createDecal(ctx, m, { base: 0xb36bff, accent: 0xffffff }, (x, z) =>
      Math.floor((x + z) / 0.75) % 2 === 0 ? 0.55 : 0,
    );
    const material = decal.material as { opacity: number };
    return {
      trigger: zoneTrigger(m),
      onEnter: (run) => run.fire(),
      inside: (run) => (run.effects.invert = true),
      reset: () => undefined,
      syncMesh: (_alpha, clock) => (material.opacity = 0.7 + Math.sin(clock * 4) * 0.12),
    };
  },
};
