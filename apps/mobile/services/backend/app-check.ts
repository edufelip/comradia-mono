import type { ReactNativeFirebaseAppCheckProvider } from '@react-native-firebase/app-check';

type ProviderOptions = Parameters<ReactNativeFirebaseAppCheckProvider['configure']>[0];

/** Dev builds pass a debug token (registered in the Firebase console); store builds use real attestation. */
export function appCheckProviderOptions(
  debugToken: string | undefined,
  variant: unknown,
): ProviderOptions {
  const token = debugToken?.trim();
  if (variant === 'dev' && token) {
    return {
      android: { provider: 'debug', debugToken: token },
      apple: { provider: 'debug', debugToken: token },
    };
  }
  return {
    android: { provider: 'playIntegrity' },
    apple: { provider: 'appAttestWithDeviceCheckFallback' },
  };
}
