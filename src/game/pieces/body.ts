import * as THREE from 'three';
import { buildTrackMesh, type TrackShape } from '../../engine/trackCollider';
import { createTrackMeshes } from '../trackView';
import type { BuildContext } from './kit';

/** Visual of a moving piece, built in local coordinates from the same shape code as the course. */
export const createBodyView = ({ scene, materials }: BuildContext, local: TrackShape): THREE.Group => {
  const group = new THREE.Group();
  createTrackMeshes(buildTrackMesh(local), materials).forEach((mesh) => group.add(mesh));
  scene.add(group);
  return group;
};

/** Collision groups: the course is group 2, see-saw planks only touch the ball (group 1). */
const groups = (membership: number, filter: number) => (membership << 16) | filter;
export const COURSE_GROUPS = groups(0b0010, 0xffff);
export const PLANK_GROUPS = groups(0b0100, 0b0001);
