import * as THREE from 'three';
import { RAPIER, SURFACE } from '../../engine/physics';
import { cellToWorld, CELL, forwardOf } from '../../levels/grid';
import type { ModifierOf } from '../../levels/schema';
import { BALL_RADIUS } from '../ball';
import type { ModifierModule } from './kit';

type Pusher = ModifierOf<'pusher'>;

/** Timeline of a strike, in seconds, at the end of each period. */
const STRIKE = 0.18;
const HOLD = 0.35;
const RETRACT = 0.6;
const CYCLE = STRIKE + HOLD + RETRACT;
const BLOCK = { half: 0.9, height: 0.9 } as const;

/**
 * How far the block is out (0 = in its housing, 1 = covering the track cell) after `time`
 * seconds. It rests, then strikes fast, holds and pulls back slowly.
 */
export const pusherReach = (m: Pick<Pusher, 'period' | 'phase'>, time: number): number => {
  const period = Math.max(m.period, CYCLE + 0.2);
  const t = ((((time / period + 1 - m.phase) % 1) + 1) % 1) * period;
  const start = period - CYCLE;
  if (t < start) return 0;
  const s = t - start;
  if (s < STRIKE) return (s / STRIKE) ** 2;
  if (s < STRIKE + HOLD) return 1;
  const r = (s - STRIKE - HOLD) / RETRACT;
  return 1 - r * r * (3 - 2 * r);
};

/** Centre of the block (x, z) for a given reach: it slides from the housing cell to the track cell. */
const blockCentre = (m: Pusher, reach: number): [number, number] => {
  const [x, , z] = cellToWorld(m.cell);
  const [fx, fz] = forwardOf(m.rot);
  const back = (1 - reach) * CELL;
  return [x - fx * back, z - fz * back];
};

const within = (m: Pusher, reach: number, x: number, z: number, margin: number) => {
  const [cx, cz] = blockCentre(m, reach);
  const r = BLOCK.half + margin;
  return Math.abs(x - cx) < r && Math.abs(z - cz) < r;
};

/** Pusher (malus): a block comes out of the side of the track in rhythm and shoves the ball off. */
export const pusher: ModifierModule<Pusher> = {
  kind: 'malus',
  sound: [
    { frequency: 150, duration: 0.2, wave: 'noise', volume: 0.18 },
    { frequency: 90, to: 55, duration: 0.18, wave: 'square', volume: 0.08 },
  ],
  haptic: 'heavy',
  hazardCells: (m) => [[m.cell[0], m.cell[2]]],
  create: (ctx, m) => {
    const [, y] = cellToWorld(m.cell);
    const [fx, fz] = forwardOf(m.rot);
    const material = new THREE.MeshStandardMaterial({ color: 0xff7a45, roughness: 0.5 });
    const block = new THREE.Mesh(new THREE.BoxGeometry(BLOCK.half * 2, BLOCK.height, BLOCK.half * 2), material);
    block.castShadow = true;
    ctx.scene.add(block);
    const [hx, hz] = blockCentre(m, 0);
    const housing = new THREE.Mesh(
      new THREE.BoxGeometry(CELL + Math.abs(fz) * 0.2, BLOCK.height + 0.3, CELL + Math.abs(fx) * 0.2),
      new THREE.MeshStandardMaterial({ color: 0x6d7390, roughness: 0.8 }),
    );
    housing.position.set(hx - fx * 0.15, y + BLOCK.height / 2 + 0.05, hz - fz * 0.15);
    housing.scale.set(1, 1, 1);
    ctx.scene.add(housing);
    const body = ctx.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(hx, y, hz));
    ctx.world.createCollider(
      RAPIER.ColliderDesc.cuboid(BLOCK.half, BLOCK.height / 2, BLOCK.half)
        .setTranslation(0, BLOCK.height / 2 + 0.02, 0)
        .setFriction(SURFACE.friction),
      body,
    );
    let time = 0;
    let previous = 0;
    let struck = false;
    const place = (reach: number) => {
      const [cx, cz] = blockCentre(m, reach);
      return { x: cx, y, z: cz };
    };
    return {
      hazard: {
        covers: (x, z) => within(m, 1, x, z, BALL_RADIUS),
        hitsAt: (x, z, seconds, margin) => {
          const reach = pusherReach(m, time + seconds);
          return reach > 0.05 && within(m, reach, x, z, margin);
        },
      },
      step: (dt, run) => {
        previous = time;
        time += dt;
        const reach = pusherReach(m, time);
        body.setNextKinematicTranslation(place(reach));
        const p = run.ball.position();
        const striking = reach > pusherReach(m, previous) && reach > 0.2;
        if (!striking) struck = false;
        else if (!struck && within(m, reach, p.x, p.z, BALL_RADIUS + 0.1) && Math.abs(p.y - y) < 1.5) {
          struck = true;
          run.fire();
        }
      },
      reset: () => {
        time = previous = 0;
        struck = false;
        body.setTranslation(place(pusherReach(m, 0)), true);
      },
      syncMesh: (alpha) => {
        const reach = pusherReach(m, previous + (time - previous) * alpha);
        const [cx, cz] = blockCentre(m, reach);
        block.position.set(cx, y + BLOCK.height / 2 + 0.02, cz);
      },
    };
  },
};
