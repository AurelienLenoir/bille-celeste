/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Anonymous statistics (PostHog project key) — optional. */
  readonly VITE_POSTHOG_KEY?: string;
  readonly VITE_POSTHOG_HOST?: string;
  /** Crash reports (Sentry DSN) — optional. */
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_RELEASE?: string;
}
