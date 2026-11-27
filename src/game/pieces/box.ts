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

const TOP_FACE_GROUP = 2;

/**
 * A box whose faces form two draw groups, sides (material 0) and top (material 1), instead of
 * BoxGeometry's six. That divides the course's draw calls by three.
 */
export const topAndSidesBox = (w: number, h: number, d: number): THREE.BoxGeometry => {
  const geometry = new THREE.BoxGeometry(w, h, d);
  const index = geometry.getIndex();
  if (!index) return geometry;
  const sides: number[] = [];
  const top: number[] = [];
  geometry.groups.forEach((group, g) => {
    const target = g === TOP_FACE_GROUP ? top : sides;
    for (let i = group.start; i < group.start + group.count; i++) target.push(index.getX(i));
  });
  geometry.setIndex([...sides, ...top]);
  geometry.clearGroups();
  geometry.addGroup(0, sides.length, 0);
  geometry.addGroup(sides.length, top.length, 1);
  return geometry;
};

/** Adds the visual mesh of a box. Collision is handled separately (see `world.ts`). */
export const buildBoxMesh = ({ scene, materials }: BuildContext, spec: BoxSpec): THREE.Mesh => {
  const [w, h, d] = spec.size;
  const mesh = new THREE.Mesh(topAndSidesBox(w, h, d), materials(spec.surface, w, d));
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.position.set(...spec.position);
  if (spec.rotationX) mesh.rotation.x = spec.rotationX;
  scene.add(mesh);
  return mesh;
};
