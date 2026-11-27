import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import type { Surface } from '../../art/palette';
import type { SurfaceMaterials } from '../../art/materials';
import type { Vec3Tuple } from '../../engine/math';

/** A box-shaped course element: centre, full size, optional pitch around x. */
export type BoxSpec = {
  position: Vec3Tuple;
  size: Vec3Tuple;
  surface: Surface;
  rotationX?: number;
  kinematic?: boolean;
};

export type BuildContext = {
  world: CANNON.World;
  scene: THREE.Scene;
  materials: SurfaceMaterials;
};

export type BuiltBox = { body: CANNON.Body; mesh: THREE.Mesh };

export const buildBox = ({ world, scene, materials }: BuildContext, spec: BoxSpec): BuiltBox => {
  const [w, h, d] = spec.size;
  const [x, y, z] = spec.position;
  const body = new CANNON.Body({
    mass: 0,
    type: spec.kinematic ? CANNON.Body.KINEMATIC : CANNON.Body.STATIC,
    shape: new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2)),
    position: new CANNON.Vec3(x, y, z),
  });
  if (spec.rotationX) body.quaternion.setFromEuler(spec.rotationX, 0, 0);
  world.addBody(body);

  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), materials(spec.surface, w, d));
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.position.set(body.position.x, body.position.y, body.position.z);
  mesh.quaternion.set(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w);
  scene.add(mesh);
  return { body, mesh };
};
