import * as THREE from 'three';
import { createBallTexture } from '../art/textures';
import { distanceDown, RAPIER, SURFACE, rapierDamping, type PhysicsWorld } from '../engine/physics';

export const BALL_RADIUS = 0.42;
export const MAX_BALL_SPEED = 13;
const BALL_MASS = 1;
/** A throw is not slowed down by the speed limit for this many physics steps (1 s). */
const LAUNCH_STEPS = 120;
/** Prototype (cannon-es) damping values, converted so the ball keeps the same feel. */
const LINEAR_DAMPING = rapierDamping(0.12);
const ANGULAR_DAMPING = rapierDamping(0.25);

type Point = { x: number; y: number; z: number };

/** What the ball rolls on: normal course, or a modifier zone (ice, sand). */
export type Grip = { friction: number; damping: number };
export const NORMAL_GRIP: Grip = { friction: SURFACE.friction, damping: 0 };

export type Ball = {
  mesh: THREE.Mesh;
  collider: RAPIER.Collider;
  mass: () => number;
  /** Ball centre after the last physics step. */
  position: () => Point;
  velocity: () => Point;
  placeAt: (x: number, y: number, z: number) => void;
  /** Changes the velocity at once (bumpers, zone forces). */
  setVelocity: (v: Point) => void;
  /** Throws the ball (pads, springs): the speed limit is lifted for a moment so the throw is not cut. */
  launch: (v: Point) => void;
  /** Friction against the course and extra linear damping (1/s). Only touches Rapier when it changes. */
  setGrip: (grip: Grip) => void;
  /** Is there a surface right under the ball? */
  grounded: () => boolean;
  limitSpeed: () => void;
  /** Records the state after a physics step; rendering blends the last two records. */
  capture: () => void;
  syncMesh: (alpha: number) => void;
};

/** The ball's look: textured in the game, plain where there is no DOM (bot, tests). */
export const createBallMaterial = (textured = true): THREE.Material =>
  new THREE.MeshPhysicalMaterial({
    ...(textured ? { map: createBallTexture() } : { color: 0xff5d86 }),
    roughness: 0.18,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
  });

export const createBall = (world: PhysicsWorld, scene: THREE.Object3D, material = createBallMaterial()): Ball => {
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setLinearDamping(LINEAR_DAMPING)
      .setAngularDamping(ANGULAR_DAMPING)
      .setCcdEnabled(true)
      .setCanSleep(false),
  );
  const collider = world.createCollider(
    RAPIER.ColliderDesc.ball(BALL_RADIUS)
      .setFriction(SURFACE.friction)
      .setRestitution(SURFACE.restitution)
      .setMass(BALL_MASS),
    body,
  );

  const mesh = new THREE.Mesh(new THREE.SphereGeometry(BALL_RADIUS, 40, 24), material);
  mesh.castShadow = true;
  scene.add(mesh);

  const previous = { p: new THREE.Vector3(), q: new THREE.Quaternion() };
  const current = { p: new THREE.Vector3(), q: new THREE.Quaternion() };
  const readBody = () => {
    const t = body.translation();
    const r = body.rotation();
    current.p.set(t.x, t.y, t.z);
    current.q.set(r.x, r.y, r.z, r.w);
  };

  let grip = NORMAL_GRIP;
  /** Physics steps left during which the speed limit does not apply. */
  let unlimited = 0;

  return {
    mesh,
    collider,
    mass: () => body.mass(),
    position: () => current.p,
    velocity: () => body.linvel(),
    setVelocity: (v) => body.setLinvel(v, true),
    launch: (v) => {
      body.setLinvel(v, true);
      unlimited = LAUNCH_STEPS;
    },
    setGrip: (next) => {
      if (next.friction === grip.friction && next.damping === grip.damping) return;
      grip = next;
      collider.setFriction(next.friction);
      // Min lets an icy ball slide whatever the course's own friction is; Average is Rapier's default.
      collider.setFrictionCombineRule(
        next.friction < SURFACE.friction ? RAPIER.CoefficientCombineRule.Min : RAPIER.CoefficientCombineRule.Average,
      );
      body.setLinearDamping(LINEAR_DAMPING + next.damping);
      body.setAngularDamping(ANGULAR_DAMPING + next.damping);
    },
    grounded: () => (distanceDown(world, body.translation(), BALL_RADIUS + 0.12, body) ?? Infinity) < Infinity,
    placeAt: (x, y, z) => {
      body.setTranslation({ x, y, z }, true);
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      unlimited = 0;
      readBody();
      previous.p.copy(current.p);
      previous.q.copy(current.q);
    },
    limitSpeed: () => {
      if (unlimited > 0) {
        unlimited--;
        return;
      }
      const v = body.linvel();
      const speed = Math.hypot(v.x, v.y, v.z);
      if (speed <= MAX_BALL_SPEED) return;
      const k = MAX_BALL_SPEED / speed;
      body.setLinvel({ x: v.x * k, y: v.y * k, z: v.z * k }, true);
    },
    capture: () => {
      previous.p.copy(current.p);
      previous.q.copy(current.q);
      readBody();
    },
    syncMesh: (alpha) => {
      mesh.position.lerpVectors(previous.p, current.p, alpha);
      mesh.quaternion.slerpQuaternions(previous.q, current.q, alpha);
    },
  };
};
