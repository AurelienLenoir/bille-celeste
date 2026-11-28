import * as THREE from 'three';

type Point = { x: number; y: number; z: number };

export type Burst = {
  at: Point;
  color: number;
  count: number;
  /** Outward speed (units/s), randomised ±50 %. */
  speed: number;
  /** Extra upward speed. */
  up?: number;
  /** Lifetime in seconds, randomised ±30 %. */
  life: number;
  /** Point size in world units. */
  size: number;
  /** Downward acceleration (units/s²); negative floats up. */
  gravity?: number;
  /** Speed lost per second (0..). */
  drag?: number;
};

export type Particles = {
  burst: (b: Burst) => void;
  /** One particle, with a given velocity (trails). */
  emit: (at: Point, velocity: Point, color: number, life: number, size: number) => void;
  update: (dt: number) => void;
  clear: () => void;
};

const VERTEX = /* glsl */ `
  attribute float size;
  attribute float alpha;
  attribute vec3 tint;
  varying float vAlpha;
  varying vec3 vTint;
  uniform float scale;
  void main() {
    vAlpha = alpha;
    vTint = tint;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * scale / max(0.1, -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAGMENT = /* glsl */ `
  varying float vAlpha;
  varying vec3 vTint;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = dot(c, c);
    if (d > 0.25) discard;
    gl_FragColor = vec4(vTint, vAlpha * smoothstep(0.25, 0.08, d));
  }
`;

let shared: THREE.ShaderMaterial | undefined;

/** Round soft points with per-point colour, size and fade, shared by every particle effect. */
export const pointsMaterial = (): THREE.ShaderMaterial =>
  (shared ??= new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: { scale: { value: 600 } },
    transparent: true,
    depthWrite: false,
  }));

/** Keeps point sizes in world units whatever the canvas height (`heightPx` in device pixels). */
export const fitPointScale = (heightPx: number, fovDeg: number): void => {
  const uniform = pointsMaterial().uniforms.scale;
  if (uniform) uniform.value = heightPx / (2 * Math.tan((fovDeg * Math.PI) / 360));
};

/** A pool of `capacity` particles (oldest reused first), drawn as one THREE.Points. */
export const createParticles = (parent: THREE.Object3D, capacity = 512): Particles & { points: THREE.Points } => {
  const position = new Float32Array(capacity * 3);
  const tint = new Float32Array(capacity * 3);
  const size = new Float32Array(capacity);
  const alpha = new Float32Array(capacity);
  const velocity = new Float32Array(capacity * 3);
  const age = new Float32Array(capacity);
  const life = new Float32Array(capacity);
  const gravity = new Float32Array(capacity);
  const drag = new Float32Array(capacity);
  const baseSize = new Float32Array(capacity);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('tint', new THREE.BufferAttribute(tint, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(size, 1));
  geometry.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1));
  const points = new THREE.Points(geometry, pointsMaterial());
  points.frustumCulled = false;
  points.renderOrder = 2;
  parent.add(points);
  let next = 0;
  let alive = 0;
  const color = new THREE.Color();

  const spawn = (at: Point, v: Point, hex: number, seconds: number, s: number, g: number, d: number) => {
    const i = next;
    next = (next + 1) % capacity;
    position.set([at.x, at.y, at.z], i * 3);
    velocity.set([v.x, v.y, v.z], i * 3);
    color.setHex(hex);
    tint.set([color.r, color.g, color.b], i * 3);
    age[i] = 0;
    life[i] = seconds;
    baseSize[i] = s;
    gravity[i] = g;
    drag[i] = d;
    alpha[i] = 1;
    size[i] = s;
    alive = Math.min(capacity, alive + 1);
  };

  return {
    points,
    burst: (b) => {
      for (let k = 0; k < b.count; k++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const speed = b.speed * (0.5 + Math.random());
        spawn(
          b.at,
          {
            x: Math.sin(phi) * Math.cos(theta) * speed,
            y: Math.cos(phi) * speed + (b.up ?? 0),
            z: Math.sin(phi) * Math.sin(theta) * speed,
          },
          b.color,
          b.life * (0.7 + Math.random() * 0.6),
          b.size,
          b.gravity ?? 0,
          b.drag ?? 1.5,
        );
      }
    },
    emit: (at, v, hex, seconds, s) => spawn(at, v, hex, seconds, s, -0.5, 2),
    update: (dt) => {
      if (!alive) return;
      let living = 0;
      for (let i = 0; i < capacity; i++) {
        if ((alpha[i] ?? 0) <= 0) continue;
        const a = (age[i] ?? 0) + dt;
        age[i] = a;
        const left = 1 - a / (life[i] ?? 1);
        if (left <= 0) {
          alpha[i] = 0;
          size[i] = 0;
          continue;
        }
        living++;
        const keep = Math.max(0, 1 - (drag[i] ?? 0) * dt);
        const j = i * 3;
        velocity[j] = (velocity[j] ?? 0) * keep;
        velocity[j + 1] = (velocity[j + 1] ?? 0) * keep - (gravity[i] ?? 0) * dt;
        velocity[j + 2] = (velocity[j + 2] ?? 0) * keep;
        position[j] = (position[j] ?? 0) + (velocity[j] ?? 0) * dt;
        position[j + 1] = (position[j + 1] ?? 0) + (velocity[j + 1] ?? 0) * dt;
        position[j + 2] = (position[j + 2] ?? 0) + (velocity[j + 2] ?? 0) * dt;
        alpha[i] = Math.min(1, left * 2);
        size[i] = (baseSize[i] ?? 0) * (0.4 + 0.6 * left);
      }
      alive = living;
      for (const name of ['position', 'alpha', 'size', 'tint']) {
        const attribute = geometry.getAttribute(name);
        attribute.needsUpdate = true;
      }
    },
    clear: () => {
      alpha.fill(0);
      size.fill(0);
      alive = 0;
      geometry.getAttribute('alpha').needsUpdate = true;
      geometry.getAttribute('size').needsUpdate = true;
    },
  };
};
