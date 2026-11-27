/**
 * Native/web adapters live here, and only here may Capacitor be imported (phase 6).
 * Until then the game always runs as a plain web page.
 */
export type Platform = 'web' | 'native';

export const detectPlatform = (): Platform => ('Capacitor' in window ? 'native' : 'web');
