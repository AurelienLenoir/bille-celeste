import * as THREE from 'three';
import type { ModifierOf } from '../../levels/schema';
import { createPickup, mergeGeometries, pickupTrigger, type ModifierModule } from './kit';

/** Horseshoe magnet. */
const look = () =>
  mergeGeometries([
    new THREE.TorusGeometry(0.24, 0.09, 8, 16, Math.PI).rotateZ(Math.PI),
    new THREE.CylinderGeometry(0.09, 0.09, 0.22, 8).translate(-0.24, 0.11, 0),
    new THREE.CylinderGeometry(0.09, 0.09, 0.22, 8).translate(0.24, 0.11, 0),
  ]);

/** Magnet (bonus): crystals within 4 units fly to the ball for 8 s. */
export const magnet: ModifierModule<ModifierOf<'magnet'>> = {
  kind: 'bonus',
  sound: [
    { frequency: 330, duration: 0.14, wave: 'triangle', volume: 0.1 },
    { frequency: 440, duration: 0.14, wave: 'triangle', volume: 0.1, at: 0.1 },
    { frequency: 660, duration: 0.25, wave: 'triangle', volume: 0.1, at: 0.2 },
  ],
  haptic: 'double',
  trigger: pickupTrigger,
  create: (ctx, m) => createPickup(ctx, m, { geometry: look(), colour: 0xff4d5e }, (run) => run.grant('magnet')),
};
