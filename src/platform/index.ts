import { Capacitor } from '@capacitor/core';

/**
 * Native/web adapters live here, and only here may Capacitor be imported. Everything has a web
 * fallback: the game always runs as a plain web page too.
 */
export type Platform = 'web' | 'ios' | 'android';

export const detectPlatform = (): Platform => {
  const name = Capacitor.getPlatform();
  return name === 'ios' || name === 'android' ? name : 'web';
};

export const isNative = (): boolean => Capacitor.isNativePlatform();
