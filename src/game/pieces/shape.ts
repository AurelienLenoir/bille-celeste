import type { FloorPatch, SolidBox } from '../../engine/trackCollider';
import type { BoxSpec } from './box';

/** What a static piece adds to the merged track collider. */
export type PieceCollision = { floors: FloorPatch[]; solids: SolidBox[] };

/** A wall or rail collides exactly like the box it is drawn as. */
export const solidFromBox = ({ position, size, rotationX }: BoxSpec): SolidBox =>
  rotationX ? { center: position, size, pitch: rotationX } : { center: position, size };
