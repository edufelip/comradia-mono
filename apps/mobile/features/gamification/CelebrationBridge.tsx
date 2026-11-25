import {
  impactAsync,
  ImpactFeedbackStyle,
  notificationAsync,
  NotificationFeedbackType,
} from 'expo-haptics';
import { usePathname, useRouter } from 'expo-router';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppState, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DsNotice } from '@/components/ds/primitives/DsNotice';
import { DsRewardToast } from '@/components/ds/primitives/DsRewardToast';
import { DsSpace, type DsColorScheme } from '@/constants/design-system';
import { recordRatingSessionCelebration } from '@/features/store-rating/RatingBanner';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTranslation } from '@/localization';
import type { GamDocument } from '@/services/gamification/types';
import { pointToast } from './celebrations';
import { BADGE_NAMES, LEVEL_NAMES } from './display';
import type { GamCelebration } from './model';
import { useGamification } from './provider';

const MATCH_QUIET_MS = 120_000;
const MOMENT_MAX_AGE_MS = 10 * 60_000;
type Celebration = GamDocument<GamCelebration>;

export function CelebrationBridge() {
  const { uid } = useGamification();
  return uid === null ? null : <MemberCelebrations key={uid} uid={uid} />;
}

function MemberCelebrations({ uid }: { uid: string }) {
  const { client, flags, celebrations } = useGamification();
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useTranslation();
  const scheme: DsColorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const seen = useRef(new Set<string>());
  const usedFullscreen = useRef(false);
  const lastMatch = useRef(0);
  const enteredMatchesAt = useRef(0);
  const [foreground, setForeground] = useState(AppState.currentState !== 'background');
  const [toasts, setToasts] = useState<Celebration[]>([]);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) =>
      setForeground(state === 'active'),
    );
    return () => subscription.remove();
  }, []);

  useLayoutEffect(() => {
    if (pathname === '/matches') enteredMatchesAt.current = Date.now();
  }, [pathname]);

  const match = pathname.startsWith('/match/');
  const routeAllowsToast =
    pathname === '/matches' || pathname === '/profile' || pathname.startsWith('/chat/');
  useEffect(() => {
    if (match) lastMatch.current = Date.now();
    if (!foreground || !routeAllowsToast || toasts.length > 0) return;
    const recent = celebrations.filter((event) => {
      const at = event.createdAt?.toMillis() ?? 0;
      return Date.now() - at <= MOMENT_MAX_AGE_MS && !seen.current.has(event.id);
    });
    const allowedFull =
      pathname === '/matches' &&
      !usedFullscreen.current &&
      flags.gam_fullscreen_celebrations &&
      Date.now() - lastMatch.current > MATCH_QUIET_MS;
    // A queued badge stays in the wallet when the member is returning to the matches list.
    const full = allowedFull
      ? recent.find(
          (event) =>
            event.kind === 'fullscreen' && event.createdAt.toMillis() >= enteredMatchesAt.current,
        )
      : undefined;
    if (full) {
      usedFullscreen.current = true;
      seen.current.add(full.id);
      if (Platform.OS !== 'web')
        void notificationAsync(NotificationFeedbackType.Success).catch(() => {});
      router.push({ pathname: '/conquista/[id]', params: { id: full.id } });
      return;
    }
    const next = pointToast(recent, seen.current);
    if (next.length === 0) return;
    next.forEach((item) => seen.current.add(item.id));
    recordRatingSessionCelebration(uid);
    setToasts(next);
    if (Platform.OS !== 'web') void impactAsync(ImpactFeedbackStyle.Light).catch(() => {});
  }, [
    celebrations,
    flags.gam_fullscreen_celebrations,
    foreground,
    match,
    pathname,
    routeAllowsToast,
    router,
    toasts.length,
    uid,
  ]);

  const finish = () => {
    setToasts([]);
    setClosing(false);
    for (const { id } of toasts) void client.markSeen(uid, id).catch(() => {});
  };

  const first = toasts[0];
  if (first === undefined || !foreground || !routeAllowsToast) return null;
  const amount = toasts.reduce((sum, event) => sum + (event.amount ?? 0), 0);
  const close = () => setClosing(true);
  const common = {
    scheme,
    onClose: close,
    closing,
    closeLabel: t('gam.close'),
    onExitComplete: finish,
  };
  const title = first.achievementId
    ? BADGE_NAMES[first.achievementId]
    : first.levelId
      ? LEVEL_NAMES[first.levelId]
      : first.copyKey === 'gam.toast.expiring'
        ? t('gam.expiry', { count: amount })
        : t('gam.wallet');
  return (
    <SafeAreaView pointerEvents="box-none" style={styles.overlay}>
      {first.amount !== undefined && first.copyKey !== 'gam.toast.expiring' ? (
        <DsRewardToast
          {...common}
          amount={amount}
          formatAmount={(count) => t('gam.toast', { count })}
          body={t('gam.balance')}
          onDismiss={close}
          testID="gam-points-toast"
        />
      ) : (
        <DsNotice
          {...common}
          title={title}
          onDismiss={close}
          autoDismissMs={5000}
          testID="gam-update-toast"
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: DsSpace.md,
    right: DsSpace.md,
    paddingTop: DsSpace.xs,
  },
});
