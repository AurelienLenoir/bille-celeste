import * as THREE from 'three';
import { createRandom } from '../engine/math';
import type { SkinLook } from '../meta/skins';

type Paint = (ctx: CanvasRenderingContext2D, w: number, h: number, c: readonly [string, string, string]) => void;

const disc = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number) => {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
};

const star = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number) => {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const k = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * k, y + Math.sin(a) * k);
  }
  ctx.closePath();
  ctx.fill();
};

/** Each pattern painted on an equirectangular 2:1 canvas wrapped around the ball. */
const PAINT: Record<SkinLook['pattern'], Paint> = {
  stripe: (ctx, w, h, [, accent, detail]) => {
    ctx.fillStyle = accent;
    ctx.fillRect(0, h * 0.42, w, h * 0.16);
    ctx.fillStyle = detail;
    for (let i = 0; i < 8; i++) disc(ctx, 16 + i * 32, 26 + (i % 2) * 76, 9);
  },
  dots: (ctx, w, h, [, accent, detail]) => {
    for (let y = 0; y < 5; y++)
      for (let x = 0; x < 10; x++) {
        ctx.fillStyle = (x + y) % 3 ? accent : detail;
        disc(ctx, (x + (y % 2) * 0.5) * (w / 10), (y + 0.5) * (h / 5), 7);
      }
  },
  checker: (ctx, w, h, [, accent]) => {
    ctx.fillStyle = accent;
    const n = 8;
    for (let y = 0; y < n / 2; y++)
      for (let x = 0; x < n; x++) if ((x + y) % 2) ctx.fillRect((x * w) / n, (y * h) / (n / 2), w / n, h / (n / 2));
  },
  swirl: (ctx, w, h, [, accent, detail]) => {
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 ? accent : detail;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 4) ctx.lineTo(x, (i * h) / 6 + Math.sin((x / w) * Math.PI * 4 + i) * 10);
      for (let x = w; x >= 0; x -= 4) ctx.lineTo(x, ((i + 0.5) * h) / 6 + Math.sin((x / w) * Math.PI * 4 + i) * 10);
      ctx.fill();
    }
  },
  stars: (ctx, w, h, [, accent, detail]) => {
    const rnd = createRandom(5);
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = i % 4 ? accent : detail;
      star(ctx, rnd() * w, h * 0.1 + rnd() * h * 0.8, 2 + rnd() * 6);
    }
  },
  solid: () => undefined,
  marble: (ctx, w, h, [, accent, detail]) => {
    const rnd = createRandom(11);
    ctx.lineCap = 'round';
    for (let i = 0; i < 14; i++) {
      ctx.strokeStyle = i % 3 ? accent : detail;
      ctx.lineWidth = 1 + rnd() * 4;
      ctx.beginPath();
      let x = rnd() * w;
      let y = rnd() * h;
      ctx.moveTo(x, y);
      for (let k = 0; k < 8; k++) {
        x += (rnd() - 0.3) * 40;
        y += (rnd() - 0.5) * 24;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  },
  rings: (ctx, w, h, [, accent, detail]) => {
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 ? accent : detail;
      ctx.fillRect(0, (i * h) / 6 + 4, w, h / 14);
    }
  },
};

export const createSkinTexture = (look: SkinLook): THREE.Texture => {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not available');
  ctx.fillStyle = look.colors[0];
  ctx.fillRect(0, 0, 256, 128);
  PAINT[look.pattern](ctx, 256, 128, look.colors);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

/** The ball's material for a skin. Chrome-like skins reflect a soft sky made on the fly. */
export const createSkinMaterial = (look: SkinLook): THREE.MeshPhysicalMaterial => {
  const map = createSkinTexture(look);
  return new THREE.MeshPhysicalMaterial({
    map,
    roughness: look.roughness,
    metalness: look.metalness,
    clearcoat: look.clearcoat,
    clearcoatRoughness: 0.08,
    ...(look.glow ? { emissive: new THREE.Color(look.colors[2]), emissiveIntensity: look.glow, emissiveMap: map } : {}),
  });
};
