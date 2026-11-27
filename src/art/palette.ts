export const SURFACES = {
  cream: { top: ['#fbeed6', '#f0d9b2'], side: 0x6fb3c8 },
  mint: { top: ['#d9f5e6', '#bce8d1'], side: 0x5aa88a },
  rose: { top: ['#ffe2e8', '#ffc6d3'], side: 0xe0889f },
  lav: { top: ['#e8e2ff', '#d2c7ff'], side: 0x9586d8 },
  wood: { top: ['#e9c79a', '#d9b07c'], side: 0xa8774a },
} as const;

export const SKY_GRADIENT = [
  [0, '#6fbcff'],
  [0.55, '#cde9ff'],
  [1, '#ffe6cc'],
] as const;

export const FOG = { color: 0xd6ebff, near: 28, far: 90 } as const;

export const CRYSTAL_HUES = [0x4fd8ff, 0xff6fae, 0xffd04f] as const;

export const INACTIVE = 0xb8c3d6;
export const CHECKPOINT_ON = 0x3fcf8e;
export const GOAL_OPEN = { color: 0xffc93c, emissive: 0x8a5a00 } as const;

export const DECOR = {
  rock: 0xc9a98a,
  grass: 0x8fd68a,
  leaf: 0x4fae6e,
  cloud: 0xffffff,
} as const;
