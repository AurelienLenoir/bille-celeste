import * as THREE from 'three';
import type { ActiveEffect, TimedEffect } from './effects';
import { BALL_RADIUS } from './ball';

/** Colour of the halo around the ball for each effect, by priority (the first active one shows). */
const HALOS: [TimedEffect, number][] = [
  ['shield', 0x6fe3ff],
  ['heavy', 0x3b2a5c],
  ['magnet', 0xff4d5e],
  ['feather', 0xffffff],
  ['slowMo', 0x7fb8ff],
];

export type EffectAura = { update: (at: THREE.Vector3, effects: readonly ActiveEffect[], clock: number) => void };

/** A translucent bubble around the ball while an effect runs, so the player sees it without the HUD. */
export const createEffectAura = (scene: THREE.Scene): EffectAura => {
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 0.25,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
    roughness: 0.1,
  });
  const bubble = new THREE.Mesh(new THREE.SphereGeometry(BALL_RADIUS * 1.45, 24, 16), material);
  bubble.visible = false;
  scene.add(bubble);
  return {
    update: (at, effects, clock) => {
      const active = new Set(effects.map((e) => e.type));
      const halo = HALOS.find(([type]) => active.has(type));
      bubble.visible = !!halo;
      if (!halo) return;
      const ending = effects.find((e) => e.type === halo[0])?.left ?? Infinity;
      material.color.set(halo[1]);
      material.emissive.set(halo[1]);
      // Blinks during its last two seconds.
      material.opacity = ending < 2 && Math.sin(clock * 18) < 0 ? 0.08 : halo[0] === 'shield' ? 0.35 : 0.22;
      bubble.position.copy(at);
      bubble.scale.setScalar(1 + Math.sin(clock * 5) * 0.04);
    },
  };
};
