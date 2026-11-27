import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { createPlainMaterials } from '../../../src/art/materials';
import { createPhysicsWorld, initPhysics, RAPIER } from '../../../src/engine/physics';
import { pivotRise, seesaw, SEESAW_TILT } from '../../../src/game/pieces/seesaw';
import { piece } from '../helpers';

describe('seesaw', () => {
  const p = piece({ type: 'seesaw', cell: [0, 0, 0], length: 3 });

  it('meets the course at the entry height at both ends', () => {
    const { nav } = seesaw.build(p);
    expect(nav.ports.map((port) => port.y)).toEqual([0, 0]);
    expect(nav.nodes[1]?.[1]).toBeCloseTo(pivotRise(p));
    expect(pivotRise(p)).toBeCloseTo(3 * Math.sin(SEESAW_TILT));
  });

  describe('physics', () => {
    beforeAll(() => initPhysics());

    it('rests entry end down, and tips when the ball passes the pivot', () => {
      const world = createPhysicsWorld();
      const mover = seesaw.createMover?.({ world, scene: new THREE.Scene(), materials: createPlainMaterials() }, p);
      if (!mover) throw new Error('seesaw must move');
      const plank = world.bodies.getAll().find((b) => b.isDynamic());
      const tilt = () => {
        const q = plank?.rotation() ?? { x: 0, w: 1 };
        return 2 * Math.atan2(q.x, q.w);
      };
      for (let i = 0; i < 120; i++) world.step();
      expect(tilt()).toBeCloseTo(SEESAW_TILT, 1);

      const ball = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 2, -4.5));
      world.createCollider(RAPIER.ColliderDesc.ball(0.42).setMass(1), ball);
      for (let i = 0; i < 90; i++) world.step();
      expect(tilt()).toBeCloseTo(-SEESAW_TILT, 1);
      mover.reset();
      expect(tilt()).toBeCloseTo(SEESAW_TILT, 3);
    });
  });
});
