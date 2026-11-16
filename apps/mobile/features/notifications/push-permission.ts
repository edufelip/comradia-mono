import type { PushPermission } from './push-lifecycle';

// Mirrors expo-notifications' IosAuthorizationStatus enum (build/NotificationPermissions.types.d.ts).
const IOS = { NOT_DETERMINED: 0, DENIED: 1, AUTHORIZED: 2, PROVISIONAL: 3, EPHEMERAL: 4 } as const;

export function pushPermissionFrom(response: {
  granted: boolean;
  status: string;
  canAskAgain: boolean;
  ios?: { status?: number } | undefined;
}): PushPermission {
  const iosStatus = response.ios?.status;
  if (response.granted || iosStatus === IOS.AUTHORIZED) return 'authorized';
  if (iosStatus === IOS.PROVISIONAL || iosStatus === IOS.EPHEMERAL) return 'provisional';
  if (response.status === 'undetermined' || iosStatus === IOS.NOT_DETERMINED) {
    return 'not-determined';
  }
  // Android 13+ reports a never-asked permission as 'denied' with canAskAgain true; the system prompt can still show.
  if (iosStatus === undefined && response.status === 'denied' && response.canAskAgain) {
    return 'not-determined';
  }
  return 'denied';
}
