export const SURFACES = {
  cream: { top: ['#fbeed6', '#f0d9b2'], side: 0x6fb3c8 },
  mint: { top: ['#d9f5e6', '#bce8d1'], side: 0x5aa88a },
  rose: { top: ['#ffe2e8', '#ffc6d3'], side: 0xe0889f },
  lav: { top: ['#e8e2ff', '#d2c7ff'], side: 0x9586d8 },
  wood: { top: ['#e9c79a', '#d9b07c'], side: 0xa8774a },
} as const;

export type SkyGradient = readonly (readonly [number, string])[];

export const SKY_GRADIENT: SkyGradient = [
  [0, '#6fbcff'],
  [0.55, '#cde9ff'],
  [1, '#ffe6cc'],
];

export const FOG = { color: 0xd6ebff, near: 28, far: 90 } as const;
/** Scene fog inside the thickest fog zone. */
export const FOG_THICK = { near: 2, far: 13 } as const;

export const CRYSTAL_HUES = [0x4fd8ff, 0xff6fae, 0xffd04f] as const;

export const INACTIVE = 0xb8c3d6;
export const CHECKPOINT_ON = 0x3fcf8e;
export const GOAL_OPEN = { color: 0xffc93c, emissive: 0x8a5a00 } as const;

export type DecorColors = { rock: number; grass: number; leaf: number; cloud: number };

export const DECOR: DecorColors = {
  rock: 0xc9a98a,
  grass: 0x8fd68a,
  leaf: 0x4fae6e,
  cloud: 0xffffff,
};

/** Look of a world (PLAN.md § 3.3): sky, distance fog and floating islands. Phase 5 dresses them further. */
export type ThemeLook = { sky: SkyGradient; fog: number; decor: DecorColors };

export const THEME_LOOKS = {
  garden: { sky: SKY_GRADIENT, fog: FOG.color, decor: DECOR },
  sunset: {
    sky: [
      [0, '#5a6fd0'],
      [0.45, '#ff9fb2'],
      [1, '#ffd08a'],
    ],
    fog: 0xffc9b8,
    decor: { rock: 0xc08a78, grass: 0xf2a65e, leaf: 0xe2685f, cloud: 0xffe4dc },
  },
  glacier: {
    sky: [
      [0, '#7fb0e8'],
      [0.6, '#dff1ff'],
      [1, '#f4fbff'],
    ],
    fog: 0xe4f3ff,
    decor: { rock: 0x9fb4cc, grass: 0xf2f8ff, leaf: 0x8cc8e8, cloud: 0xffffff },
  },
  factory: {
    sky: [
      [0, '#2c2f5e'],
      [0.55, '#6a6aa8'],
      [1, '#c6a8d8'],
    ],
    fog: 0x8f88bd,
    decor: { rock: 0x8a8fa8, grass: 0xb9c0d8, leaf: 0xf0b8d0, cloud: 0xe8e4ff },
  },
} as const satisfies Record<string, ThemeLook>;
