import * as THREE from 'three';
import { cellToWorld, CELL } from '../../levels/grid';
import type { ModifierOf } from '../../levels/schema';
import { cellsOf, createDecal, direction, groundAt, mergeGeometries, zoneTrigger, type ModifierModule } from './kit';

type Conveyor = ModifierOf<'conveyor'>;

/** How hard the belt drags the ball towards its own speed (1/s), and the cap on that pull. */
const DRAG = 5;
const MAX_PULL = 7;
const CHEVRONS_PER_CELL = 2;

/** Acceleration along the belt for a ball moving at `along` units/s in the belt's direction. */
export const beltPull = (speed: number, along: number): number =>
  Math.max(-MAX_PULL, Math.min(MAX_PULL, DRAG * (speed - along)));

const chevron = () =>
  mergeGeometries(
    [-1, 1].map((side) => {
      const bar = new THREE.BoxGeometry(0.55, 0.03, 0.12);
      bar.rotateY((-side * Math.PI) / 4);
      return bar.translate(side * 0.18, 0, -0.18);
    }),
  );

/** Conveyor belt (malus): drags the ball along at its own speed while it touches the belt. */
export const conveyor: ModifierModule<Conveyor> = {
  kind: 'malus',
  sound: [
    { frequency: 110, duration: 0.07, wave: 'square', volume: 0.06 },
    { frequency: 110, duration: 0.07, wave: 'square', volume: 0.06, at: 0.12 },
    { frequency: 800, duration: 0.2, wave: 'noise', volume: 0.05 },
  ],
  haptic: 'light',
  trigger: zoneTrigger,
  create: (ctx, m) => {
    createDecal(ctx, m, { base: 0x4a5068, accent: 0x5d6480 }, (x, z) => (Math.floor((x + z) * 2) % 2 ? 1 : 0), 1);
    const dir = direction(m.rot);
    const cells = cellsOf(m);
    const count = cells.length * CHEVRONS_PER_CELL;
    const marks = new THREE.InstancedMesh(
      chevron(),
      new THREE.MeshStandardMaterial({ color: 0xffd04f, emissive: 0x8a6a00, emissiveIntensity: 0.4 }),
      count,
    );
    marks.frustumCulled = false;
    ctx.scene.add(marks);
    const y0 = m.cell[1] * 0.5;
    const anchors = cells.flatMap(([i, k]) => {
      const [x, , z] = cellToWorld([i, m.cell[1], k]);
      return Array.from({ length: CHEVRONS_PER_CELL }, (_, n) => ({ x, z, n }));
    });
    const matrix = new THREE.Matrix4();
    const turn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (-m.rot * Math.PI) / 180);
    const scale = new THREE.Vector3(1, 1, 1);
    const at = new THREE.Vector3();
    let offset = 0;
    return {
      trigger: zoneTrigger(m),
      onEnter: (run) => run.fire(),
      inside: (run) => {
        if (!run.ball.grounded()) return;
        const v = run.ball.velocity();
        const a = beltPull(m.speed, v.x * dir.x + v.z * dir.z);
        run.effects.push.x += dir.x * a;
        run.effects.push.z += dir.z * a;
      },
      step: (dt) => (offset = (offset + m.speed * dt) % (CELL / CHEVRONS_PER_CELL)),
      reset: () => (offset = 0),
      syncMesh: () => {
        anchors.forEach(({ x, z, n }, i) => {
          const d = -CELL / 2 + (n * CELL) / CHEVRONS_PER_CELL + offset;
          const px = x + dir.x * d;
          const pz = z + dir.z * d;
          at.set(px, (groundAt(ctx.ground, px, pz, y0) ?? y0) + 0.06, pz);
          marks.setMatrixAt(i, matrix.compose(at, turn, scale));
        });
        marks.instanceMatrix.needsUpdate = true;
      },
    };
  },
};
