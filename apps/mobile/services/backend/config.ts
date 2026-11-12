/** Demo project id: the emulators accept it without any cloud project or keys. */
export const DEMO_PROJECT_ID = 'demo-comradia';
export const AUTH_EMULATOR_PORT = 9099;
export const FIRESTORE_EMULATOR_PORT = 8089;
export const STORAGE_EMULATOR_PORT = 9199;

/** Set EXPO_PUBLIC_FIREBASE_EMULATOR_HOST (127.0.0.1, or 10.0.2.2 on Android) to use the emulators. */
// Expo only inlines `process.env.EXPO_PUBLIC_*` when read as a literal member expression.
export function emulatorHost(
  raw: string | undefined = process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST,
): string | null {
  const host = raw?.trim();
  return host ? host : null;
}

export const DISCOVERY_PAGE_SIZE = 50;
