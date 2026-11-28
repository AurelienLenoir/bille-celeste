import { detectPlatform, isNative } from '.';

/**
 * AdMob (PLAN.md § 10.3): rewarded ads chosen by the player, and rare interstitials. The UMP
 * consent form (GDPR) is shown first when required, then Apple's ATT prompt on iOS; refusing either
 * keeps the game working (non-personalised ads, or none). In a browser there are no ads.
 *
 * Ad units come from the build (VITE_ADMOB_*); without them the apps use Google's public test
 * units, which never pay but let the flow be tested.
 */
export type Ads = {
  /** Can this build show ads at all (native app)? */
  available: () => boolean;
  /** Asks for consent (once per launch when needed) and starts the SDK. */
  start: () => Promise<void>;
  /** Shows a rewarded ad; resolves true when the reward was earned. */
  rewarded: () => Promise<boolean>;
  /** Shows an interstitial if one is ready; resolves when it is closed. */
  interstitial: () => Promise<void>;
};

type AdUnits = { rewarded: string; interstitial: string };

/** Google's documented test ad units. */
const TEST_UNITS: Record<'ios' | 'android', AdUnits> = {
  ios: { rewarded: 'ca-app-pub-3940256099942544/1712485313', interstitial: 'ca-app-pub-3940256099942544/4411468910' },
  android: {
    rewarded: 'ca-app-pub-3940256099942544/5224354917',
    interstitial: 'ca-app-pub-3940256099942544/1033173712',
  },
};

const unitsFor = (platform: 'ios' | 'android'): AdUnits & { testing: boolean } => {
  const env = import.meta.env;
  const rewarded = platform === 'ios' ? env.VITE_ADMOB_IOS_REWARDED : env.VITE_ADMOB_ANDROID_REWARDED;
  const interstitial = platform === 'ios' ? env.VITE_ADMOB_IOS_INTERSTITIAL : env.VITE_ADMOB_ANDROID_INTERSTITIAL;
  if (rewarded && interstitial) return { rewarded, interstitial, testing: false };
  return { ...TEST_UNITS[platform], testing: true };
};

const loadAdMob = () => import('@capacitor-community/admob');

export const createAds = (): Ads => {
  const platform = detectPlatform();
  if (!isNative() || platform === 'web') {
    return {
      available: () => false,
      start: async () => undefined,
      rewarded: async () => false,
      interstitial: async () => undefined,
    };
  }
  const units = unitsFor(platform);
  let started: Promise<boolean> | undefined;
  /** Personalised ads only with consent; otherwise non-personalised (`npa`). */
  let personalised = false;

  const start = () =>
    (started ??= (async () => {
      try {
        const { AdMob, AdmobConsentStatus, MaxAdContentRating } = await loadAdMob();
        let consent = await AdMob.requestConsentInfo();
        if (consent.isConsentFormAvailable && consent.status === AdmobConsentStatus.REQUIRED) {
          consent = await AdMob.showConsentForm();
        }
        if (!consent.canRequestAds) return false;
        personalised =
          consent.status === AdmobConsentStatus.OBTAINED || consent.status === AdmobConsentStatus.NOT_REQUIRED;
        if (platform === 'ios') {
          await AdMob.requestTrackingAuthorization();
          const tracking = await AdMob.trackingAuthorizationStatus();
          personalised &&= tracking.status === 'authorized';
        }
        await AdMob.initialize({
          initializeForTesting: units.testing,
          // Audience 13+ (PLAN.md § 10.5) with family-friendly ad content only.
          tagForChildDirectedTreatment: false,
          maxAdContentRating: MaxAdContentRating.General,
        });
        return true;
      } catch {
        return false;
      }
    })()).then(() => undefined);

  const ready = async () => {
    await start();
    return (await started) ?? false;
  };

  return {
    available: () => true,
    start,
    rewarded: async () => {
      if (!(await ready())) return false;
      try {
        const { AdMob } = await loadAdMob();
        await AdMob.prepareRewardVideoAd({ adId: units.rewarded, isTesting: units.testing, npa: !personalised });
        const reward = await AdMob.showRewardVideoAd();
        return reward.amount > 0 || !!reward.type;
      } catch {
        return false;
      }
    },
    interstitial: async () => {
      if (!(await ready())) return;
      try {
        const { AdMob } = await loadAdMob();
        await AdMob.prepareInterstitial({ adId: units.interstitial, isTesting: units.testing, npa: !personalised });
        await AdMob.showInterstitial();
      } catch {
        // No ad to show: the game simply goes on.
      }
    },
  };
};
