import type { ExpoConfig } from 'expo/config';

// Faz 0: runnable skeleton only. No EAS / store configuration until Faz 10.
const config: ExpoConfig = {
  name: 'BingeTrail',
  slug: 'bingetrail',
  scheme: 'bingetrail',
  version: '0.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'dark',
  plugins: ['expo-router'],
  experiments: {
    typedRoutes: true,
  },
};

export default config;
