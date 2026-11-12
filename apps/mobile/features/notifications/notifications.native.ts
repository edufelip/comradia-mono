import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuth } from '@react-native-firebase/auth';
import messaging, { type FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';

import { getDeviceLocale, resolveLocale, t } from '@/localization';

import { createPushLifecycle, type PushPermission } from './push-lifecycle';
import { createPushSessionController } from './push-session';
import {
  hashPushToken,
  registerPushToken,
  revokeAllPushTokens,
  revokePushToken,
} from './push-token-store.native';
import type { NotificationSettingsStatus } from './NotificationSettings';

const CHANNEL_ID = 'matches-messages';
const PUSH_ENABLED_PREFIX = 'comradia.push.enabled.';
const PUSH_TOKEN_HASH_PREFIX = 'comradia.push.token-hash.';

const storageKey = (prefix: string, uid: string) => `${prefix}${encodeURIComponent(uid)}`;

let lastErrorUid: string | null = null;
let initialization: Promise<void> | null = null;

function getStoredValue(prefix: string, uid: string) {
  return AsyncStorage.getItem(storageKey(prefix, uid));
}

function permissionFromResponse(
  response: Notifications.NotificationPermissionsStatus,
): PushPermission {
  const iosStatus = response.ios?.status;
  if (response.granted || iosStatus === Notifications.IosAuthorizationStatus.AUTHORIZED) {
    return 'authorized';
  }
  if (
    iosStatus === Notifications.IosAuthorizationStatus.PROVISIONAL ||
    iosStatus === Notifications.IosAuthorizationStatus.EPHEMERAL
  ) {
    return 'provisional';
  }
  if (
    response.status === 'undetermined' ||
    iosStatus === Notifications.IosAuthorizationStatus.NOT_DETERMINED
  ) {
    return 'not-determined';
  }
  return 'denied';
}

async function getPermission(): Promise<PushPermission> {
  return permissionFromResponse(await Notifications.getPermissionsAsync());
}

async function ensureAndroidNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const locale = resolveLocale(getDeviceLocale());
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: t(locale, 'notifications.channel_name'),
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

const lifecycle = createPushLifecycle({
  getPermission,
  async requestPermission() {
    await ensureAndroidNotificationChannel();
    const existing = await getPermission();
    if (existing === 'authorized' || existing === 'provisional') return existing;
    return permissionFromResponse(await Notifications.requestPermissionsAsync());
  },
  getToken: () => messaging().getToken(),
  hashToken: hashPushToken,
  async isEnabled(uid) {
    return (await getStoredValue(PUSH_ENABLED_PREFIX, uid)) === 'true';
  },
  async setEnabled(uid, enabled) {
    const key = storageKey(PUSH_ENABLED_PREFIX, uid);
    if (enabled) await AsyncStorage.setItem(key, 'true');
    else await AsyncStorage.removeItem(key);
  },
  getStoredTokenHash: (uid) => getStoredValue(PUSH_TOKEN_HASH_PREFIX, uid),
  async setStoredTokenHash(uid, hash) {
    const key = storageKey(PUSH_TOKEN_HASH_PREFIX, uid);
    if (hash) await AsyncStorage.setItem(key, hash);
    else await AsyncStorage.removeItem(key);
  },
  registerToken: registerPushToken,
  revokeToken: revokePushToken,
  revokeAllTokens: revokeAllPushTokens,
});

export async function initializePushNotifications(): Promise<void> {
  if (!initialization) {
    initialization = (async () => {
      await ensureAndroidNotificationChannel();
    })().catch((error: unknown) => {
      initialization = null;
      throw error;
    });
  }
  await initialization;
}

const sessionController = createPushSessionController({
  getAuthenticatedUid: () => getAuth().currentUser?.uid ?? null,
  initialize: initializePushNotifications,
  onReady: (uid) => lifecycle.onReady(uid),
  enable: (uid) => lifecycle.enable(uid),
  beforeSignOut: (uid) => lifecycle.beforeSignOut(uid),
  beforeAccountDeletion: (uid) => lifecycle.beforeAccountDeletion(uid),
  onUnavailable: () => lifecycle.onUnavailable(),
});

export async function getNotificationSettings(uid: string): Promise<NotificationSettingsStatus> {
  if (lastErrorUid === uid) return 'error';
  const [permission, enabled] = await Promise.all([
    getPermission(),
    getStoredValue(PUSH_ENABLED_PREFIX, uid).then((value) => value === 'true'),
  ]);
  if (permission === 'denied') return 'denied';
  return enabled && (permission === 'authorized' || permission === 'provisional')
    ? 'enabled'
    : 'disabled';
}

export async function onNotificationSessionReady(uid: string): Promise<void> {
  try {
    await sessionController.onReady(uid);
    lastErrorUid = null;
  } catch (error) {
    lastErrorUid = uid;
    throw error;
  }
}

export async function enableNotifications(uid: string): Promise<PushPermission> {
  try {
    const permission = await sessionController.enable(uid);
    lastErrorUid = null;
    return permission;
  } catch (error) {
    lastErrorUid = uid;
    throw error;
  }
}

export async function disableNotifications(uid: string): Promise<void> {
  try {
    await lifecycle.disable(uid);
    lastErrorUid = null;
  } catch (error) {
    lastErrorUid = uid;
    throw error;
  }
}

/** Must finish before Firebase Auth signOut; errors intentionally block sign-out. */
export async function revokeNotificationsBeforeSignOut(uid: string): Promise<void> {
  try {
    await sessionController.beforeSignOut(uid);
    lastErrorUid = null;
  } catch (error) {
    lastErrorUid = uid;
    await sessionController.resumeAfterCleanupFailure(uid).catch(() => undefined);
    throw error;
  }
}

/** Must finish before profile/account cleanup; deletes every token owned by this account. */
export async function revokeNotificationsBeforeAccountDeletion(uid: string): Promise<void> {
  try {
    await sessionController.beforeAccountDeletion(uid);
    lastErrorUid = null;
  } catch (error) {
    lastErrorUid = uid;
    await sessionController.resumeAfterCleanupFailure(uid).catch(() => undefined);
    throw error;
  }
}

/** Restores session syncing if later account cleanup fails after token deletion succeeded. */
export async function resumeNotificationsAfterAccountDeletionFailure(uid: string): Promise<void> {
  try {
    await sessionController.resumeAfterCleanupFailure(uid);
    lastErrorUid = null;
  } catch (error) {
    lastErrorUid = uid;
    throw error;
  }
}

/** Invalidates pending registration while auth/profile is not in the ready state. */
export async function pauseNotificationSession(): Promise<void> {
  await sessionController.onUnavailable();
}

/** Rechecks permission and token state when the user returns from system settings. */
export async function refreshNotificationSession(uid: string): Promise<void> {
  await onNotificationSessionReady(uid);
}

export function openNotificationSettings(): Promise<void> {
  return Linking.openSettings();
}

export type PushEvent = {
  kind: 'foreground' | 'tap';
  data: Record<string, unknown>;
};

function eventData(message: FirebaseMessagingTypes.RemoteMessage): Record<string, unknown> {
  return message.data ?? {};
}

/** RNFirebase owns foreground and tap events; Expo Notifications is used only for OS settings. */
export function subscribeToPushEvents(listener: (event: PushEvent) => void): () => void {
  let active = true;
  const stopForeground = messaging().onMessage((message) => {
    if (active) listener({ kind: 'foreground', data: eventData(message) });
  });
  const stopOpened = messaging().onNotificationOpenedApp((message) => {
    if (active) listener({ kind: 'tap', data: eventData(message) });
  });
  void messaging()
    .getInitialNotification()
    .then((message) => {
      if (active && message) listener({ kind: 'tap', data: eventData(message) });
    })
    .catch(() => undefined);

  return () => {
    active = false;
    stopForeground();
    stopOpened();
  };
}

/** Token refreshes never prompt and are ignored until a ready account owns the device. */
export function startPushTokenRefreshListener(): () => void {
  return messaging().onTokenRefresh((token) => {
    const uid = sessionController.getActiveUid();
    if (!uid) return;
    void lifecycle.onTokenRefresh(uid, token).then(
      () => {
        lastErrorUid = null;
      },
      () => {
        lastErrorUid = uid;
      },
    );
  });
}
