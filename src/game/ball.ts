import * as THREE from 'three';
import { createBallTexture } from '../art/textures';
import { RAPIER, SURFACE, rapierDamping, type PhysicsWorld } from '../engine/physics';

export const BALL_RADIUS = 0.42;
export const MAX_BALL_SPEED = 13;
const BALL_MASS = 1;
/** Prototype (cannon-es) damping values, converted so the ball keeps the same feel. */
const LINEAR_DAMPING = rapierDamping(0.12);
const ANGULAR_DAMPING = rapierDamping(0.25);

type Point = { x: number; y: number; z: number };

export type Ball = {
  mesh: THREE.Mesh;
  /** Ball centre after the last physics step. */
  position: () => Point;
  velocity: () => Point;
  placeAt: (x: number, y: number, z: number) => void;
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

export const createBall = (world: PhysicsWorld, scene: THREE.Scene, material = createBallMaterial()): Ball => {
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setLinearDamping(LINEAR_DAMPING)
      .setAngularDamping(ANGULAR_DAMPING)
      .setCcdEnabled(true)
      .setCanSleep(false),
  );
  world.createCollider(
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

  return {
    mesh,
    position: () => current.p,
    velocity: () => body.linvel(),
    placeAt: (x, y, z) => {
      body.setTranslation({ x, y, z }, true);
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      readBody();
      previous.p.copy(current.p);
      previous.q.copy(current.q);
    },
    limitSpeed: () => {
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
