import { existsSync } from 'node:fs';
import { join } from 'node:path';

import type { ConfigContext, ExpoConfig } from 'expo/config';

// Firebase native config files, one pair per Firebase project (docs/architecture.md, "Environments").
// They hold public client ids, not secrets; security comes from Auth and Firestore rules.
function firebaseFiles(variant: 'dev' | 'prod') {
  const dir = join(__dirname, 'firebase', variant);
  const ios = join(dir, 'GoogleService-Info.plist');
  const android = join(dir, 'google-services.json');
  return {
    ios: existsSync(ios) ? `./firebase/${variant}/GoogleService-Info.plist` : undefined,
    android: existsSync(android) ? `./firebase/${variant}/google-services.json` : undefined,
  };
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const variant = process.env.APP_VARIANT === 'prod' ? 'prod' : 'dev';
  const isDev = variant === 'dev';
  const files = firebaseFiles(variant);

  return {
    ...config,
    name: isDev ? 'Comradia (Dev)' : 'Comradia',
    slug: 'comradia',
    scheme: 'comradia',
    ios: {
      ...config.ios,
      bundleIdentifier: isDev ? 'com.edufelip.comradia.dev' : 'com.edufelip.comradia',
      usesAppleSignIn: true,
      googleServicesFile: files.ios,
      entitlements: {
        ...config.ios?.entitlements,
        'aps-environment': isDev ? 'development' : 'production',
        // App Attest for App Check on iOS (the RNFB App Check plugin does not add it).
        'com.apple.developer.devicecheck.appattest-environment': isDev
          ? 'development'
          : 'production',
      },
      infoPlist: {
        ...config.ios?.infoPlist,
        UIBackgroundModes: [
          ...new Set([
            ...((config.ios?.infoPlist?.UIBackgroundModes as string[] | undefined) ?? []),
            'remote-notification',
          ]),
        ],
      },
    },
    android: {
      ...config.android,
      package: isDev ? 'com.edufelip.comradia.dev' : 'com.edufelip.comradia',
      googleServicesFile: files.android,
    },
    plugins: [
      ...(config.plugins ?? []),
      '@react-native-firebase/app',
      '@react-native-firebase/auth',
      '@react-native-firebase/app-check',
      '@react-native-firebase/messaging',
      // Adds the Crashlytics Gradle plugin; without it the Android app crashes at startup
      // ("The Crashlytics build ID is missing") because the package is linked natively.
      '@react-native-firebase/crashlytics',
      'expo-notifications',
      // Photo library only: the camera and microphone keys and Android permissions stay out.
      [
        'expo-image-picker',
        {
          photosPermission: 'Comradia opens your photo library so you can pick a profile photo.',
          cameraPermission: false,
          microphonePermission: false,
        },
      ],
      // Reads the iOS URL scheme from GoogleService-Info.plist.
      '@react-native-google-signin/google-signin',
      // @react-native-firebase needs static frameworks on iOS. Its pods import React-Core
      // headers non-modularly, which Xcode 16+ rejects when they are built as frameworks
      // (expo/expo#39607), so they stay plain static libraries.
      [
        'expo-build-properties',
        {
          ios: {
            useFrameworks: 'static',
            forceStaticLinking: [
              'RNFBApp',
              'RNFBAuth',
              'RNFBMessaging',
              'RNFBCrashlytics',
              'RNFBFirestore',
              'RNFBStorage',
              'RNFBAppCheck',
            ],
          },
        },
      ],
    ],
    extra: {
      ...config.extra,
      appVariant: variant,
      // Resolve only in native build configuration, never inline this token into production JS.
      appCheckDebugToken: isDev ? process.env.EXPO_PUBLIC_APP_CHECK_DEBUG_TOKEN : undefined,
    },
  };
};
