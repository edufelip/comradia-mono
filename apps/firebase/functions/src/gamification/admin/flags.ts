// Flags and experiment arms live in Firebase Remote Config (owner decision, 25 Nov 2026);
// Firestore only carries the active rule-set pointer. This is a read-only mirror for the
// admin UI. There is no Remote Config emulator, so failures return `available: false`
// with the console link instead of breaking the screen.
import type { App } from 'firebase-admin/app';
import { getRemoteConfig } from 'firebase-admin/remote-config';

export type GamFlag = { key: string; value: string | null };

export type GamFlagsResult =
  | { available: true; flags: GamFlag[] }
  | { available: false; note: string };

export async function gamFlags(app: App): Promise<GamFlagsResult> {
  try {
    const template = await getRemoteConfig(app).getTemplate();
    const flags: GamFlag[] = Object.entries(template.parameters)
      .filter(([key]) => key.startsWith('gam_'))
      .map(([key, parameter]) => {
        const defaultValue = parameter.defaultValue;
        const value = defaultValue !== undefined && 'value' in defaultValue
          && typeof defaultValue.value === 'string'
          ? defaultValue.value
          : null;
        return { key, value };
      });
    return { available: true, flags: flags.sort((a, b) => a.key.localeCompare(b.key)) };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    return {
      available: false,
      note: `Remote Config is unreachable from here (${message}). Open the Firebase console to read the gam_* flags.`,
    };
  }
}
