import * as THREE from 'three';
import { SURFACES, type Surface } from './palette';
import { createTileTexture } from './textures';

export type SurfaceMaterials = (surface: Surface, width: number, depth: number) => THREE.Material[];

/**
 * Box face materials: a tiled top (+y face) scaled to the box footprint, plain sides elsewhere.
 * Base tile textures are created once and cloned per box so each can have its own repeat.
 */
export const createSurfaceMaterials = (): SurfaceMaterials => {
  const tiles = new Map<Surface, THREE.Texture>();
  const tileFor = (surface: Surface) => {
    let tile = tiles.get(surface);
    if (!tile) {
      const [base, check] = SURFACES[surface].top;
      tile = createTileTexture(base, check);
      tiles.set(surface, tile);
    }
    return tile;
  };

  return (surface, width, depth) => {
    const top = tileFor(surface).clone();
    top.needsUpdate = true;
    top.repeat.set(width / 2, depth / 2);
    const side = new THREE.MeshStandardMaterial({ color: SURFACES[surface].side, roughness: 0.8 });
    const topMaterial = new THREE.MeshStandardMaterial({ map: top, roughness: 0.7 });
    return [side, side, topMaterial, side, side, side];
  };
};
