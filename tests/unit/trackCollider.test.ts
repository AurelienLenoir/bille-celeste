import RAPIER from '@dimforge/rapier3d-compat';
import { beforeAll, describe, expect, it } from 'vitest';
import { addTrackCollider, createPhysicsWorld, initPhysics } from '../../src/engine/physics';
import { buildTrackMesh, type FloorPatch } from '../../src/engine/trackCollider';
import { buildPiece } from '../../src/game/pieces';
import { piece } from './helpers';

const flat = (minX: number, maxX: number, minZ: number, maxZ: number, y = 0): FloorPatch => ({
  minX,
  maxX,
  minZ,
  maxZ,
  y,
});

/** Every edge of a closed, consistently wound mesh is used once in each direction. */
export const isClosedAndOriented = (indices: Uint32Array): boolean => {
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

const shapeOf = (...pieces: Parameters<typeof piece>[0][]) => {
  const shape = { floors: [] as FloorPatch[], triangles: [], solids: [], barriers: [] } as ReturnType<
    typeof buildPiece
  >['shape'];
  pieces.forEach((p) => {
    const built = buildPiece(piece(p)).shape;
    shape.floors.push(...built.floors);
    shape.triangles.push(...built.triangles);
    shape.barriers.push(...built.barriers);
  });
  return shape;
};

describe('buildTrackMesh', () => {
  it('welds two overlapping slabs into one closed box without T-junctions', () => {
    const { vertices, indices } = buildTrackMesh({ floors: [flat(-3, 3, -3, 3), flat(-1, 1, -13.1, -2.9)] });
    expect(isClosedAndOriented(indices)).toBe(true);
    // No vertex lies inside another face: the 0.1 overlap is cut on the shared grid.
    expect(vertices.length / 3).toBeLessThan(60);
  });

  it('glues a ramp to the platforms at both ends', () => {
    const { indices } = buildTrackMesh(
      shapeOf(
        { type: 'platform', cell: [7, 0, -16] },
        { type: 'ramp', cell: [7, 0, -18], length: 5, drop: 6 },
        { type: 'platform', cell: [7, -6, -24] },
      ),
    );
    expect(isClosedAndOriented(indices)).toBe(true);
  });

  it('splits faces so a curve joins straights without T-junctions', () => {
    const { indices } = buildTrackMesh(
      shapeOf(
        { type: 'straight', cell: [0, 0, -1], length: 2 },
        { type: 'curve', cell: [0, 0, -3], radius: 2 },
        { type: 'straight', cell: [2, 0, -4], rot: 90, length: 2 },
      ),
    );
    expect(isClosedAndOriented(indices)).toBe(true);
  });

  it('adds rails as separate closed solids and tags every triangle', () => {
    const { indices, tags } = buildTrackMesh(
      shapeOf({ type: 'ramp', cell: [0, 0, 0], length: 5, drop: 6, rails: 'both' }),
    );
    expect(isClosedAndOriented(indices)).toBe(true);
    expect(tags.length).toBe(indices.length / 3);
    expect(new Set(tags).size).toBe(2);
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
    if (merged) addTrackCollider(world, buildTrackMesh({ floors }));
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
