import { createHash } from 'node:crypto';

type Permission = 'authorized' | 'provisional' | 'ephemeral' | 'denied' | 'not-determined';
type Message = { data?: Record<string, unknown> } | null;
type Ref = { path: string };
export type NotificationPendingStage = 'tokenRead' | 'hash' | 'oldHashLookup' | 'hashPersistence';
export type DeferredNotificationStage = {
  promise: Promise<void>;
  entered: Promise<void>;
  arrive(): void;
  release(): void;
};

export function createDeferredNotificationStage(): DeferredNotificationStage {
  let arrive!: () => void;
  let release!: () => void;
  let enteredOnce = false;
  const entered = new Promise<void>((resolve) => {
    arrive = () => {
      if (enteredOnce) return;
      enteredOnce = true;
      resolve();
    };
  });
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, entered, arrive, release };
}

const responseFor = (value: Permission) => {
  if (value === 'authorized') return { granted: true, status: 'granted' };
  if (value === 'provisional') return { granted: false, status: 'granted', ios: { status: 3 } };
  if (value === 'ephemeral') return { granted: false, status: 'granted', ios: { status: 4 } };
  if (value === 'denied') return { granted: false, status: 'denied' };
  return { granted: false, status: 'undetermined', ios: { status: 0 } };
};

