import { z } from 'zod';
import { CAMPAIGN } from '../levels/worlds';
import type { WinningRun, WinOutcome } from './progress';
import { isRecord, parseSave, readSave, type Migration, type SaveFormat } from './save';
import { DEFAULT_SKIN, SKINS } from './skins';

/**
 * Feathers, skins and purchases (PLAN.md § 10): saved apart from the progress so the two formats
 * evolve on their own.
 */
export const WALLET_VERSION = 1;

/** Feathers for each new star, for a level's hidden gem (first time only), and for the daily challenge. */
export const FEATHERS = { star: 10, gem: 25, daily: 30 } as const;

export const DAILY_KINDS = ['winNoFall', 'winUnderPar', 'findGem', 'winThree'] as const;
export type DailyKind = (typeof DAILY_KINDS)[number];

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const levelId = z.string().regex(/^[a-z0-9-]{1,32}$/);

const dailySchema = z.object({
  date: dateKey,
  kind: z.enum(DAILY_KINDS),
  /** Wins counted toward `winThree`. */
  count: z.number().int().min(0),
  done: z.boolean(),
});
export type Daily = z.infer<typeof dailySchema>;

export const walletSchema = z.object({
  version: z.literal(WALLET_VERSION),
  feathers: z.number().int().min(0),
  owned: z.array(z.string()),
  equipped: z.string(),
  /** Levels whose hidden gem already paid out. */
  gemsPaid: z.array(levelId),
  /** "No ads" was bought (restored from the store on each launch in the apps). */
  noAds: z.boolean(),
  /** Wins since the last interstitial ad. */
  winsSinceAd: z.number().int().min(0),
  daily: dailySchema.optional(),
});
export type Wallet = z.infer<typeof walletSchema>;

export const emptyWallet = (): Wallet => ({
  version: WALLET_VERSION,
  feathers: 0,
  owned: [DEFAULT_SKIN],
  equipped: DEFAULT_SKIN,
  gemsPaid: [],
  noAds: false,
  winsSinceAd: 0,
});

const knownSkin = (id: unknown): id is string => typeof id === 'string' && SKINS.some((s) => s.id === id);

/** Keeps what is valid: unknown skins are dropped, the default skin is always owned. */
const salvage = (raw: Record<string, unknown>): Wallet => {
  const base = emptyWallet();
  const field = <K extends keyof Wallet>(key: K): Wallet[K] => {
    const parsed = walletSchema.shape[key].safeParse(raw[key]);
    return (parsed.success ? parsed.data : base[key]) as Wallet[K];
  };
  const owned = [...new Set([DEFAULT_SKIN, ...(Array.isArray(raw.owned) ? raw.owned.filter(knownSkin) : [])])];
  const equipped = knownSkin(raw.equipped) && owned.includes(raw.equipped) ? raw.equipped : DEFAULT_SKIN;
  const daily = isRecord(raw.daily) ? dailySchema.safeParse(raw.daily) : undefined;
  return {
    version: WALLET_VERSION,
    feathers: field('feathers'),
    owned,
    equipped,
    gemsPaid: field('gemsPaid'),
    noAds: field('noAds'),
    winsSinceAd: field('winsSinceAd'),
    ...(daily?.success ? { daily: daily.data } : {}),
  };
};

/** Version 1 is the first wallet format; a v2 adds `1: (v1) => v2` and its test. */
export const WALLET_MIGRATIONS: Record<number, Migration> = {};

const WALLET_FORMAT: SaveFormat<Wallet> = {
  version: WALLET_VERSION,
  migrations: WALLET_MIGRATIONS,
  fallback: emptyWallet,
  finalize: salvage,
};

export const readWallet = (stored: unknown): Wallet => readSave(stored, WALLET_FORMAT);
export const parseStoredWallet = (json: string | null): Wallet => parseSave(json, WALLET_FORMAT);

/** Local calendar day, `YYYY-MM-DD`. */
export const today = (now: Date = new Date()): string =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

/** The same challenge for everybody on a given day. */
export const dailyFor = (date: string): Daily => {
  let hash = 7;
  for (const c of date) hash = (hash * 31 + c.charCodeAt(0)) % 1_000_003;
  return { date, kind: DAILY_KINDS[hash % DAILY_KINDS.length] ?? 'winThree', count: 0, done: false };
};

/** Today's challenge, renewed when the day changed. */
export const currentDaily = (wallet: Wallet, date: string): Daily =>
  wallet.daily?.date === date ? wallet.daily : dailyFor(date);

const advanceDaily = (daily: Daily, run: WinningRun): Daily => {
  if (daily.done) return daily;
  const count = daily.count + 1;
  const done =
    daily.kind === 'winNoFall'
      ? run.stars.noFall
      : daily.kind === 'winUnderPar'
        ? run.stars.underPar
        : daily.kind === 'findGem'
          ? run.gem
          : count >= 3;
  return { ...daily, count, done };
};

/** What one win paid, for the victory screen (and to double with a rewarded ad). */
export type Earnings = { stars: number; gem: number; daily: number; total: number };

/** Pays a won campaign run: new stars, a first-found gem, today's challenge. Counts the win for ads. */
export const payWin = (
  wallet: Wallet,
  levelId: string,
  run: WinningRun,
  outcome: Pick<WinOutcome, 'gainedStars'> | undefined,
  date: string,
): { wallet: Wallet; earnings: Earnings } => {
  const stars = (outcome?.gainedStars ?? 0) * FEATHERS.star;
  const firstGem = run.gem && CAMPAIGN.includes(levelId) && !wallet.gemsPaid.includes(levelId);
  const gem = firstGem ? FEATHERS.gem : 0;
  const before = currentDaily(wallet, date);
  const after = advanceDaily(before, run);
  const daily = after.done && !before.done ? FEATHERS.daily : 0;
  const total = stars + gem + daily;
  return {
    wallet: {
      ...wallet,
      feathers: wallet.feathers + total,
      gemsPaid: firstGem ? [...wallet.gemsPaid, levelId] : wallet.gemsPaid,
      winsSinceAd: wallet.winsSinceAd + 1,
      daily: after,
    },
    earnings: { stars, gem, daily, total },
  };
};

export type BuyResult = { ok: true; wallet: Wallet } | { ok: false; reason: 'owned' | 'poor' | 'unknown' };

export const buySkin = (wallet: Wallet, id: string): BuyResult => {
  const skin = SKINS.find((s) => s.id === id);
  if (!skin) return { ok: false, reason: 'unknown' };
  if (wallet.owned.includes(id)) return { ok: false, reason: 'owned' };
  if (wallet.feathers < skin.price) return { ok: false, reason: 'poor' };
  return { ok: true, wallet: { ...wallet, feathers: wallet.feathers - skin.price, owned: [...wallet.owned, id] } };
};

export const equipSkin = (wallet: Wallet, id: string): Wallet =>
  wallet.owned.includes(id) ? { ...wallet, equipped: id } : wallet;

export const addFeathers = (wallet: Wallet, amount: number): Wallet => ({
  ...wallet,
  feathers: wallet.feathers + Math.max(0, Math.round(amount)),
});
