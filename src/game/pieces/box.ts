import * as THREE from 'three';
import type { Surface } from '../../art/palette';
import type { SurfaceMaterials } from '../../art/materials';
import type { Vec3Tuple } from '../../engine/math';
import type { PhysicsWorld } from '../../engine/physics';

/** A box-shaped course element as drawn: centre, full size, optional pitch around x. */
export type BoxSpec = {
  position: Vec3Tuple;
  size: Vec3Tuple;
  surface: Surface;
  rotationX?: number;
};

export type BuildContext = {
  world: PhysicsWorld;
  scene: THREE.Scene;
  materials: SurfaceMaterials;
};

/** Adds the visual mesh of a box. Collision is handled separately (see `world.ts`). */
export const buildBoxMesh = ({ scene, materials }: BuildContext, spec: BoxSpec): THREE.Mesh => {
  const [w, h, d] = spec.size;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), materials(spec.surface, w, d));
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.position.set(...spec.position);
  if (spec.rotationX) mesh.rotation.x = spec.rotationX;
  scene.add(mesh);
  return mesh;
};
