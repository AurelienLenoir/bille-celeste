import { z } from 'zod';

/**
 * Ball skins (PLAN.md § 10.2): data validated by Zod. Purely cosmetic, no gameplay advantage.
 * A skin is a material, a procedural pattern, a trail colour and a burst colour.
 */
export const PATTERNS = ['stripe', 'dots', 'checker', 'swirl', 'stars', 'solid', 'marble', 'rings'] as const;
export const RARITIES = ['common', 'rare', 'epic', 'legendary'] as const;
export type Rarity = (typeof RARITIES)[number];

const color = z.string().regex(/^#[0-9a-f]{6}$/i);
const text = z.object({ fr: z.string().min(1), en: z.string().min(1) });

export const skinLookSchema = z.object({
  pattern: z.enum(PATTERNS),
  /** Base, accent and detail colours of the pattern. */
  colors: z.tuple([color, color, color]),
  roughness: z.number().min(0).max(1),
  metalness: z.number().min(0).max(1),
  clearcoat: z.number().min(0).max(1),
  /** Self-lit glow (0 none). */
  glow: z.number().min(0).max(1).default(0),
});
export type SkinLook = z.infer<typeof skinLookSchema>;

export const skinSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,24}$/),
  name: text,
  rarity: z.enum(RARITIES),
  /** Price in feathers; 0 = owned from the start. */
  price: z.number().int().min(0),
  look: skinLookSchema,
  /** Colour of the speed trail and of the burst at each crystal. */
  trail: color,
});
export type Skin = z.infer<typeof skinSchema>;

const RAW_SKINS: z.input<typeof skinSchema>[] = [
  {
    id: 'classic',
    name: { fr: 'Classique', en: 'Classic' },
    rarity: 'common',
    price: 0,
    look: { pattern: 'stripe', colors: ['#ff5d86', '#fff4f7', '#ffd25e'], roughness: 0.18, metalness: 0, clearcoat: 1 },
    trail: '#ffffff',
  },
  {
    id: 'mint',
    name: { fr: 'Menthe', en: 'Mint' },
    rarity: 'common',
    price: 60,
    look: { pattern: 'dots', colors: ['#5fd3a8', '#ffffff', '#2f9f7a'], roughness: 0.3, metalness: 0, clearcoat: 0.8 },
    trail: '#c8ffe8',
  },
  {
    id: 'lagoon',
    name: { fr: 'Lagon', en: 'Lagoon' },
    rarity: 'common',
    price: 60,
    look: { pattern: 'rings', colors: ['#3fb6ff', '#e8f7ff', '#1d6fd1'], roughness: 0.2, metalness: 0, clearcoat: 1 },
    trail: '#bfe8ff',
  },
  {
    id: 'checkers',
    name: { fr: 'Damier', en: 'Checkers' },
    rarity: 'common',
    price: 80,
    look: {
      pattern: 'checker',
      colors: ['#2a2f4a', '#f5f1e6', '#f5f1e6'],
      roughness: 0.25,
      metalness: 0,
      clearcoat: 1,
    },
    trail: '#f5f1e6',
  },
  {
    id: 'sunset',
    name: { fr: 'Crépuscule', en: 'Dusk' },
    rarity: 'rare',
    price: 150,
    look: { pattern: 'swirl', colors: ['#ff8a5c', '#ffd08a', '#c94f8f'], roughness: 0.2, metalness: 0, clearcoat: 1 },
    trail: '#ffc29a',
  },
  {
    id: 'marble',
    name: { fr: 'Marbre', en: 'Marble' },
    rarity: 'rare',
    price: 180,
    look: { pattern: 'marble', colors: ['#f4f1ec', '#8f8aa0', '#c9c2d6'], roughness: 0.12, metalness: 0, clearcoat: 1 },
    trail: '#e8e4f0',
  },
  {
    id: 'frost',
    name: { fr: 'Givre', en: 'Frost' },
    rarity: 'rare',
    price: 200,
    look: {
      pattern: 'stars',
      colors: ['#bfe4ff', '#ffffff', '#7fb8ff'],
      roughness: 0.05,
      metalness: 0.1,
      clearcoat: 1,
      glow: 0.1,
    },
    trail: '#e4f4ff',
  },
  {
    id: 'bee',
    name: { fr: 'Abeille', en: 'Bumblebee' },
    rarity: 'rare',
    price: 200,
    look: {
      pattern: 'stripe',
      colors: ['#ffc928', '#2b2525', '#ffffff'],
      roughness: 0.3,
      metalness: 0,
      clearcoat: 0.6,
    },
    trail: '#ffe58a',
  },
  {
    id: 'chrome',
    name: { fr: 'Chrome', en: 'Chrome' },
    rarity: 'epic',
    price: 400,
    look: {
      pattern: 'solid',
      colors: ['#dfe6f2', '#ffffff', '#9aa6ba'],
      roughness: 0.15,
      metalness: 0.6,
      clearcoat: 1,
    },
    trail: '#ffffff',
  },
  {
    id: 'galaxy',
    name: { fr: 'Galaxie', en: 'Galaxy' },
    rarity: 'epic',
    price: 450,
    look: {
      pattern: 'stars',
      colors: ['#24164f', '#ffffff', '#b07cff'],
      roughness: 0.15,
      metalness: 0,
      clearcoat: 1,
      glow: 0.25,
    },
    trail: '#c9a8ff',
  },
  {
    id: 'lava',
    name: { fr: 'Lave', en: 'Lava' },
    rarity: 'epic',
    price: 450,
    look: {
      pattern: 'marble',
      colors: ['#3a1410', '#ff6a1f', '#ffc04f'],
      roughness: 0.5,
      metalness: 0,
      clearcoat: 0.3,
      glow: 0.45,
    },
    trail: '#ff9a4f',
  },
  {
    id: 'aurora',
    name: { fr: 'Aurore céleste', en: 'Sky aurora' },
    rarity: 'legendary',
    price: 900,
    look: {
      pattern: 'swirl',
      colors: ['#6fe0ff', '#b07cff', '#ff7ac8'],
      roughness: 0.1,
      metalness: 0.2,
      clearcoat: 1,
      glow: 0.35,
    },
    trail: '#d8b8ff',
  },
];

/** The catalogue, validated when the game loads (a broken skin fails the tests, not a player). */
export const SKINS: readonly Skin[] = RAW_SKINS.map((s) => skinSchema.parse(s));

export const DEFAULT_SKIN = 'classic';

export const skinById = (id: string): Skin => SKINS.find((s) => s.id === id) ?? (SKINS[0] as Skin);
