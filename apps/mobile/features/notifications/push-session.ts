import type { PushPermission } from './push-lifecycle';

export type PushSessionDependencies = {
  getAuthenticatedUid(): string | null;
  initialize(): Promise<void>;
  onReady(uid: string): Promise<void>;
  enable(uid: string): Promise<PushPermission>;
  beforeSignOut(uid: string): Promise<void>;
  beforeAccountDeletion(uid: string): Promise<void>;
  onUnavailable(): Promise<void>;
};

/** Guards delayed native initialization against a sign-out or account replacement. */
export function createPushSessionController(dependencies: PushSessionDependencies) {
  let activeUid: string | null = null;
  let invalidatedUid: string | null = null;
  let generation = 0;

  const isCurrent = (uid: string, request: number) =>
    activeUid === uid && generation === request && dependencies.getAuthenticatedUid() === uid;
  const discardIfStillCurrent = (uid: string, request: number) => {
    if (activeUid === uid && generation === request) {
      activeUid = null;
      generation += 1;
    }
  };

  return {
    async onReady(uid: string): Promise<void> {
      const authenticatedUid = dependencies.getAuthenticatedUid();
      if (invalidatedUid === uid && authenticatedUid === uid) return;
      if (invalidatedUid && authenticatedUid !== invalidatedUid) invalidatedUid = null;
      if (authenticatedUid !== uid) return;
      activeUid = uid;
      const request = (generation += 1);
      try {
        await dependencies.initialize();
      } catch (error) {
        if (isCurrent(uid, request)) {
          activeUid = null;
          generation += 1;
        }
        throw error;
      }
      if (!isCurrent(uid, request)) {
        discardIfStillCurrent(uid, request);
        return;
      }
      await dependencies.onReady(uid);
    },

    async enable(uid: string): Promise<PushPermission> {
      const authenticatedUid = dependencies.getAuthenticatedUid();
      if (invalidatedUid === uid && authenticatedUid === uid) return 'denied';
      if (invalidatedUid && authenticatedUid !== invalidatedUid) invalidatedUid = null;
      if (authenticatedUid !== uid) {
        if (activeUid === uid) {
          activeUid = null;
          generation += 1;
        }
        return 'denied';
      }
      if (activeUid === null) activeUid = uid;
      if (activeUid !== uid) return 'denied';
      const request = generation;
      await dependencies.initialize();
      if (!isCurrent(uid, request)) {
        discardIfStillCurrent(uid, request);
        return 'denied';
      }
      return dependencies.enable(uid);
    },

    beforeSignOut(uid: string): Promise<void> {
      invalidatedUid = uid;
      if (activeUid === uid) {
        activeUid = null;
        generation += 1;
      }
      return dependencies.beforeSignOut(uid);
    },

    beforeAccountDeletion(uid: string): Promise<void> {
      invalidatedUid = uid;
      if (activeUid === uid) {
        activeUid = null;
        generation += 1;
      }
      return dependencies.beforeAccountDeletion(uid);
    },

    onUnavailable(): Promise<void> {
      if (invalidatedUid && dependencies.getAuthenticatedUid() !== invalidatedUid) {
        invalidatedUid = null;
      }
      activeUid = null;
      generation += 1;
      return dependencies.onUnavailable();
    },

    async resumeAfterCleanupFailure(uid: string): Promise<void> {
      if (dependencies.getAuthenticatedUid() !== uid) return;
      if (invalidatedUid === uid) invalidatedUid = null;
      activeUid = uid;
      const request = (generation += 1);
      await dependencies.initialize();
      if (isCurrent(uid, request)) await dependencies.onReady(uid);
    },

    getActiveUid(): string | null {
      return activeUid;
    },
  };
}
