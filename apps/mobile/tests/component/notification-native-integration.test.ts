import {
  createDeferredNotificationStage,
  flushNotificationMicrotasks,
  loadNotificationNativeHarness,
  type NotificationPendingStage,
} from './fixtures/notification-native';

const enabledKey = 'comradia.push.enabled.alice';
const tokenHashKey = 'comradia.push.token-hash.alice';
type SessionInvalidationAction = 'sign-out' | 'pause';
const registrationStages: Array<[string, NotificationPendingStage]> = [
  ['FCM token read', 'tokenRead'],
  ['token hash', 'hash'],
  ['old token hash lookup', 'oldHashLookup'],
  ['local token hash persistence', 'hashPersistence'],
];
const registrationRaceCases: Array<[SessionInvalidationAction, string, NotificationPendingStage]> =
  (['sign-out', 'pause'] as const).flatMap((action) =>
    registrationStages.map(
      ([label, stage]): [SessionInvalidationAction, string, NotificationPendingStage] => [
        action,
        label,
        stage,
      ],
    ),
  );

describe('native push adapter integration', () => {
  it('restores a ready session without prompting or registering an opted-out device', async () => {
    const harness = loadNotificationNativeHarness();

    await harness.native.onNotificationSessionReady('alice');
    expect(harness.expoNotifications.getPermissionsAsync).not.toHaveBeenCalled();
    expect(harness.messagingClient.onMessage).toHaveBeenCalledTimes(0);
    expect(harness.expoNotifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(harness.messagingClient.getToken).not.toHaveBeenCalled();
    expect(harness.firestore.documents.size).toBe(0);
    await expect(harness.native.getNotificationSettings('alice')).resolves.toBe('disabled');
  });

  it('writes the real hashed-token document only after an explicit permission grant', async () => {
    const harness = loadNotificationNativeHarness();

    await expect(harness.native.enableNotifications('alice')).resolves.toBe('authorized');

    const hash = await harness.hashPushToken('fcm-token-1');
    const document = harness.firestore.documents.get(`users/alice/pushTokens/${hash}`) as Record<
      string,
      unknown
    >;
    expect(harness.expoNotifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(harness.messagingClient.getToken).toHaveBeenCalledTimes(1);
    expect(harness.storage.get(enabledKey)).toBe('true');
    expect(harness.storage.get(tokenHashKey)).toBe(hash);
    expect(Object.keys(document).sort()).toEqual(['locale', 'platform', 'token', 'updatedAt']);
    expect(document).toEqual({
      token: 'fcm-token-1',
      platform: 'ios',
      locale: 'en-US',
      updatedAt: { __serverTimestamp: true },
    });
    await expect(harness.native.getNotificationSettings('alice')).resolves.toBe('enabled');
  });

  it('does not register when permission is denied', async () => {
    const harness = loadNotificationNativeHarness('android');
    harness.setRequestedPermission('denied');

    await expect(harness.native.enableNotifications('alice')).resolves.toBe('denied');

    expect(harness.expoNotifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(harness.messagingClient.getToken).not.toHaveBeenCalled();
    expect(harness.storage.has(enabledKey)).toBe(false);
    expect(harness.firestore.documents.size).toBe(0);
    await expect(harness.native.getNotificationSettings('alice')).resolves.toBe('denied');
    expect(harness.expoNotifications.setNotificationChannelAsync).toHaveBeenCalledWith(
      'matches-messages',
      {
        name: 'Matches and messages',
        importance: 3,
      },
    );
  });

  it('treats iOS provisional and ephemeral grants as enabled registrations without another prompt', async () => {
    for (const grant of ['provisional', 'ephemeral'] as const) {
      const harness = loadNotificationNativeHarness('ios');
      harness.setRequestedPermission(grant);

      await expect(harness.native.enableNotifications('alice')).resolves.toBe('provisional');

      await expect(harness.native.getNotificationSettings('alice')).resolves.toBe('enabled');
      expect(harness.expoNotifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
      expect(harness.firestore.documents.size).toBe(1);
      expect([...harness.firestore.documents.values()][0]).toMatchObject({ platform: 'ios' });
    }
  });

  it('keeps settings in an error state when FCM cannot provide a token', async () => {
    const harness = loadNotificationNativeHarness();
    harness.setTokenError(new Error('FCM token unavailable'));

    await expect(harness.native.enableNotifications('alice')).rejects.toThrow(
      'FCM token unavailable',
    );

    expect(harness.storage.get(enabledKey)).toBe('true');
    expect(harness.firestore.documents.size).toBe(0);
    await expect(harness.native.getNotificationSettings('alice')).resolves.toBe('error');
  });

  it('revokes the prior hashed document before saving a refreshed token', async () => {
    const harness = loadNotificationNativeHarness();
    await harness.native.enableNotifications('alice');
    const oldHash = harness.storage.get(tokenHashKey);
    const start = harness.firestore.calls.length;
    const stop = harness.native.startPushTokenRefreshListener();

    harness.tokenRefreshListeners[0]('fcm-token-rotated');
    await flushNotificationMicrotasks();
    stop();

    const refreshedHash = await harness.hashPushToken('fcm-token-rotated');
    const calls = harness.firestore.calls.slice(start);
    const oldDelete = calls.findIndex(
      (call) => call.kind === 'deleteDoc' && call.path === `users/alice/pushTokens/${oldHash}`,
    );
    const newWrite = calls.findIndex(
      (call) => call.kind === 'setDoc' && call.path === `users/alice/pushTokens/${refreshedHash}`,
    );
    expect(oldDelete).toBeGreaterThanOrEqual(0);
    expect(newWrite).toBeGreaterThan(oldDelete);
    expect(harness.storage.get(tokenHashKey)).toBe(refreshedHash);
    expect(harness.firestore.documents.has(`users/alice/pushTokens/${oldHash}`)).toBe(false);
    expect(
      harness.firestore.documents.get(`users/alice/pushTokens/${refreshedHash}`),
    ).toMatchObject({
      token: 'fcm-token-rotated',
      platform: 'ios',
    });
    expect(harness.expoNotifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('does not restore a token after opt-out when Firebase refreshes the token', async () => {
    const harness = loadNotificationNativeHarness();
    await harness.native.enableNotifications('alice');
    const stop = harness.native.startPushTokenRefreshListener();
    const priorWrites = harness.firestore.calls.filter((call) => call.kind === 'setDoc').length;

    await harness.native.disableNotifications('alice');
    harness.tokenRefreshListeners[0]('fcm-token-after-opt-out');
    await flushNotificationMicrotasks();
    stop();

    expect(harness.storage.has(enabledKey)).toBe(false);
    expect(harness.storage.has(tokenHashKey)).toBe(false);
    expect(harness.firestore.documents.size).toBe(0);
    expect(harness.firestore.calls.filter((call) => call.kind === 'setDoc')).toHaveLength(
      priorWrites,
    );
    expect(harness.expoNotifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('revokes the saved token when OS permission is denied during token refresh', async () => {
    const harness = loadNotificationNativeHarness();
    await harness.native.enableNotifications('alice');
    const stop = harness.native.startPushTokenRefreshListener();
    harness.setPermission('denied');

    harness.tokenRefreshListeners[0]('fcm-token-rotated-while-denied');
    await flushNotificationMicrotasks();
    stop();

    expect(harness.firestore.documents.size).toBe(0);
    expect(harness.storage.has(tokenHashKey)).toBe(false);
    await expect(harness.native.getNotificationSettings('alice')).resolves.toBe('denied');
    expect(harness.expoNotifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('keeps opt-out state after a failed revoke and permits an explicit cleanup retry', async () => {
    const harness = loadNotificationNativeHarness();
    await harness.native.enableNotifications('alice');
    harness.firestore.failDeletes();

    await expect(harness.native.disableNotifications('alice')).rejects.toThrow(
      'injected Firestore delete failure',
    );
    expect(harness.storage.has(enabledKey)).toBe(false);
    expect(harness.firestore.documents.size).toBe(1);
    await expect(harness.native.getNotificationSettings('alice')).resolves.toBe('error');

    await harness.native.disableNotifications('alice');

    expect(harness.storage.has(tokenHashKey)).toBe(false);
    expect(harness.firestore.documents.size).toBe(0);
    await expect(harness.native.getNotificationSettings('alice')).resolves.toBe('disabled');
  });

  it('finishes revocation when a same-account ready refresh races with opt-out', async () => {
    const harness = loadNotificationNativeHarness();
    await harness.native.enableNotifications('alice');
    let finishRemoval!: () => void;
    harness.setRemoveItemGate(
      new Promise<void>((resolve) => {
        finishRemoval = resolve;
      }),
    );
    const removalStarted = harness.firestore.waitForNextRemoveItem();

    const disabling = harness.native.disableNotifications('alice');
    await removalStarted;
    const ready = harness.native.onNotificationSessionReady('alice');
    finishRemoval();
    await Promise.all([disabling, ready]);

    expect(harness.storage.has(enabledKey)).toBe(false);
    expect(harness.storage.has(tokenHashKey)).toBe(false);
    expect(harness.firestore.documents.size).toBe(0);
  });

  it('reflects OS permission changes and opens the native notification settings', async () => {
    const harness = loadNotificationNativeHarness();
    await harness.native.enableNotifications('alice');

    harness.setPermission('denied');
    await expect(harness.native.getNotificationSettings('alice')).resolves.toBe('denied');
    await expect(harness.native.openNotificationSettings()).resolves.toBeUndefined();
    expect(harness.linking.openSettings).toHaveBeenCalledTimes(1);
    expect(harness.expoNotifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);

    harness.setPermission('authorized');
    await harness.native.refreshNotificationSession('alice');
    await expect(harness.native.getNotificationSettings('alice')).resolves.toBe('enabled');
  });

  it('revokes the registration before sign-out and ignores refresh after the session pauses', async () => {
    const harness = loadNotificationNativeHarness();
    await harness.native.enableNotifications('alice');
    const hash = harness.storage.get(tokenHashKey);
    const stop = harness.native.startPushTokenRefreshListener();

    await harness.native.revokeNotificationsBeforeSignOut('alice');
    harness.auth.currentUser = null;
    await harness.native.pauseNotificationSession();
    harness.tokenRefreshListeners[0]('late-token');
    await flushNotificationMicrotasks();
    stop();

    expect(harness.firestore.documents.has(`users/alice/pushTokens/${hash}`)).toBe(false);
    expect(harness.storage.has(tokenHashKey)).toBe(false);
    expect(harness.storage.has(enabledKey)).toBe(true);
    expect(
      harness.firestore.documents.has(
        `users/alice/pushTokens/${await harness.hashPushToken('late-token')}`,
      ),
    ).toBe(false);
  });

  it('resumes the session after revocation failure so a later refresh can retry registration', async () => {
    const harness = loadNotificationNativeHarness();
    await harness.native.enableNotifications('alice');
    harness.firestore.failDeletes();
    const stop = harness.native.startPushTokenRefreshListener();

    await expect(harness.native.revokeNotificationsBeforeSignOut('alice')).rejects.toThrow(
      'injected Firestore delete failure',
    );
    await expect(harness.native.getNotificationSettings('alice')).resolves.toBe('error');
    harness.tokenRefreshListeners[0]('fcm-token-after-failure');
    await flushNotificationMicrotasks();
    stop();

    const hash = await harness.hashPushToken('fcm-token-after-failure');
    expect(harness.firestore.documents.get(`users/alice/pushTokens/${hash}`)).toMatchObject({
      token: 'fcm-token-after-failure',
    });
    expect(harness.storage.get(tokenHashKey)).toBe(hash);
  });

  it('deletes every account token through bounded Firestore batches', async () => {
    const harness = loadNotificationNativeHarness();
    for (let index = 0; index < 451; index += 1)
      harness.firestore.seed('alice', index.toString(16).padStart(64, '0'));
    harness.storage.set(enabledKey, 'true');
    harness.storage.set(tokenHashKey, '0'.repeat(64));

    await harness.native.revokeNotificationsBeforeAccountDeletion('alice');

    expect(
      harness.firestore.calls
        .filter((call) => call.kind === 'batchCommit')
        .map((call) => call.paths?.length),
    ).toEqual([450, 1]);
    expect(harness.firestore.documents.size).toBe(0);
    expect(harness.storage.has(enabledKey)).toBe(false);
    expect(harness.storage.has(tokenHashKey)).toBe(false);
  });

  it('can retry all-account token cleanup after a failed batch', async () => {
    const harness = loadNotificationNativeHarness();
    for (let index = 0; index < 451; index += 1)
      harness.firestore.seed('alice', index.toString(16).padStart(64, '0'));
    harness.storage.set(enabledKey, 'true');
    harness.storage.set(tokenHashKey, '0'.repeat(64));
    harness.firestore.failBatches();

    await expect(harness.native.revokeNotificationsBeforeAccountDeletion('alice')).rejects.toThrow(
      'injected Firestore batch failure',
    );
    expect(harness.firestore.documents.size).toBeGreaterThan(0);
    await expect(harness.native.getNotificationSettings('alice')).resolves.toBe('error');

    await harness.native.revokeNotificationsBeforeAccountDeletion('alice');

    expect(harness.firestore.documents.size).toBe(0);
    expect(harness.storage.has(enabledKey)).toBe(false);
    expect(harness.storage.has(tokenHashKey)).toBe(false);
    await expect(harness.native.getNotificationSettings('alice')).resolves.toBe('disabled');
  });

  it('drops async initialization when auth changes accounts before the Android channel is ready', async () => {
    const harness = loadNotificationNativeHarness('android');
    let finishChannel!: () => void;
    const channelReady = new Promise<void>((resolve) => {
      finishChannel = resolve;
    });
    harness.setChannelGate(channelReady);

    const ready = harness.native.onNotificationSessionReady('alice');
    expect(harness.expoNotifications.setNotificationChannelAsync).toHaveBeenCalledTimes(1);
    harness.auth.currentUser = { uid: 'bob' };
    finishChannel();
    await ready;

    expect(harness.messagingClient.getToken).not.toHaveBeenCalled();
    expect(harness.firestore.documents.size).toBe(0);
    expect(harness.storage.size).toBe(0);
  });

  it.each(registrationRaceCases)(
    'does not register an invalidated session during %s while %s is pending',
    async (action, _label, stage) => {
      const harness = loadNotificationNativeHarness();
      const oldHash = 'a'.repeat(64);
      harness.storage.set(enabledKey, 'true');
      harness.storage.set(tokenHashKey, oldHash);
      harness.firestore.seed('alice', oldHash);
      harness.setPermission('authorized');
      harness.setToken('new-fcm-token');
      const newHash = await harness.hashPushToken('new-fcm-token');
      const gate = createDeferredNotificationStage();
      harness.setPendingStage(stage, gate);

      const ready = harness.native.onNotificationSessionReady('alice');
      await gate.entered;
      const cleanup =
        action === 'sign-out'
          ? harness.native.revokeNotificationsBeforeSignOut('alice')
          : harness.native.pauseNotificationSession();
      gate.release();
      await Promise.all([ready, cleanup]);

      expect(harness.firestore.calls.filter((call) => call.kind === 'setDoc')).toHaveLength(0);
      expect(harness.auth.currentUser?.uid).toBe('alice');
      expect(harness.storage.get(enabledKey)).toBe('true');
      if (action === 'sign-out') {
        expect(harness.storage.has(tokenHashKey)).toBe(false);
        expect(harness.firestore.documents.size).toBe(0);
      } else if (stage === 'hashPersistence') {
        expect(harness.storage.get(tokenHashKey)).toBe(newHash);
        expect(harness.firestore.documents.has(`users/alice/pushTokens/${oldHash}`)).toBe(false);
      } else {
        expect(harness.storage.get(tokenHashKey)).toBe(oldHash);
        expect(harness.firestore.documents.has(`users/alice/pushTokens/${oldHash}`)).toBe(true);
      }
    },
  );

  it('retries Android channel initialization after an error and clears the ready-session error', async () => {
    const harness = loadNotificationNativeHarness('android');
    let failChannel!: (error: Error) => void;
    harness.setChannelGate(
      new Promise<void>((_resolve, reject) => {
        failChannel = reject;
      }),
    );
    const initialReady = harness.native.onNotificationSessionReady('alice');
    failChannel(new Error('notification channel unavailable'));

    await expect(initialReady).rejects.toThrow('notification channel unavailable');
    await expect(harness.native.getNotificationSettings('alice')).resolves.toBe('error');
    expect(harness.messagingClient.getToken).not.toHaveBeenCalled();

    harness.setChannelGate(null);
    await harness.native.onNotificationSessionReady('alice');

    expect(harness.expoNotifications.setNotificationChannelAsync).toHaveBeenCalledTimes(2);
    await expect(harness.native.getNotificationSettings('alice')).resolves.toBe('disabled');
  });

  it('does not request permission when the account changes during Android initialization', async () => {
    const harness = loadNotificationNativeHarness('android');
    let finishChannel!: () => void;
    harness.setChannelGate(
      new Promise<void>((resolve) => {
        finishChannel = resolve;
      }),
    );

    const enabling = harness.native.enableNotifications('alice');
    harness.auth.currentUser = { uid: 'bob' };
    finishChannel();

    await expect(enabling).resolves.toBe('denied');
    expect(harness.expoNotifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(harness.messagingClient.getToken).not.toHaveBeenCalled();
    expect(harness.storage.size).toBe(0);
  });

  it('restores the account session after downstream deletion fails and refuses to restore a changed account', async () => {
    const harness = loadNotificationNativeHarness();
    await harness.native.enableNotifications('alice');

    await harness.native.revokeNotificationsBeforeAccountDeletion('alice');
    await harness.native.onNotificationSessionReady('alice');
    expect(harness.messagingClient.getToken).toHaveBeenCalledTimes(1);
    await harness.native.resumeNotificationsAfterAccountDeletionFailure('alice');
    await expect(harness.native.enableNotifications('alice')).resolves.toBe('authorized');
    expect(harness.firestore.documents.size).toBe(1);

    await harness.native.revokeNotificationsBeforeAccountDeletion('alice');
    const tokenReadsBeforeAccountSwitch = harness.messagingClient.getToken.mock.calls.length;
    harness.auth.currentUser = { uid: 'bob' };
    await harness.native.resumeNotificationsAfterAccountDeletionFailure('alice');
    await harness.native.onNotificationSessionReady('alice');
    await expect(harness.native.enableNotifications('alice')).resolves.toBe('denied');

    expect(harness.messagingClient.getToken).toHaveBeenCalledTimes(tokenReadsBeforeAccountSwitch);
    expect(harness.firestore.documents.size).toBe(0);
  });

  it('surfaces a failed resume after account cleanup and can retry once initialization recovers', async () => {
    const harness = loadNotificationNativeHarness('android');
    await harness.native.revokeNotificationsBeforeAccountDeletion('alice');
    let failChannel!: (error: Error) => void;
    harness.setChannelGate(
      new Promise<void>((_resolve, reject) => {
        failChannel = reject;
      }),
    );

    const resuming = harness.native.resumeNotificationsAfterAccountDeletionFailure('alice');
    failChannel(new Error('notification channel unavailable during resume'));
    await expect(resuming).rejects.toThrow('notification channel unavailable during resume');
    await expect(harness.native.getNotificationSettings('alice')).resolves.toBe('error');

    harness.setChannelGate(null);
    await harness.native.resumeNotificationsAfterAccountDeletionFailure('alice');
    await expect(harness.native.getNotificationSettings('alice')).resolves.toBe('disabled');
  });

  it('uses the current account guard before initializing a mismatched ready or enable request', async () => {
    const harness = loadNotificationNativeHarness('android');
    harness.auth.currentUser = { uid: 'bob' };

    await harness.native.onNotificationSessionReady('alice');
    harness.auth.currentUser = { uid: 'alice' };
    await harness.native.onNotificationSessionReady('alice');
    harness.auth.currentUser = { uid: 'bob' };
    await expect(harness.native.enableNotifications('alice')).resolves.toBe('denied');

    expect(harness.expoNotifications.setNotificationChannelAsync).toHaveBeenCalledTimes(1);
    expect(harness.expoNotifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(harness.messagingClient.getToken).not.toHaveBeenCalled();
  });

  it('marks a failed refresh write as an error and clears it after a successful session refresh', async () => {
    const harness = loadNotificationNativeHarness();
    await harness.native.enableNotifications('alice');
    const stop = harness.native.startPushTokenRefreshListener();
    harness.firestore.failSets();
    const writeAttempted = harness.firestore.waitForNextSetAttempt();

    harness.tokenRefreshListeners[0]('fcm-token-with-failed-write');
    await writeAttempted;
    await flushNotificationMicrotasks();
    await expect(harness.native.getNotificationSettings('alice')).resolves.toBe('error');

    await harness.native.refreshNotificationSession('alice');
    stop();
    await expect(harness.native.getNotificationSettings('alice')).resolves.toBe('enabled');
    expect(harness.firestore.documents.size).toBe(1);
  });

  it('emits foreground, opened and initial events and silences callbacks after unsubscribe', async () => {
    const harness = loadNotificationNativeHarness();
    harness.setInitialNotification(
      Promise.resolve({ data: { type: 'match', matchId: 'initial' } }),
    );
    const events: Array<{ kind: string; data: Record<string, unknown> }> = [];
    const unsubscribe = harness.native.subscribeToPushEvents((event) => events.push(event));

    harness.messageListeners[0]({ data: { type: 'message', matchId: 'foreground' } });
    harness.openedListeners[0]({ data: { type: 'message', matchId: 'opened' } });
    await flushNotificationMicrotasks();
    expect(events).toEqual([
      { kind: 'foreground', data: { type: 'message', matchId: 'foreground' } },
      { kind: 'tap', data: { type: 'message', matchId: 'opened' } },
      { kind: 'tap', data: { type: 'match', matchId: 'initial' } },
    ]);

    harness.messageListeners[0]({});
    expect(events[3]).toEqual({ kind: 'foreground', data: {} });

    unsubscribe();
    harness.messageListeners[0]({ data: { matchId: 'after-unsubscribe' } });
    harness.openedListeners[0]({ data: { matchId: 'after-unsubscribe' } });
    await flushNotificationMicrotasks();
    expect(events).toHaveLength(4);
    expect(harness.messagingClient.onMessage.mock.results[0]?.value).toHaveBeenCalledTimes(1);
    expect(
      harness.messagingClient.onNotificationOpenedApp.mock.results[0]?.value,
    ).toHaveBeenCalledTimes(1);
  });

  it('drops an initial notification that resolves after unsubscribe', async () => {
    const harness = loadNotificationNativeHarness();
    let finishInitial!: (message: { data: Record<string, unknown> }) => void;
    harness.setInitialNotification(
      new Promise((resolve) => {
        finishInitial = resolve;
      }),
    );
    const listener = jest.fn();
    const unsubscribe = harness.native.subscribeToPushEvents(listener);

    unsubscribe();
    finishInitial({ data: { type: 'match', matchId: 'stale-initial' } });
    await flushNotificationMicrotasks();

    expect(listener).not.toHaveBeenCalled();
  });

  it('swallows a failed initial-notification lookup after listener setup', async () => {
    const harness = loadNotificationNativeHarness();
    harness.setInitialNotification(Promise.reject(new Error('initial lookup failed')));
    const listener = jest.fn();

    const unsubscribe = harness.native.subscribeToPushEvents(listener);
    await flushNotificationMicrotasks();
    unsubscribe();

    expect(listener).not.toHaveBeenCalled();
  });

  it('rejects token-document writes when the adapter is not on a native OS platform', async () => {
    const harness = loadNotificationNativeHarness('web');

    await expect(harness.registerPushToken('alice', 'fcm-token', 'a'.repeat(64))).rejects.toThrow(
      'Push token registration requires a native platform',
    );

    expect(harness.firestore.documents.size).toBe(0);
    expect(harness.firestore.calls).toHaveLength(0);
  });
});

it('registers the resolved device language and refreshes it on session readiness', async () => {
  const harness = loadNotificationNativeHarness('android');
  harness.setDeviceLocale('pt-PT');
  await harness.native.enableNotifications('alice');
  let registrations = [...harness.firestore.documents.values()] as Array<{ locale?: string }>;
  expect(registrations[0].locale).toBe('pt-BR');
  harness.setDeviceLocale('es-MX');
  await harness.native.onNotificationSessionReady('alice');
  registrations = [...harness.firestore.documents.values()] as Array<{ locale?: string }>;
  expect(registrations[0].locale).toBe('es-ES');
});