/** External SDK/OS fakes; the adapter, token store, session, and lifecycle stay real. */
export function loadNotificationNativeHarness(platform: 'ios' | 'android' | 'web' = 'ios') {
  jest.resetModules();
  const storage = new Map<string, string>();
  const documents = new Map<string, unknown>();
  const firestoreCalls: Array<{ kind: string; path?: string; paths?: string[]; data?: unknown }> =
    [];
  const auth = { currentUser: { uid: 'alice' } as { uid: string } | null };
  let permission: Permission = 'not-determined';
  let requestedPermission: Permission = 'authorized';
  let token = 'fcm-token-1';
  let tokenError: Error | null = null;
  let initialNotification: Promise<Message> = Promise.resolve(null);
  let channelGate: Promise<unknown> | null = null;
  let removeItemGate: Promise<unknown> | null = null;
  const pendingStages = new Map<NotificationPendingStage, DeferredNotificationStage>();
  let deleteFailures = 0;
  let setFailures = 0;
  let batchFailures = 0;
  const setAttemptWaiters: Array<() => void> = [];
  const removeItemWaiters: Array<() => void> = [];
  const waitAtStage = async (stage: NotificationPendingStage) => {
    const gate = pendingStages.get(stage);
    if (!gate) return;
    gate.arrive();
    await gate.promise;
  };

  const asyncStorage = {
    getItem: jest.fn(async (key: string) => {
      if (key.startsWith('comradia.push.token-hash.')) await waitAtStage('oldHashLookup');
      return storage.get(key) ?? null;
    }),
    setItem: jest.fn(async (key: string, value: string) => {
      if (key.startsWith('comradia.push.token-hash.')) await waitAtStage('hashPersistence');
      storage.set(key, value);
    }),
    removeItem: jest.fn(async (key: string) => {
      removeItemWaiters.shift()?.();
      if (removeItemGate) await removeItemGate;
      storage.delete(key);
    }),
  };
  const expoNotifications = {
    getPermissionsAsync: jest.fn(async () => responseFor(permission)),
    requestPermissionsAsync: jest.fn(async () => {
      permission = requestedPermission;
      return responseFor(permission);
    }),
    setNotificationChannelAsync: jest.fn(async (..._args: unknown[]) => {
      if (channelGate) await channelGate;
    }),
  };
  const messageListeners: Array<(message: Message) => void> = [];
  const openedListeners: Array<(message: Message) => void> = [];
  const tokenRefreshListeners: Array<(value: string) => void> = [];
  const messagingClient = {
    getToken: jest.fn(async () => {
      await waitAtStage('tokenRead');
      if (tokenError) throw tokenError;
      return token;
    }),
    onMessage: jest.fn((listener: (message: Message) => void) => {
      messageListeners.push(listener);
      return jest.fn();
    }),
    onNotificationOpenedApp: jest.fn((listener: (message: Message) => void) => {
      openedListeners.push(listener);
      return jest.fn();
    }),
    getInitialNotification: jest.fn(() => initialNotification),
    onTokenRefresh: jest.fn((listener: (value: string) => void) => {
      tokenRefreshListeners.push(listener);
      return jest.fn();
    }),
  };
  const firestore = {
    getFirestore: jest.fn(() => ({})),
    collection: jest.fn((_db: unknown, ...parts: string[]) => ({ path: parts.join('/') })),
    doc: jest.fn((_db: unknown, ...parts: string[]) => ({ path: parts.join('/') })),
    serverTimestamp: jest.fn(() => ({ __serverTimestamp: true })),
    setDoc: jest.fn(async (ref: Ref, data: unknown) => {
      setAttemptWaiters.shift()?.();
      firestoreCalls.push({ kind: 'setDoc', path: ref.path, data });
      if (setFailures) {
        setFailures -= 1;
        throw new Error('injected Firestore set failure');
      }
      documents.set(ref.path, data);
    }),
    deleteDoc: jest.fn(async (ref: Ref) => {
      firestoreCalls.push({ kind: 'deleteDoc', path: ref.path });
      if (deleteFailures) {
        deleteFailures -= 1;
        throw new Error('injected Firestore delete failure');
      }
      documents.delete(ref.path);
    }),
    getDocs: jest.fn(async (ref: { path: string }) => ({
      docs: [...documents.keys()]
        .filter((path) => path.startsWith(`${ref.path}/`))
        .map((path) => ({ ref: { path } })),
    })),
    writeBatch: jest.fn(() => {
      const paths: string[] = [];
      return {
        delete: jest.fn((ref: Ref) => void paths.push(ref.path)),
        commit: jest.fn(async () => {
          firestoreCalls.push({ kind: 'batchCommit', paths: [...paths] });
          if (batchFailures) {
            batchFailures -= 1;
            throw new Error('injected Firestore batch failure');
          }
          paths.forEach((path) => documents.delete(path));
        }),
      };
    }),
  };
  const linking = { openSettings: jest.fn(async () => undefined) };

  jest.doMock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: asyncStorage,
  }));
  jest.doMock('@react-native-firebase/auth', () => ({ getAuth: jest.fn(() => auth) }));
  jest.doMock('@react-native-firebase/messaging', () => ({
    __esModule: true,
    default: jest.fn(() => messagingClient),
  }));
  jest.doMock('@react-native-firebase/firestore', () => firestore);
  jest.doMock('expo-crypto', () => ({
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    digestStringAsync: jest.fn(async (_algorithm: string, value: string) => {
      await waitAtStage('hash');
      return createHash('sha256').update(value).digest('hex');
    }),
  }));
  jest.doMock('expo-notifications', () => ({
    ...expoNotifications,
    AndroidImportance: { DEFAULT: 3 },
    IosAuthorizationStatus: { NOT_DETERMINED: 0, AUTHORIZED: 2, PROVISIONAL: 3, EPHEMERAL: 4 },
  }));
  jest.doMock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en-US' }] }));
  jest.doMock('react-native', () => {
    return { Linking: linking, Platform: { OS: platform } };
  });

  // setup.ts mocks the extensionless notification import for screens; Jest resolves
  // that same mock for this platform-specific path unless the real adapter is requested.
  const native = jest.requireActual(
    '@/features/notifications/notifications.native',
  ) as typeof import('@/features/notifications/notifications.native');
  const tokenStore = jest.requireActual(
    '@/features/notifications/push-token-store.native',
  ) as typeof import('@/features/notifications/push-token-store.native');
  return {
    native,
    hashPushToken: tokenStore.hashPushToken,
    registerPushToken: tokenStore.registerPushToken,
    auth,
    storage,
    linking,
    expoNotifications,
    messagingClient,
    messageListeners,
    openedListeners,
    tokenRefreshListeners,
    firestore: {
      calls: firestoreCalls,
      documents,
      seed(uid: string, hash: string) {
        documents.set(`users/${uid}/pushTokens/${hash}`, { token: `token-${hash}` });
      },
      failDeletes(count = 1) {
        deleteFailures = count;
      },
      failSets(count = 1) {
        setFailures = count;
      },
      waitForNextSetAttempt() {
        return new Promise<void>((resolve) => setAttemptWaiters.push(resolve));
      },
      waitForNextRemoveItem() {
        return new Promise<void>((resolve) => removeItemWaiters.push(resolve));
      },
      failBatches(count = 1) {
        batchFailures = count;
      },
    },
    setPermission(value: Permission) {
      permission = value;
    },
    setRequestedPermission(value: Permission) {
      requestedPermission = value;
    },
    setTokenError(value: Error | null) {
      tokenError = value;
    },
    setToken(value: string) {
      token = value;
    },
    setInitialNotification(value: Promise<Message>) {
      initialNotification = value;
    },
    setChannelGate(value: Promise<unknown> | null) {
      channelGate = value;
    },
    setPendingStage(stage: NotificationPendingStage, gate: DeferredNotificationStage | null) {
      if (gate) pendingStages.set(stage, gate);
      else pendingStages.delete(stage);
    },
    setRemoveItemGate(value: Promise<unknown> | null) {
      removeItemGate = value;
    },
  };
}

export async function flushNotificationMicrotasks(): Promise<void> {
  for (let index = 0; index < 16; index += 1) await Promise.resolve();
}
