import * as THREE from 'three';
import type { ModifierOf } from '../../levels/schema';
import { createPickup, pickupTrigger, type ModifierModule } from './kit';

/** Heavy ball (malus): gravity × 1.5 and less grip from the tilt, for 6 s. Cancels the feather. */
export const heavy: ModifierModule<ModifierOf<'heavy'>> = {
  kind: 'malus',
  sound: [
    { frequency: 160, to: 70, duration: 0.4, wave: 'square', volume: 0.07 },
    { frequency: 300, to: 120, duration: 0.3, wave: 'noise', volume: 0.1 },
  ],
  haptic: 'buzz',
  trigger: pickupTrigger,
  create: (ctx, m) =>
    createPickup(
      ctx,
      m,
      { geometry: new THREE.IcosahedronGeometry(0.32, 0), colour: 0x3b3f52, emissive: 0x2a1a44 },
      (run) => run.grant('heavy'),
    ),
};
