import * as THREE from 'three';
import type { Vec3Tuple } from '../engine/math';

export type SignSpec = {
  position: Vec3Tuple;
  /** Direction the reader looks (x, z). */ facing: readonly [number, number];
  text: string;
};

const WIDTH = 4.2;
const HEIGHT = 1.5;
const PX_PER_UNIT = 150;
/** Height of the panel's centre above the floor: high enough for the ball to roll under it. */
const LIFT = 2.4;
/** Leans back towards the follow camera, which looks down at about 30°. */
const LEAN = -0.38;

/** Splits `text` into lines that fit `width` pixels. */
const wrap = (ctx: CanvasRenderingContext2D, text: string, width: number): string[] => {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > width && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
};

const signTexture = (text: string): THREE.Texture => {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH * PX_PER_UNIT;
  canvas.height = HEIGHT * PX_PER_UNIT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not available');
  const { width: w, height: h } = canvas;
  ctx.fillStyle = 'rgba(255, 250, 240, 0.94)';
  ctx.strokeStyle = '#ff5d86';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.roundRect(8, 8, w - 16, h - 16, 36);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#22304a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let size = 54;
  let lines: string[] = [];
  do {
    ctx.font = `600 ${size}px Fredoka, system-ui, sans-serif`;
    lines = wrap(ctx, text, w - 70);
    size -= 4;
  } while (lines.length * size * 1.2 > h - 50 && size > 24);
  const lineHeight = (size + 4) * 1.2;
  lines.forEach((line, i) => ctx.fillText(line, w / 2, h / 2 + (i - (lines.length - 1) / 2) * lineHeight));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
};

const panel = new THREE.PlaneGeometry(WIDTH, HEIGHT);
/** Distance ahead of the ball (along -z, the camera's view) under which a sign fades out, so it never hides the ball. */
const FADE = { from: 4.5, to: 1.5 } as const;

export type Signs = { update: (ball: THREE.Vector3) => void };

/**
 * Tutorial signs floating above the course (PLAN.md § 8, phase 4: the tutorial is in the scenery,
 * not in pop-ups). One unlit panel each, without collision; the text is drawn on a canvas. A sign
 * fades out as the ball rolls under it, since the follow camera would then look through it.
 */
export const createSigns = (parent: THREE.Object3D, signs: readonly SignSpec[]): Signs => {
  const placed = signs.map(({ position, facing, text }) => {
    const material = new THREE.MeshBasicMaterial({ map: signTexture(text), transparent: true, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(panel, material);
    const [x, y, z] = position;
    mesh.position.set(x, y + LIFT, z);
    // The plane's front (+z) turns to face the reader, who looks along `facing`.
    mesh.rotation.set(LEAN, Math.atan2(-facing[0], -facing[1]), 0, 'YXZ');
    parent.add(mesh);
    return { mesh, material };
  });
  return {
    update: (ball) => {
      for (const { mesh, material } of placed) {
        const ahead = ball.z - mesh.position.z;
        const near = Math.abs(ball.x - mesh.position.x) < 4 && Math.abs(ball.y - mesh.position.y) < 6;
        const opacity = near ? Math.min(1, Math.max(0, (ahead - FADE.to) / (FADE.from - FADE.to))) : 1;
        material.opacity = opacity;
        mesh.visible = opacity > 0.01;
      }
    },
  };
};
