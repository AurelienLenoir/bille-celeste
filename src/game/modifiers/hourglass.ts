import * as THREE from 'three';
import type { ModifierOf } from '../../levels/schema';
import { HOURGLASS_SECONDS } from '../effects';
import { createPickup, mergeGeometries, pickupTrigger, type ModifierModule } from './kit';

const look = () =>
  mergeGeometries([
    new THREE.ConeGeometry(0.2, 0.28, 12).rotateX(Math.PI).translate(0, 0.14, 0),
    new THREE.ConeGeometry(0.2, 0.28, 12).translate(0, -0.14, 0),
    new THREE.CylinderGeometry(0.24, 0.24, 0.04, 12).translate(0, 0.3, 0),
    new THREE.CylinderGeometry(0.24, 0.24, 0.04, 12).translate(0, -0.3, 0),
  ]);

/** Hourglass (bonus): takes 5 s off the chrono. */
export const hourglass: ModifierModule<ModifierOf<'hourglass'>> = {
  kind: 'bonus',
  sound: [
    { frequency: 1200, duration: 0.05, wave: 'square', volume: 0.05 },
    { frequency: 900, duration: 0.05, wave: 'square', volume: 0.05, at: 0.12 },
    { frequency: 1568, duration: 0.3, wave: 'sine', volume: 0.1, at: 0.24 },
  ],
  haptic: 'double',
  trigger: pickupTrigger,
  create: (ctx, m) =>
    createPickup(ctx, m, { geometry: look(), colour: 0xffd04f }, (run) => run.shiftTimer(-HOURGLASS_SECONDS)),
};
