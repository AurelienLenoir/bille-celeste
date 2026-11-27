import * as THREE from 'three';
import type { ModifierOf } from '../../levels/schema';
import { createPickup, mergeGeometries, pickupTrigger, type ModifierModule } from './kit';

/** Clock face with two hands. */
const look = () =>
  mergeGeometries([
    new THREE.CylinderGeometry(0.3, 0.3, 0.08, 20).rotateX(Math.PI / 2),
    new THREE.BoxGeometry(0.04, 0.2, 0.04).translate(0, 0.1, 0.06),
    new THREE.BoxGeometry(0.15, 0.04, 0.04).translate(0.075, 0, 0.06),
  ]);

/** Slow motion (bonus): the game runs at 0.6 speed for 5 s; the chrono does not slow down. */
export const slowMo: ModifierModule<ModifierOf<'slowMo'>> = {
  kind: 'bonus',
  sound: [{ frequency: 880, to: 220, duration: 0.6, wave: 'triangle', volume: 0.12 }],
  haptic: 'double',
  trigger: pickupTrigger,
  create: (ctx, m) => createPickup(ctx, m, { geometry: look(), colour: 0x7fb8ff }, (run) => run.grant('slowMo')),
};
