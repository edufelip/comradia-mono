import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSessionStore } from '@/features/auth/session-store';
import {
  initializePushNotifications,
  onNotificationSessionReady,
  pauseNotificationSession,
  refreshNotificationSession,
  startPushTokenRefreshListener,
  subscribeToPushEvents,
} from '@/features/notifications/notifications';
import { backend } from '@/services/backend';
import { ForegroundNotification } from './ForegroundNotification';
import { createPushTapRouter } from './push-tap';

type ForegroundNotice = {
  id: number;
  type: 'match' | 'message';
  matchId: string;
  recipientUid: string;
};

export function PushNotificationBridge() {
  const router = useRouter();
  const status = useSessionStore((state) => state.status);
  const uid = useSessionStore((state) => state.user?.uid);
  const [notice, setNotice] = useState<ForegroundNotice | null>(null);
  const [closingId, setClosingId] = useState<number | null>(null);
  const nextNoticeId = useRef(0);
  const closingNoticeId = useRef<number | null>(null);
  const finishExit = useCallback((id: number) => {
    setNotice((current) => (current?.id === id ? null : current));
    setClosingId((current) => (current === id ? null : current));
    if (closingNoticeId.current === id) closingNoticeId.current = null;
  }, []);

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
    setClosingId(null);
    closingNoticeId.current = null;
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
            closingNoticeId.current = null;
            setClosingId(null);
            setNotice({ id: ++nextNoticeId.current, type, matchId, recipientUid });
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
          key={notice.id}
          type={notice.type}
          noticeId={notice.id}
          closing={closingId === notice.id}
          onExitComplete={finishExit}
          onView={() => {
            if (closingNoticeId.current === notice.id) return;
            closingNoticeId.current = notice.id;
            setClosingId(notice.id);
            void tapRouter.handle(notice);
          }}
          onDismiss={() => {
            closingNoticeId.current = notice.id;
            setClosingId(notice.id);
          }}
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
