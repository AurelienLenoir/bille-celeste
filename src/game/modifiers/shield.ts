import * as THREE from 'three';
import type { ModifierOf } from '../../levels/schema';
import { createPickup, pickupTrigger, type ModifierModule } from './kit';

/** Shield bubble (bonus): the next fall puts the ball back where it was, without counting a fall. */
export const shield: ModifierModule<ModifierOf<'shield'>> = {
  kind: 'bonus',
  sound: [
    { frequency: 660, to: 990, duration: 0.18, volume: 0.1 },
    { frequency: 990, to: 1480, duration: 0.3, volume: 0.08, at: 0.08 },
  ],
  haptic: 'double',
  trigger: pickupTrigger,
  create: (ctx, m) =>
    createPickup(ctx, m, { geometry: new THREE.SphereGeometry(0.34, 20, 14), colour: 0x6fe3ff, opacity: 0.65 }, (run) =>
      run.grant('shield'),
    ),
};
