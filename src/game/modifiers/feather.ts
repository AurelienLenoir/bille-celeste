import * as THREE from 'three';
import type { ModifierOf } from '../../levels/schema';
import { createPickup, mergeGeometries, pickupTrigger, type ModifierModule } from './kit';

const look = () =>
  mergeGeometries([
    new THREE.SphereGeometry(0.3, 12, 8).scale(0.4, 1, 0.12).rotateZ(-0.5),
    new THREE.CylinderGeometry(0.02, 0.02, 0.62, 6).rotateZ(-0.5),
  ]);

/** Feather ball (bonus): lower gravity for 6 s, so jumps carry further. */
export const feather: ModifierModule<ModifierOf<'feather'>> = {
  kind: 'bonus',
  sound: [
    { frequency: 2000, to: 6000, duration: 0.4, wave: 'noise', volume: 0.08 },
    { frequency: 1046, to: 1568, duration: 0.35, volume: 0.07 },
  ],
  haptic: 'double',
  trigger: pickupTrigger,
  create: (ctx, m) =>
    createPickup(ctx, m, { geometry: look(), colour: 0xf4f8ff, emissive: 0xb0c8ff }, (run) => run.grant('feather')),
};
