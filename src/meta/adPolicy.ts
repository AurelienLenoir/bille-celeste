import { CAMPAIGN } from '../levels/worlds';

/**
 * When an interstitial ad may show (PLAN.md § 10.3): at most one every 3 wins, never in the first
 * five levels, never for a player who bought "no ads". The caller only asks between runs, never
 * during play.
 */
export const INTERSTITIAL_EVERY = 3;
export const FREE_LEVELS = 5;

export const mayShowInterstitial = (levelId: string, winsSinceAd: number, noAds: boolean): boolean => {
  if (noAds) return false;
  const index = CAMPAIGN.indexOf(levelId);
  if (index < FREE_LEVELS) return false;
  return winsSinceAd >= INTERSTITIAL_EVERY;
};
