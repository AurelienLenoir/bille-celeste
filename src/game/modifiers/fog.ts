import * as THREE from 'three';
import type { ModifierOf } from '../../levels/schema';
import { zoneTrigger, type ModifierModule } from './kit';

/** Fog (malus): the view closes in while the ball is inside; seen from outside, a cloud bank. */
export const fog: ModifierModule<ModifierOf<'fog'>> = {
  kind: 'malus',
  sound: [{ frequency: 500, to: 300, duration: 0.9, wave: 'noise', volume: 0.06 }],
  haptic: 'light',
  trigger: zoneTrigger,
  create: (ctx, m) => {
    const t = zoneTrigger(m);
    if (t.kind !== 'box') throw new Error('fog zone must be a box');
    const [w, h, d] = [t.max[0] - t.min[0], t.max[1] - t.min[1] + 0.6, t.max[2] - t.min[2]];
    const material = new THREE.MeshBasicMaterial({
      color: 0xf2f6ff,
      transparent: true,
      opacity: 0.3 * m.density,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set((t.min[0] + t.max[0]) / 2, t.min[1] + h / 2, (t.min[2] + t.max[2]) / 2);
    mesh.renderOrder = 2;
    ctx.scene.add(mesh);
    return {
      trigger: t,
      onEnter: (run) => run.fire(),
      inside: (run) => (run.effects.fog = Math.max(run.effects.fog, m.density)),
      reset: () => undefined,
      syncMesh: (_alpha, clock) => (material.opacity = (0.26 + Math.sin(clock * 0.8) * 0.05) * m.density),
    };
  },
};
