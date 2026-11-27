import * as THREE from 'three';
import { RAPIER, SURFACE } from '../../engine/physics';
import { cellToWorld, CELL } from '../../levels/grid';
import type { ModifierOf } from '../../levels/schema';
import { BALL_RADIUS } from '../ball';
import { mergeGeometries, type ModifierModule } from './kit';

type Sweeper = ModifierOf<'sweeper'>;

const HUB = 0.35;
const ARM = { half: 0.16, low: 0.12, high: 0.55 } as const;

/** Arm angle (radians around +y) after `time` seconds; positive speeds turn clockwise seen from above. */
export const armAngle = (speedDeg: number, time: number): number => (-speedDeg * Math.PI * time) / 180;

export const armLength = (m: Pick<Sweeper, 'length'>): number => m.length * CELL;

/** Is (x, z) within `margin` of the arm when it points at `angle`? */
export const armHits = (m: Sweeper, angle: number, x: number, z: number, margin: number): boolean => {
  const [cx, , cz] = cellToWorld(m.cell);
  const [dx, dz] = [x - cx, z - cz];
  // Arm direction: local +x turned by `angle` around +y.
  const [ux, uz] = [Math.cos(angle), -Math.sin(angle)];
  const along = dx * ux + dz * uz;
  const across = Math.abs(-dx * uz + dz * ux);
  return along > -HUB - margin && along < armLength(m) + margin && across < ARM.half + margin;
};

/** Sweeping bar (malus): an arm turns around a hub and sweeps the ball off its platform. */
export const sweeper: ModifierModule<Sweeper> = {
  kind: 'malus',
  sound: [
    { frequency: 700, to: 200, duration: 0.22, wave: 'noise', volume: 0.16 },
    { frequency: 240, to: 160, duration: 0.15, wave: 'triangle', volume: 0.08 },
  ],
  haptic: 'heavy',
  solidCells: (m) => [[m.cell[0], m.cell[2]]],
  hazardCells: (m) => {
    const cells: [number, number][] = [];
    const reach = Math.ceil(m.length);
    for (let di = -reach; di <= reach; di++)
      for (let dk = -reach; dk <= reach; dk++)
        if ((di || dk) && Math.hypot(di, dk) * CELL <= armLength(m) + CELL / 2)
          cells.push([m.cell[0] + di, m.cell[2] + dk]);
    return cells;
  },
  create: (ctx, m) => {
    const [x, y, z] = cellToWorld(m.cell);
    const length = armLength(m);
    const geometry = mergeGeometries([
      new THREE.CylinderGeometry(HUB, HUB, 0.9, 16).translate(0, 0.45, 0),
      new THREE.BoxGeometry(length, ARM.high - ARM.low, ARM.half * 2).translate(
        length / 2,
        (ARM.low + ARM.high) / 2,
        0,
      ),
      new THREE.SphereGeometry(0.2, 10, 8).translate(length, (ARM.low + ARM.high) / 2, 0),
    ]);
    const view = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0xe24f6a, roughness: 0.4 }));
    view.position.set(x, y, z);
    view.castShadow = true;
    ctx.scene.add(view);
    const body = ctx.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y, z));
    const friction = SURFACE.friction;
    ctx.world.createCollider(
      RAPIER.ColliderDesc.cylinder(0.45, HUB).setTranslation(0, 0.45, 0).setFriction(friction),
      body,
    );
    ctx.world.createCollider(
      RAPIER.ColliderDesc.cuboid(length / 2, (ARM.high - ARM.low) / 2, ARM.half)
        .setTranslation(length / 2, (ARM.low + ARM.high) / 2, 0)
        .setFriction(friction),
      body,
    );
    let time = 0;
    let previous = 0;
    let cooldown = 0;
    const rotation = (angle: number) => ({ x: 0, y: Math.sin(angle / 2), z: 0, w: Math.cos(angle / 2) });
    return {
      hazard: {
        covers: (px, pz) => Math.hypot(px - x, pz - z) < length + BALL_RADIUS,
        hitsAt: (px, pz, seconds, margin) => armHits(m, armAngle(m.speed, time + seconds), px, pz, margin),
      },
      step: (dt, run) => {
        previous = time;
        time += dt;
        cooldown = Math.max(0, cooldown - dt);
        body.setNextKinematicRotation(rotation(armAngle(m.speed, time)));
        const p = run.ball.position();
        if (
          !cooldown &&
          Math.abs(p.y - y - BALL_RADIUS) < 0.6 &&
          armHits(m, armAngle(m.speed, time), p.x, p.z, BALL_RADIUS + 0.05)
        ) {
          cooldown = 0.6;
          run.fire();
        }
      },
      reset: () => {
        time = previous = cooldown = 0;
        body.setRotation(rotation(0), true);
      },
      syncMesh: (alpha) => (view.rotation.y = armAngle(m.speed, previous + (time - previous) * alpha)),
    };
  },
};
