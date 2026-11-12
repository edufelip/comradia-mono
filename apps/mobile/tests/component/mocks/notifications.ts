export type MockPushEvent = {
  kind: 'foreground' | 'tap';
  data: Record<string, unknown>;
};

const listeners = new Set<(event: MockPushEvent) => void>();

export const notificationMockApi = {
  initializePushNotifications: jest.fn(() => Promise.resolve()),
  getNotificationSettings: jest.fn(() => Promise.resolve('disabled')),
  onNotificationSessionReady: jest.fn(() => Promise.resolve()),
  enableNotifications: jest.fn(() => Promise.resolve('authorized')),
  disableNotifications: jest.fn(() => Promise.resolve()),
  revokeNotificationsBeforeSignOut: jest.fn(() => Promise.resolve()),
  revokeNotificationsBeforeAccountDeletion: jest.fn(() => Promise.resolve()),
  resumeNotificationsAfterAccountDeletionFailure: jest.fn(() => Promise.resolve()),
  pauseNotificationSession: jest.fn(() => Promise.resolve()),
  refreshNotificationSession: jest.fn(() => Promise.resolve()),
  openNotificationSettings: jest.fn(() => Promise.resolve()),
  startPushTokenRefreshListener: jest.fn(() => () => {}),
  subscribeToPushEvents: jest.fn((listener: (event: MockPushEvent) => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }),
  emitPushEvent(event: MockPushEvent) {
    listeners.forEach((listener) => listener(event));
  },
  resetPushEvents() {
    listeners.clear();
  },
};
