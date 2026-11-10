import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const variant = process.env.APP_VARIANT === 'prod' ? 'prod' : 'dev';
  const isDev = variant === 'dev';

  return {
    ...config,
    name: isDev ? 'Comradia (Dev)' : 'Comradia',
    slug: 'comradia',
    scheme: 'comradia',
    ios: {
      ...config.ios,
      bundleIdentifier: isDev ? 'com.edufelip.comradia.dev' : 'com.edufelip.comradia',
    },
    android: {
      ...config.android,
      package: isDev ? 'com.edufelip.comradia.dev' : 'com.edufelip.comradia',
    },
    extra: {
      ...config.extra,
      appVariant: variant,
      server: {
        baseUrl: process.env.EXPO_PUBLIC_SERVER_URL?.trim() || 'http://localhost:3410',
      },
    },
  };
};
