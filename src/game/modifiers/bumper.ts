import * as THREE from 'three';
import { RAPIER } from '../../engine/physics';
import { cellToWorld } from '../../levels/grid';
import type { ModifierOf } from '../../levels/schema';
import { BALL_RADIUS } from '../ball';
import { mergeGeometries, type ModifierModule } from './kit';

type Bumper = ModifierOf<'bumper'>;

export const POST_RADIUS = 0.45;
const POST_HEIGHT = 0.9;
const COOLDOWN = 0.25;

/** Velocity after hitting the post: thrown straight away from it at `strength`, vertical speed kept. */
export const bounceOff = (
  post: { x: number; z: number },
  ball: { x: number; z: number },
  v: { x: number; y: number; z: number },
  strength: number,
) => {
  const dx = ball.x - post.x;
  const dz = ball.z - post.z;
  const d = Math.hypot(dx, dz) || 1;
  return { x: (dx / d) * strength, y: v.y, z: (dz / d) * strength };
};

/** Is the ball touching the post? */
export const touchesPost = (post: readonly [number, number, number], ball: { x: number; y: number; z: number }) =>
  Math.hypot(ball.x - post[0], ball.z - post[2]) < POST_RADIUS + BALL_RADIUS + 0.06 &&
  ball.y > post[1] - 0.2 &&
  ball.y < post[1] + POST_HEIGHT + BALL_RADIUS;

/** Bumper (malus): a post that throws the ball back hard. */
export const bumper: ModifierModule<Bumper> = {
  kind: 'malus',
  sound: [
    { frequency: 520, to: 260, duration: 0.22, wave: 'triangle', volume: 0.14 },
    { frequency: 1040, duration: 0.1, wave: 'sine', volume: 0.08 },
  ],
  haptic: 'heavy',
  solidCells: (m) => [[m.cell[0], m.cell[2]]],
  create: (ctx, m) => {
    const at = cellToWorld(m.cell);
    const [x, y, z] = at;
    ctx.world.createCollider(
      RAPIER.ColliderDesc.cylinder(POST_HEIGHT / 2, POST_RADIUS)
        .setTranslation(x, y + POST_HEIGHT / 2, z)
        .setRestitution(0.8),
    );
    const material = new THREE.MeshStandardMaterial({ color: 0x4fd8ff, emissive: 0x1a6aff, emissiveIntensity: 0.3 });
    const mesh = new THREE.Mesh(
      mergeGeometries([
        new THREE.CylinderGeometry(POST_RADIUS, POST_RADIUS + 0.05, POST_HEIGHT, 20).translate(0, POST_HEIGHT / 2, 0),
        new THREE.TorusGeometry(POST_RADIUS + 0.04, 0.07, 8, 20)
          .rotateX(Math.PI / 2)
          .translate(0, POST_HEIGHT * 0.6, 0),
        new THREE.SphereGeometry(POST_RADIUS, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, POST_HEIGHT, 0),
      ]),
      material,
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    ctx.scene.add(mesh);
    let cooldown = 0;
    let flash = 0;
    let lastClock = 0;
    return {
      step: (dt, run) => {
        cooldown = Math.max(0, cooldown - dt);
        const p = run.ball.position();
        if (cooldown || !touchesPost(at, p)) return;
        cooldown = COOLDOWN;
        flash = 1;
        run.ball.setVelocity(bounceOff({ x, z }, p, run.ball.velocity(), m.strength));
        run.fire();
      },
      reset: () => (cooldown = flash = 0),
      syncMesh: (_alpha, clock) => {
        flash = Math.max(0, flash - (clock - lastClock) * 5);
        lastClock = clock;
        material.emissiveIntensity = 0.3 + flash * 1.5;
        mesh.scale.setScalar(1 + flash * 0.15);
      },
    };
  },
};
