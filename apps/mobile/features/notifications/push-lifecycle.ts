export type PushPermission = 'authorized' | 'provisional' | 'denied' | 'not-determined';

export type PushLifecycleDependencies = {
  getPermission(): Promise<PushPermission>;
  requestPermission(): Promise<PushPermission>;
  getToken(): Promise<string>;
  hashToken(token: string): Promise<string>;
  isEnabled(uid: string): Promise<boolean>;
  setEnabled(uid: string, enabled: boolean): Promise<void>;
  getStoredTokenHash(uid: string): Promise<string | null>;
  setStoredTokenHash(uid: string, hash: string | null): Promise<void>;
  registerToken(uid: string, token: string, hash: string): Promise<void>;
  revokeToken(uid: string, hash: string): Promise<void>;
  revokeAllTokens(uid: string): Promise<void>;
};

const canNotify = (permission: PushPermission) =>
  permission === 'authorized' || permission === 'provisional';

/**
 * Serializes registration and revocation across account changes. The stored value is a hash,
 * not the raw FCM token; it lets sign-out remove the server registration after a process restart.
 */
export function createPushLifecycle(dependencies: PushLifecycleDependencies) {
  let owner: string | null = null;
  let generation = 0;
  let queue: Promise<void> = Promise.resolve();

  const enqueue = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = queue.then(operation);
    queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };

  const isCurrent = (uid: string, request: number) => owner === uid && generation === request;

  const revokeStoredToken = async (uid: string) => {
    const hash = await dependencies.getStoredTokenHash(uid);
    if (!hash) return;
    await dependencies.revokeToken(uid, hash);
    await dependencies.setStoredTokenHash(uid, null);
  };

  const register = async (uid: string, request: number, suppliedToken?: string) => {
    const token = suppliedToken ?? (await dependencies.getToken());
    if (!isCurrent(uid, request)) return;

    const hash = await dependencies.hashToken(token);
    if (!isCurrent(uid, request)) return;

    const previousHash = await dependencies.getStoredTokenHash(uid);
    if (!isCurrent(uid, request)) return;
    if (previousHash && previousHash !== hash) {
      await dependencies.revokeToken(uid, previousHash);
      await dependencies.setStoredTokenHash(uid, null);
      if (!isCurrent(uid, request)) return;
    }

    // Keep the hash before writing remotely. A timed-out write may have reached Firestore;
    // sign-out can still revoke it instead of leaving an orphaned device registration.
    await dependencies.setStoredTokenHash(uid, hash);
    if (!isCurrent(uid, request)) return;
    await dependencies.registerToken(uid, token, hash);
  };

  const syncIfEnabled = async (uid: string, request: number) => {
    if (!isCurrent(uid, request)) return;
    const enabled = await dependencies.isEnabled(uid);
    if (!isCurrent(uid, request)) return;
    if (!enabled) {
      await revokeStoredToken(uid);
      return;
    }
    const permission = await dependencies.getPermission();
    if (!isCurrent(uid, request)) return;
    if (!canNotify(permission)) {
      await revokeStoredToken(uid);
      return;
    }
    if (!isCurrent(uid, request)) return;
    await register(uid, request);
  };

  return {
    /** Called only after Firebase auth and the signed-in profile are ready. */
    onReady(uid: string): Promise<void> {
      const previousOwner = owner;
      owner = uid;
      const request = (generation += 1);
      return enqueue(async () => {
        if (previousOwner && previousOwner !== uid) await revokeStoredToken(previousOwner);
        if (!isCurrent(uid, request)) return;
        await syncIfEnabled(uid, request);
      });
    },

    /** Permission is requested only from an explicit user action in Profile settings. */
    enable(uid: string): Promise<PushPermission> {
      owner = uid;
      const request = (generation += 1);
      return enqueue(async () => {
        if (!isCurrent(uid, request)) return 'denied';
        const permission = await dependencies.requestPermission();
        if (!isCurrent(uid, request)) return permission;
        const enabled = canNotify(permission);
        await dependencies.setEnabled(uid, enabled);
        if (enabled && isCurrent(uid, request)) await register(uid, request);
        return permission;
      });
    },

    /** FCM rotation events never prompt; stale owner events are ignored. */
    onTokenRefresh(uid: string, token: string): Promise<void> {
      const request = generation;
      return enqueue(async () => {
        if (!isCurrent(uid, request)) return;
        const enabled = await dependencies.isEnabled(uid);
        if (!isCurrent(uid, request)) return;
        if (!enabled) {
          await revokeStoredToken(uid);
          return;
        }
        const permission = await dependencies.getPermission();
        if (!isCurrent(uid, request)) return;
        if (!canNotify(permission)) {
          await revokeStoredToken(uid);
          return;
        }
        await register(uid, request, token);
      });
    },

    /** Must resolve before Firebase signOut is called. A failed deletion blocks sign-out. */
    beforeSignOut(uid: string): Promise<void> {
      owner = null;
      generation += 1;
      return enqueue(() => revokeStoredToken(uid));
    },

    /** Called before any other account cleanup; a failure blocks account deletion. */
    beforeAccountDeletion(uid: string): Promise<void> {
      owner = null;
      generation += 1;
      return enqueue(async () => {
        await dependencies.revokeAllTokens(uid);
        await dependencies.setStoredTokenHash(uid, null);
        await dependencies.setEnabled(uid, false);
      });
    },

    /** Invalidates in-flight registrations when the app no longer has a ready session. */
    onUnavailable(): Promise<void> {
      owner = null;
      generation += 1;
      return enqueue(async () => {});
    },

    /** Opt-out revokes this device's token and prevents refresh listeners from restoring it. */
    disable(uid: string): Promise<void> {
      if (owner === uid) generation += 1;
      const request = generation;
      return enqueue(async () => {
        await dependencies.setEnabled(uid, false);
        if (owner === uid && generation !== request) return;
        await revokeStoredToken(uid);
      });
    },
  };
}
