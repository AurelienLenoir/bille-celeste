import * as THREE from 'three';
import type { SurfaceMaterials } from '../art/materials';
import type { TrackMesh } from '../engine/trackCollider';
import { CELL } from '../levels/grid';
import { SURFACE_NAMES } from '../levels/schema';

/** A face whose normal is steeper than this counts as a side (plain colour, no tiles). */
const TOP_NORMAL_Y = 0.7;

type Bucket = { positions: number[]; normals: number[]; uvs: number[] };

/**
 * Turns the merged course mesh into one mesh per (surface, top or side): a handful of draw calls
 * for the whole static course. Faces are flat-shaded; tops get world-space UVs, one tile per cell.
 */
export const createTrackMeshes = (
  { vertices, indices, tags }: TrackMesh,
  materials: SurfaceMaterials,
): THREE.Mesh[] => {
  const buckets = new Map<string, Bucket>();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();
  const corner = (i: number, v: THREE.Vector3) =>
    v.set(vertices[i * 3] ?? 0, vertices[i * 3 + 1] ?? 0, vertices[i * 3 + 2] ?? 0);

  for (let t = 0; t < indices.length / 3; t++) {
    corner(indices[t * 3] ?? 0, a);
    corner(indices[t * 3 + 1] ?? 0, b);
    corner(indices[t * 3 + 2] ?? 0, c);
    n.subVectors(b, a).cross(c.clone().sub(a)).normalize();
    const top = n.y > TOP_NORMAL_Y;
    const key = `${tags[t] ?? 0}:${top ? 'top' : 'side'}`;
    const bucket = buckets.get(key) ?? { positions: [], normals: [], uvs: [] };
    buckets.set(key, bucket);
    for (const v of [a, b, c]) {
      bucket.positions.push(v.x, v.y, v.z);
      bucket.normals.push(n.x, n.y, n.z);
      bucket.uvs.push(v.x / CELL, -v.z / CELL);
    }
  }

  return [...buckets].map(([key, { positions, normals, uvs }]) => {
    const [tag, part] = key.split(':');
    const surface = SURFACE_NAMES[Number(tag)] ?? 'cream';
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.computeBoundingSphere();
    const pair = materials(surface);
    const mesh = new THREE.Mesh(geometry, part === 'top' ? pair.top : pair.side);
    mesh.castShadow = mesh.receiveShadow = true;
    return mesh;
  });
};
