import { RAPIER, SURFACE } from '../../engine/physics';
import { emptyShape } from '../../engine/trackCollider';
import { CELL, cellToWorld } from '../../levels/grid';
import type { PieceOf } from '../../levels/schema';
import { createBodyView } from './body';
import { emptyNav, perimeterPorts, surfaceTag, type BallProbe, type PieceBuild, type PieceModule } from './kit';

type FallingTile = PieceOf<'fallingTile'>;

const HALF = CELL / 2 - 0.02;
const THICKNESS = 0.5;
const FALL_GRAVITY = 18;
/** Once it has fallen this far the tile is gone until the level resets. */
const FALL_DEPTH = 12;
const SHAKE = 0.04;

export type TileState = 'idle' | 'armed' | 'falling' | 'gone';

/** The ball stands on the tile when it is above it and close to its top. */
export const isOnTile = ({ position: p, radius }: BallProbe, [x, y, z]: readonly [number, number, number]): boolean =>
  Math.abs(p.x - x) < HALF && Math.abs(p.z - z) < HALF && Math.abs(p.y - radius - y) < 0.25;

/** Tile timer: armed by the ball, it falls after `delay`, then disappears. */
export const createTileClock = (delay: number) => {
  let state: TileState = 'idle';
  let timer = 0;
  let drop = 0;
  let speed = 0;
  return {
    state: () => state,
    drop: () => drop,
    timer: () => timer,
    step: (dt: number, touched: boolean) => {
      if (state === 'idle' && touched) state = 'armed';
      if (state === 'armed') {
        timer += dt;
        if (timer >= delay) state = 'falling';
      } else if (state === 'falling') {
        speed += FALL_GRAVITY * dt;
        drop += speed * dt;
        if (drop > FALL_DEPTH) state = 'gone';
      }
    },
    reset: () => {
      state = 'idle';
      timer = drop = speed = 0;
    },
  };
};

/** A one-cell tile that gives way shortly after the ball rolls onto it. */
const build = (piece: FallingTile): PieceBuild => {
  const [x, y, z] = cellToWorld(piece.cell);
  const body = emptyShape();
  body.floors.push({
    minX: x - HALF,
    maxX: x + HALF,
    minZ: z - HALF,
    maxZ: z + HALF,
    y,
    tag: surfaceTag(piece.surface),
  });
  const nav = emptyNav();
  nav.nodes.push([x, y, z]);
  nav.ports.push(...perimeterPorts(0, [x - CELL / 2, x + CELL / 2, z - CELL / 2, z + CELL / 2], y));
  return { shape: emptyShape(), body, nav, footprint: [{ i: piece.cell[0], k: piece.cell[2], yMin: y, yMax: y }] };
};

export const fallingTile: PieceModule<FallingTile> = {
  build,
  createMover: (ctx, piece) => {
    const home = cellToWorld(piece.cell);
    const [x, y, z] = home;
    const local = emptyShape();
    local.floors.push({ minX: -HALF, maxX: HALF, minZ: -HALF, maxZ: HALF, y: 0, tag: surfaceTag(piece.surface) });
    const view = createBodyView(ctx, local);
    const body = ctx.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y, z));
    const collider = ctx.world.createCollider(
      RAPIER.ColliderDesc.cuboid(HALF, THICKNESS / 2, HALF)
        .setTranslation(0, -THICKNESS / 2, 0)
        .setFriction(SURFACE.friction)
        .setRestitution(SURFACE.restitution),
      body,
    );
    const clock = createTileClock(piece.delay);
    let previousDrop = 0;
    const reset = () => {
      clock.reset();
      previousDrop = 0;
      collider.setEnabled(true);
      body.setTranslation({ x, y, z }, true);
    };
    return {
      onRespawn: reset,
      step: (dt, ball) => {
        previousDrop = clock.drop();
        clock.step(dt, isOnTile(ball, home));
        if (clock.state() === 'gone') collider.setEnabled(false);
        body.setNextKinematicTranslation({ x, y: y - clock.drop(), z });
      },
      reset,
      syncMesh: (alpha) => {
        const drop = previousDrop + (clock.drop() - previousDrop) * alpha;
        const shake = clock.state() === 'armed' ? Math.sin(clock.timer() * 60) * SHAKE : 0;
        view.position.set(x + shake, y - drop, z);
        view.visible = clock.state() !== 'gone';
      },
    };
  },
};
