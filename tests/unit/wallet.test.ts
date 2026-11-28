import { describe, expect, it } from 'vitest';
import { FREE_LEVELS, mayShowInterstitial } from '../../src/meta/adPolicy';
import { DEFAULT_SKIN, SKINS, skinById } from '../../src/meta/skins';
import {
  buySkin,
  currentDaily,
  dailyFor,
  emptyWallet,
  equipSkin,
  FEATHERS,
  parseStoredWallet,
  payWin,
  readWallet,
  today,
  type Wallet,
} from '../../src/meta/wallet';
import { CAMPAIGN } from '../../src/levels/worlds';

const run = (over: Partial<{ underPar: boolean; noFall: boolean; gem: boolean }> = {}) => ({
  time: 40,
  falls: over.noFall === false ? 1 : 0,
  gem: over.gem ?? false,
  stars: { underPar: over.underPar ?? false, noFall: over.noFall ?? true, count: 2 as const },
});

describe('skins', () => {
  it('has a valid catalogue with unique ids and one free skin', () => {
    expect(new Set(SKINS.map((s) => s.id)).size).toBe(SKINS.length);
    expect(SKINS.filter((s) => s.price === 0).map((s) => s.id)).toEqual([DEFAULT_SKIN]);
    expect(SKINS.length).toBeGreaterThanOrEqual(10);
  });
  it('falls back to the default skin for an unknown id', () => {
    expect(skinById('nope').id).toBe(DEFAULT_SKIN);
  });
});

describe('wallet save', () => {
  it('starts with the default skin and no feathers', () => {
    expect(parseStoredWallet(null)).toEqual(emptyWallet());
  });
  it('drops unknown skins and never loses the default one', () => {
    const w = readWallet({
      version: 1,
      feathers: 12,
      owned: ['mint', 'ghost'],
      equipped: 'ghost',
      gemsPaid: [],
      noAds: false,
      winsSinceAd: 0,
    });
    expect(w.owned).toEqual([DEFAULT_SKIN, 'mint']);
    expect(w.equipped).toBe(DEFAULT_SKIN);
    expect(w.feathers).toBe(12);
  });
  it('salvages valid fields of a damaged save', () => {
    const w = readWallet({ version: 1, feathers: -5, noAds: true });
    expect(w.feathers).toBe(0);
    expect(w.noAds).toBe(true);
  });
  it('ignores a save from a newer version', () => {
    expect(readWallet({ version: 99, feathers: 500 })).toEqual(emptyWallet());
  });
});

describe('earning feathers', () => {
  const day = '2026-11-28';
  it('pays each new star and a gem only the first time', () => {
    const first = payWin(emptyWallet(), 'w1-03', run({ gem: true }), { gainedStars: 2 }, day);
    expect(first.earnings.stars).toBe(2 * FEATHERS.star);
    expect(first.earnings.gem).toBe(FEATHERS.gem);
    const again = payWin(first.wallet, 'w1-03', run({ gem: true }), { gainedStars: 0 }, day);
    expect(again.earnings.gem).toBe(0);
    expect(again.earnings.stars).toBe(0);
  });
  it('pays the daily challenge once, and renews it the next day', () => {
    const kinds = new Set(
      Array.from({ length: 30 }, (_, i) => dailyFor(`2026-12-${String(i + 1).padStart(2, '0')}`).kind),
    );
    expect(kinds.size).toBeGreaterThan(1);
    let wallet: Wallet = emptyWallet();
    let paid = 0;
    for (let i = 0; i < 4; i++) {
      const r = payWin(wallet, 'w1-02', run({ underPar: true, gem: true }), { gainedStars: 0 }, day);
      wallet = r.wallet;
      paid += r.earnings.daily;
    }
    expect(paid).toBe(FEATHERS.daily);
    expect(currentDaily(wallet, day).done).toBe(true);
    expect(currentDaily(wallet, '2026-11-29').done).toBe(false);
  });
  it('counts wins for the interstitial pacing', () => {
    const r = payWin(emptyWallet(), 'w2-01', run(), undefined, day);
    expect(r.wallet.winsSinceAd).toBe(1);
  });
  it('formats today as a local date', () => {
    expect(today(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('buying skins', () => {
  it('needs enough feathers, takes them, and can be equipped after', () => {
    const price = skinById('mint').price;
    expect(buySkin(emptyWallet(), 'mint')).toEqual({ ok: false, reason: 'poor' });
    const rich = { ...emptyWallet(), feathers: price + 5 };
    const bought = buySkin(rich, 'mint');
    if (!bought.ok) throw new Error('should buy');
    expect(bought.wallet.feathers).toBe(5);
    expect(buySkin(bought.wallet, 'mint')).toEqual({ ok: false, reason: 'owned' });
    expect(equipSkin(bought.wallet, 'mint').equipped).toBe('mint');
    expect(equipSkin(emptyWallet(), 'mint').equipped).toBe(DEFAULT_SKIN);
  });
});

describe('interstitial ads', () => {
  const late = CAMPAIGN[FREE_LEVELS] ?? 'w2-01';
  it('never show in the first five levels', () => {
    for (const id of CAMPAIGN.slice(0, FREE_LEVELS)) expect(mayShowInterstitial(id, 10, false)).toBe(false);
  });
  it('show at most once every three wins after that', () => {
    expect(mayShowInterstitial(late, 2, false)).toBe(false);
    expect(mayShowInterstitial(late, 3, false)).toBe(true);
  });
  it('never show after buying "no ads"', () => {
    expect(mayShowInterstitial(late, 10, true)).toBe(false);
  });
});
