import * as THREE from 'three';
import type { Surface } from '../levels/schema';
import { SURFACES } from './palette';
import { createTileTexture } from './textures';

export type SurfacePair = { top: THREE.Material; side: THREE.Material };
/** Materials of a course surface: a tiled top and plain sides. */
export type SurfaceMaterials = (surface: Surface) => SurfacePair;

const cached = (make: (surface: Surface) => SurfacePair): SurfaceMaterials => {
  const pairs = new Map<Surface, SurfacePair>();
  return (surface) => {
    const known = pairs.get(surface);
    if (known) return known;
    const pair = make(surface);
    pairs.set(surface, pair);
    return pair;
  };
};

const side = (surface: Surface) => new THREE.MeshStandardMaterial({ color: SURFACES[surface].side, roughness: 0.8 });

/**
 * One material pair per surface, shared by the whole course. Tops use world-space UVs (one tile
 * per 2 units), so merged meshes keep the same checkerboard everywhere.
 */
export const createSurfaceMaterials = (): SurfaceMaterials =>
  cached((surface) => {
    const [base, check] = SURFACES[surface].top;
    return {
      top: new THREE.MeshStandardMaterial({ map: createTileTexture(base, check), roughness: 0.7 }),
      side: side(surface),
    };
  });

/** Untextured materials, for previews and for running levels without a DOM (bot, tests). */
export const createPlainMaterials = (): SurfaceMaterials =>
  cached((surface) => ({
    top: new THREE.MeshStandardMaterial({ color: SURFACES[surface].top[0], roughness: 0.7 }),
    side: side(surface),
  }));
