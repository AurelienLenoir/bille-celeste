/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Anonymous statistics (PostHog project key) — optional. */
  readonly VITE_POSTHOG_KEY?: string;
  readonly VITE_POSTHOG_HOST?: string;
  /** Crash reports (Sentry DSN) — optional. */
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_RELEASE?: string;
  /** AdMob ad units (phase 9); Google's test units are used without them. */
  readonly VITE_ADMOB_IOS_REWARDED?: string;
  readonly VITE_ADMOB_IOS_INTERSTITIAL?: string;
  readonly VITE_ADMOB_ANDROID_REWARDED?: string;
  readonly VITE_ADMOB_ANDROID_INTERSTITIAL?: string;
  /** RevenueCat public SDK keys (phase 9); purchases are off without them. */
  readonly VITE_REVENUECAT_IOS?: string;
  readonly VITE_REVENUECAT_ANDROID?: string;
}
