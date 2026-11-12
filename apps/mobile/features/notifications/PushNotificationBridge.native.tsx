import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSessionStore } from '@/features/auth/session-store';
import { backend } from '@/services/backend';

import { ForegroundNotification } from './ForegroundNotification';
import { createPushTapRouter } from './push-tap';
import {
  initializePushNotifications,
  onNotificationSessionReady,
  pauseNotificationSession,
  refreshNotificationSession,
  startPushTokenRefreshListener,
  subscribeToPushEvents,
} from '@/features/notifications/notifications';

type ForegroundNotice = { type: 'match' | 'message'; matchId: string; recipientUid: string };

export function PushNotificationBridge() {
  const router = useRouter();
  const status = useSessionStore((state) => state.status);
  const uid = useSessionStore((state) => state.user?.uid);
  const [notice, setNotice] = useState<ForegroundNotice | null>(null);

  const tapRouter = useMemo(
    () =>
      createPushTapRouter({
        getSession: () => {
          const session = useSessionStore.getState();
          return { status: session.status, uid: session.user?.uid ?? null };
        },
        getMatch: (currentUid, matchId) => backend.getMatch(currentUid, matchId),
        listBlockedUids: (currentUid) => backend.listBlockedUids(currentUid),
        route: (type, matchId) => {
          if (type === 'match') {
            router.push({ pathname: '/match/[id]', params: { id: matchId } });
          } else {
            router.push({ pathname: '/chat/[id]', params: { id: matchId } });
          }
        },
      }),
    [router],
  );

  useEffect(() => {
    if (status === 'ready' && uid) {
      void onNotificationSessionReady(uid).catch(() => undefined);
    } else {
      void pauseNotificationSession().catch(() => undefined);
    }
    setNotice(null);
    void tapRouter.onSessionReady();
  }, [status, uid, tapRouter]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      const session = useSessionStore.getState();
      if (session.status === 'ready' && session.user?.uid) {
        void refreshNotificationSession(session.user.uid).catch(() => undefined);
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    let active = true;
    let stopRefresh: (() => void) | undefined;
    let stopEvents: (() => void) | undefined;

    void initializePushNotifications()
      .then(() => {
        if (!active) return;
        stopRefresh = startPushTokenRefreshListener();
        stopEvents = subscribeToPushEvents((event) => {
          if (event.kind === 'tap') {
            void tapRouter.handle(event.data);
            return;
          }

          const currentSession = useSessionStore.getState();
          const type = event.data.type;
          const matchId = event.data.matchId;
          const recipientUid = event.data.recipientUid;
          if (
            currentSession.status === 'ready' &&
            currentSession.user?.uid &&
            recipientUid === currentSession.user.uid &&
            (type === 'match' || type === 'message') &&
            typeof matchId === 'string'
          ) {
            setNotice({ type, matchId, recipientUid });
          }
        });
      })
      .catch(() => undefined);

    return () => {
      active = false;
      stopRefresh?.();
      stopEvents?.();
    };
  }, [tapRouter]);

  if (!notice || status !== 'ready' || !uid || notice.recipientUid !== uid) return null;

  return (
    <SafeAreaView pointerEvents="box-none" style={styles.overlay}>
      <View style={styles.banner}>
        <ForegroundNotification
          type={notice.type}
          onView={() => {
            setNotice(null);
            void tapRouter.handle(notice);
          }}
          onDismiss={() => setNotice(null)}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  overlay: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 3,
  },
  banner: {
    marginHorizontal: 16,
    marginTop: 8,
  },
});
