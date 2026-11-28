import { detectPlatform } from '.';
import type { KeyValueStorage } from './storage';

/**
 * Anonymous statistics (PostHog capture API, no SDK) and crash reports (Sentry), only with the
 * player's consent, and only in a build given the keys (VITE_POSTHOG_KEY, VITE_SENTRY_DSN).
 * Nothing personal is sent: a random install id, the level, times and falls.
 */
export type TelemetryEvent = 'level_start' | 'level_win' | 'level_quit';
export type TelemetryProps = Record<string, string | number | boolean>;

export type Telemetry = {
  /** Is there anything to consent to in this build? */
  available: boolean;
  track: (event: TelemetryEvent, props: TelemetryProps) => void;
  /** Starts crash reports once the player agreed (loads Sentry on demand). */
  startCrashReports: () => void;
};

type TelemetryConfig = {
  posthogKey?: string | undefined;
  posthogHost?: string | undefined;
  sentryDsn?: string | undefined;
  release?: string | undefined;
};

const ID_KEY = 'bille-celeste.install-id';

const randomId = () =>
  typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** The PostHog `capture` payload for one event. Exported for the tests. */
export const captureBody = (key: string, id: string, event: TelemetryEvent, props: TelemetryProps) => ({
  api_key: key,
  event,
  distinct_id: id,
  properties: { ...props, platform: detectPlatform(), $process_person_profile: false },
});

export const createTelemetry = (
  config: TelemetryConfig,
  consented: () => boolean,
  storage: KeyValueStorage,
): Telemetry => {
  const { posthogKey, sentryDsn } = config;
  const host = config.posthogHost ?? 'https://eu.i.posthog.com';
  let id: Promise<string> | undefined;
  const installId = () =>
    (id ??= storage.get(ID_KEY).then(async (saved) => {
      if (saved) return saved;
      const fresh = randomId();
      await storage.set(ID_KEY, fresh);
      return fresh;
    }));
  let crashesStarted = false;

  return {
    available: !!(posthogKey || sentryDsn),
    track: (event, props) => {
      if (!posthogKey || !consented()) return;
      void installId()
        .then((distinct) =>
          fetch(`${host}/capture/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(captureBody(posthogKey, distinct, event, props)),
            keepalive: true,
          }),
        )
        .catch(() => undefined);
    },
    startCrashReports: () => {
      if (!sentryDsn || crashesStarted || !consented()) return;
      crashesStarted = true;
      void import('@sentry/browser')
        .then((Sentry) =>
          Sentry.init({
            dsn: sentryDsn,
            ...(config.release ? { release: config.release } : {}),
            tracesSampleRate: 0,
            initialScope: { tags: { platform: detectPlatform() } },
          }),
        )
        .catch(() => undefined);
    },
  };
};

/** Keys given at build time (`.env` or CI secrets); missing keys turn the feature off. */
export const telemetryConfigFromEnv = (): TelemetryConfig => ({
  posthogKey: import.meta.env.VITE_POSTHOG_KEY,
  posthogHost: import.meta.env.VITE_POSTHOG_HOST,
  sentryDsn: import.meta.env.VITE_SENTRY_DSN,
  release: import.meta.env.VITE_RELEASE,
});
