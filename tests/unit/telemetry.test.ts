import { describe, expect, it, vi } from 'vitest';
import { captureBody, createTelemetry } from '../../src/platform/telemetry';

const memory = () => {
  const data = new Map<string, string>();
  return { get: async (k: string) => data.get(k) ?? null, set: async (k: string, v: string) => void data.set(k, v) };
};

describe('telemetry', () => {
  it('is off in a build without keys', () => {
    expect(createTelemetry({}, () => true, memory()).available).toBe(false);
  });
  it('sends nothing without consent', async () => {
    const fetch = vi.fn(async () => new Response());
    vi.stubGlobal('fetch', fetch);
    const telemetry = createTelemetry({ posthogKey: 'k' }, () => false, memory());
    telemetry.track('level_start', { level: 'w1-01' });
    await new Promise((r) => setTimeout(r, 0));
    expect(fetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
  it('sends an anonymous event with the same install id each time once agreed', async () => {
    const fetch = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () => new Response());
    vi.stubGlobal('fetch', fetch);
    const telemetry = createTelemetry({ posthogKey: 'k', posthogHost: 'https://ph.test' }, () => true, memory());
    telemetry.track('level_start', { level: 'w1-01' });
    telemetry.track('level_win', { level: 'w1-01', time: 30, falls: 0 });
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    const bodies = fetch.mock.calls.map(([, init]) => JSON.parse(String(init.body)) as { distinct_id: string });
    expect(fetch.mock.calls[0]?.[0]).toBe('https://ph.test/capture/');
    expect(bodies[0]?.distinct_id).toBe(bodies[1]?.distinct_id);
    vi.unstubAllGlobals();
  });
  it('carries no personal data, only the game facts', () => {
    const body = captureBody('k', 'id', 'level_quit', { level: 'w2-03', falls: 4 });
    expect(Object.keys(body.properties).sort()).toEqual(['$process_person_profile', 'falls', 'level', 'platform']);
  });
});
