import * as THREE from 'three';
import { SKY_GRADIENT, type SkyGradient } from './palette';

const canvas2d = (width: number, height: number) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not available');
  return { canvas, ctx };
};

const toTexture = (canvas: HTMLCanvasElement) => {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

export const createSkyTexture = (sky: SkyGradient = SKY_GRADIENT): THREE.Texture => {
  const { canvas, ctx } = canvas2d(2, 256);
  const gradient = ctx.createLinearGradient(0, 0, 0, 256);
  for (const [stop, color] of sky) gradient.addColorStop(stop, color);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 2, 256);
  return toTexture(canvas);
};

/** Two-tone checkerboard tile with a soft white border, repeated across track tops. */
export const createTileTexture = (base: string, check: string): THREE.Texture => {
  const { canvas, ctx } = canvas2d(128, 128);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = check;
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillRect(64, 64, 64, 64);
  ctx.strokeStyle = 'rgba(255,255,255,.45)';
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, 125, 125);
  const texture = toTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
};

export const createBallTexture = (): THREE.Texture => {
  const { canvas, ctx } = canvas2d(256, 128);
  ctx.fillStyle = '#ff5d86';
  ctx.fillRect(0, 0, 256, 128);
  ctx.fillStyle = '#fff4f7';
  ctx.fillRect(0, 54, 256, 20);
  ctx.fillStyle = '#ffd25e';
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    ctx.arc(16 + i * 32, 26 + (i % 2) * 76, 9, 0, 7);
    ctx.fill();
  }
  return toTexture(canvas);
};
