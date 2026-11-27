import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { createBallTexture } from '../art/textures';

export const BALL_RADIUS = 0.42;
export const MAX_BALL_SPEED = 13;

export type Ball = {
  body: CANNON.Body;
  mesh: THREE.Mesh;
  placeAt: (x: number, y: number, z: number) => void;
  limitSpeed: () => void;
  syncMesh: () => void;
};

export const createBall = (world: CANNON.World, scene: THREE.Scene): Ball => {
  const body = new CANNON.Body({
    mass: 1,
    shape: new CANNON.Sphere(BALL_RADIUS),
    linearDamping: 0.12,
    angularDamping: 0.25,
  });
  world.addBody(body);

  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_RADIUS, 40, 24),
    new THREE.MeshPhysicalMaterial({
      map: createBallTexture(),
      roughness: 0.18,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
    }),
  );
  mesh.castShadow = true;
  scene.add(mesh);

  return {
    body,
    mesh,
    placeAt: (x, y, z) => {
      body.position.set(x, y, z);
      body.velocity.setZero();
      body.angularVelocity.setZero();
    },
    limitSpeed: () => {
      const v = body.velocity;
      const speed = v.length();
      if (speed > MAX_BALL_SPEED) v.scale(MAX_BALL_SPEED / speed, v);
    },
    syncMesh: () => {
      const { position: p, quaternion: q } = body;
      mesh.position.set(p.x, p.y, p.z);
      mesh.quaternion.set(q.x, q.y, q.z, q.w);
    },
  };
};
