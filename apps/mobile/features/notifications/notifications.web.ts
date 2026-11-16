import type { NotificationSettingsStatus } from './NotificationSettings';
import type { PushPermission } from './push-lifecycle';

export type PushEvent = {
  kind: 'foreground' | 'tap';
  data: Record<string, unknown>;
};

export async function initializePushNotifications(): Promise<void> {}

export async function getNotificationSettings(_uid: string): Promise<NotificationSettingsStatus> {
  return 'unavailable';
}

export async function onNotificationSessionReady(_uid: string): Promise<void> {}

export async function enableNotifications(_uid: string): Promise<PushPermission> {
  return 'not-determined';
}

export async function disableNotifications(_uid: string): Promise<void> {}

export async function revokeNotificationsBeforeSignOut(_uid: string): Promise<void> {}

export async function revokeNotificationsBeforeAccountDeletion(_uid: string): Promise<void> {}

export async function resumeNotificationsAfterAccountDeletionFailure(_uid: string): Promise<void> {}

export async function pauseNotificationSession(): Promise<void> {}

export async function refreshNotificationSession(_uid: string): Promise<void> {}

export async function openNotificationSettings(): Promise<void> {}

export function subscribeToPushEvents(_listener: (event: PushEvent) => void): () => void {
  return () => {};
}

export function startPushTokenRefreshListener(): () => void {
  return () => {};
}
