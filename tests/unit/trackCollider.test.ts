import RAPIER from '@dimforge/rapier3d-compat';
import { beforeAll, describe, expect, it } from 'vitest';
import { addTrackCollider, createPhysicsWorld, initPhysics } from '../../src/engine/physics';
import { buildTrackMesh, type FloorPatch } from '../../src/engine/trackCollider';
import { rampCollision } from '../../src/game/pieces/ramp';
import { slabCollision } from '../../src/game/pieces/slab';

const flat = (minX: number, maxX: number, minZ: number, maxZ: number, y = 0): FloorPatch => ({
  minX,
  maxX,
  minZ,
  maxZ,
  heightAtMinZ: y,
  heightAtMaxZ: y,
});

/** Every edge of a closed, consistently wound mesh is used once in each direction. */
const isClosedAndOriented = (indices: Uint32Array) => {
  const directed = new Map<string, number>();
  for (let t = 0; t < indices.length; t += 3) {
    for (let k = 0; k < 3; k++) {
      const key = `${indices[t + k]},${indices[t + ((k + 1) % 3)]}`;
      directed.set(key, (directed.get(key) ?? 0) + 1);
    }
  }
  return [...directed].every(([key, n]) => {
    const [a, b] = key.split(',');
    return n === 1 && directed.get(`${b},${a}`) === 1;
  });
};

describe('buildTrackMesh', () => {
  it('welds two overlapping slabs into one closed box without T-junctions', () => {
    const { vertices, indices } = buildTrackMesh([flat(-3, 3, -3, 3), flat(-1, 1, -13.1, -2.9)], []);
    expect(isClosedAndOriented(indices)).toBe(true);
    // No vertex lies inside another face: the 0.1 overlap is cut on the shared grid.
    expect(vertices.length / 3).toBeLessThan(60);
  });

  it('glues a ramp to the slabs at both ends', () => {
    const top = slabCollision({ type: 'slab', at: [14, 0, -32], size: [6, 6], surface: 'mint' });
    const slope = rampCollision({ type: 'ramp', at: [14, 0, -35], length: 10, drop: 3, width: 3, surface: 'cream' });
    const bottom = slabCollision({ type: 'slab', at: [14, -3, -48], size: [6, 6], surface: 'rose' });
    const { indices } = buildTrackMesh([...top.floors, ...slope.floors, ...bottom.floors], []);
    expect(isClosedAndOriented(indices)).toBe(true);
  });

  it('adds walls and rails as separate closed boxes', () => {
    const slope = rampCollision({ type: 'ramp', at: [0, 0, 0], length: 10, drop: 3, width: 3, surface: 'cream' });
    const { indices } = buildTrackMesh(slope.floors, slope.solids);
    expect(isClosedAndOriented(indices)).toBe(true);
  });
});

describe('merged track collider (Rapier)', () => {
  beforeAll(() => initPhysics());

  /** Rolls a ball down 30 joined slabs and returns how far it ever rose above resting height. */
  const worstHop = (merged: boolean) => {
    const world = createPhysicsWorld();
    const floors = Array.from({ length: 30 }, (_, i) => {
      const x = (i % 2) * 0.4;
      const z = -i * 1.9;
      return flat(x - 2, x + 2, z - 1, z + 1);
    });
    if (merged) addTrackCollider(world, buildTrackMesh(floors, []));
    else
      floors.forEach((f) =>
        world.createCollider(
          RAPIER.ColliderDesc.cuboid(2, 0.25, 1).setTranslation((f.minX + f.maxX) / 2, -0.25, (f.minZ + f.maxZ) / 2),
        ),
      );
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0.3, 0.42, 0.5));
    world.createCollider(RAPIER.ColliderDesc.ball(0.42).setFriction(0.5).setRestitution(0.05), body);
    world.gravity = { x: 0.2, y: -20, z: -9.6 };
    let hop = 0;
    for (let i = 0; i < 1200 && body.translation().z > -54; i++) {
      world.step();
      if (i > 60) hop = Math.max(hop, body.translation().y - 0.42);
    }
    expect(body.translation().z).toBeLessThan(-54);
    return hop;
  };

  it('separate boxes make the ball hop at joints (baseline)', () => {
    expect(worstHop(false)).toBeGreaterThan(0.05);
  });

  it('the merged trimesh keeps the ball on the surface across 30 joints', () => {
    expect(worstHop(true)).toBeLessThan(0.01);
  });
});
