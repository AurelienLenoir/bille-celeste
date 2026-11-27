import type { Level } from './schema';

type Text = Level['name'];
export type Theme = Level['decor']['theme'];

export type World = {
  id: 1 | 2 | 3 | 4;
  theme: Theme;
  name: Text;
  /** What the world introduces, shown under its name on the map. */
  tagline: Text;
  /** Stars needed overall to open the world (PLAN.md § 5.3). */
  unlockStars: number;
  /** Its five levels, in order. */
  levels: readonly string[];
};

const levelsOf = (world: number) => [1, 2, 3, 4, 5].map((n) => `w${world}-0${n}`);

/**
 * The campaign (PLAN.md § 3.3): four worlds of five levels. Each world introduces its mechanics
 * gently, combines them, then puts them to the test in its fifth level.
 */
export const WORLDS: readonly World[] = [
  {
    id: 1,
    theme: 'garden',
    name: { fr: 'Jardins flottants', en: 'Floating Gardens' },
    tagline: { fr: 'Pencher, cristaux, checkpoints', en: 'Tilting, crystals, checkpoints' },
    unlockStars: 0,
    levels: levelsOf(1),
  },
  {
    id: 2,
    theme: 'sunset',
    name: { fr: 'Coucher de soleil', en: 'Sunset Heights' },
    tagline: { fr: 'Plateformes mobiles, pads, tremplins', en: 'Moving platforms, pads, jumps' },
    unlockStars: 10,
    levels: levelsOf(2),
  },
  {
    id: 3,
    theme: 'glacier',
    name: { fr: 'Glacier céleste', en: 'Sky Glacier' },
    tagline: { fr: 'Glace, vent, dalles qui tombent', en: 'Ice, wind, falling tiles' },
    unlockStars: 22,
    levels: levelsOf(3),
  },
  {
    id: 4,
    theme: 'factory',
    name: { fr: 'Usine à nuages', en: 'Cloud Factory' },
    tagline: { fr: 'Tapis, pousseurs, aimants, inversion', en: 'Belts, pushers, magnets, reversal' },
    unlockStars: 35,
    levels: levelsOf(4),
  },
];

/** Every campaign level, in play order. */
export const CAMPAIGN: readonly string[] = WORLDS.flatMap((w) => w.levels);

export const worldOfLevel = (id: string): World | undefined => WORLDS.find((w) => w.levels.includes(id));

/** The level after `id` in the campaign, if any. */
export const nextLevel = (id: string): string | undefined => {
  const i = CAMPAIGN.indexOf(id);
  return i >= 0 ? CAMPAIGN[i + 1] : undefined;
};

/** "1-3" for w1-03. */
export const levelNumber = (id: string): string => id.replace(/^w(\d)-0?(\d+)$/, '$1-$2');
