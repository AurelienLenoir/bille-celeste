import type { CapacitorConfig } from '@capacitor/cli';

/** Native shells for iOS and Android around the web build (`npm run build` then `npx cap sync`). */
const config: CapacitorConfig = {
  appId: 'com.aurelienlenoir.billeceleste',
  appName: 'Bille Céleste',
  webDir: 'dist',
  backgroundColor: '#6fbcff',
  ios: { contentInset: 'never', scrollEnabled: false },
  android: { backgroundColor: '#6fbcff' },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#6fbcff',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
    },
  },
};

export default config;
