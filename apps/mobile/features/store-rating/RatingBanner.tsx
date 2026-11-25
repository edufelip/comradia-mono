import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Linking, Platform } from 'react-native';
import { DsNotice } from '@/components/ds/primitives/DsNotice';
import { DsPillButton } from '@/components/ds/primitives/DsPillButton';
import type { DsColorScheme } from '@/constants/design-system';
import { useSessionStore } from '@/features/auth/session-store';
import { useTranslation } from '@/localization';
import { ratingReviewUrl, shouldShowRatingBanner, type RatingState } from './eligibility';

type RatingHistory = RatingState & { firstSignInAt: number };
const key = (uid: string) => `comradia.rating.v1.${uid}`;
const native = Platform.OS === 'ios' || Platform.OS === 'android';
function configuredReviewUrl() {
  const listing =
    Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_COMRADIA_APP_STORE_URL
      : process.env.EXPO_PUBLIC_COMRADIA_PLAY_STORE_URL;
  return ratingReviewUrl(Platform.OS, listing);
}
const celebrated = new Set<string>();
export function recordRatingSessionCelebration(uid: string) {
  celebrated.add(uid);
}

async function history(uid: string): Promise<RatingHistory> {
  const raw = await AsyncStorage.getItem(key(uid));
  if (raw !== null) {
    const value: unknown = JSON.parse(raw);
    if (
      typeof value === 'object' &&
      value !== null &&
      'firstSignInAt' in value &&
      typeof value.firstSignInAt === 'number' &&
      Number.isFinite(value.firstSignInAt)
    ) {
      const { firstSignInAt } = value;
      const lastShownAt =
        'lastShownAt' in value && typeof value.lastShownAt === 'number' ? value.lastShownAt : null;
      const ratedTapAt =
        'ratedTapAt' in value && typeof value.ratedTapAt === 'number' ? value.ratedTapAt : null;
      return { firstSignInAt, lastShownAt, ratedTapAt };
    }
  }
  const record = { firstSignInAt: Date.now(), lastShownAt: null, ratedTapAt: null };
  await AsyncStorage.setItem(key(uid), JSON.stringify(record));
  return record;
}

export function RatingSessionBridge() {
  const uid = useSessionStore((session) => session.user?.uid);
  const pathname = usePathname();
  useEffect(() => {
    if (native && uid) void history(uid).catch(() => {});
  }, [uid]);
  useEffect(() => {
    if (uid && (pathname.startsWith('/match/') || pathname.startsWith('/conquista/'))) {
      recordRatingSessionCelebration(uid);
    }
  }, [pathname, uid]);
  return null;
}

export function useRatingBanner(
  uid: string | undefined,
  focused: boolean,
  matchCount: number,
  hasStreakCard: boolean,
  reviewUrl = configuredReviewUrl(),
) {
  const [record, setRecord] = useState<{ uid: string; data: RatingHistory } | null>(null);
  const deferred = useRef<string | null>(null);
  const hadFocus = useRef(false);

  useEffect(() => {
    if (!focused) {
      hadFocus.current = false;
      setRecord(null);
      return;
    }
    if (!uid || !reviewUrl || matchCount === 0 || hadFocus.current) return;
    let active = true;
    void history(uid)
      .then((data) => {
        if (
          !active ||
          !shouldShowRatingBanner({
            now: Date.now(),
            state: data,
            firstSignInAt: data.firstSignInAt,
            matchCount,
            sessionHadCelebration: celebrated.has(uid),
            platform: Platform.OS,
          })
        )
          return;
        hadFocus.current = true;
        if (hasStreakCard && deferred.current !== uid) {
          deferred.current = uid;
          return;
        }
        const shown = { ...data, lastShownAt: Date.now() };
        void AsyncStorage.setItem(key(uid), JSON.stringify(shown)).catch(() => {});
        setRecord({ uid, data: shown });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [uid, focused, matchCount, hasStreakCard, reviewUrl]);

  return uid && reviewUrl && focused && record?.uid === uid && !celebrated.has(uid)
    ? { uid, url: reviewUrl, record: record.data, dismiss: () => setRecord(null) }
    : null;
}

export function RatingBanner({
  scheme,
  rating,
}: {
  scheme: DsColorScheme;
  rating: NonNullable<ReturnType<typeof useRatingBanner>>;
}) {
  const { t } = useTranslation();
  const [closing, setClosing] = useState(false);
  const busy = useRef(false);
  const review = async () => {
    if (busy.current || closing) return;
    busy.current = true;
    try {
      await Linking.openURL(rating.url);
      await AsyncStorage.setItem(
        key(rating.uid),
        JSON.stringify({ ...rating.record, ratedTapAt: Date.now() }),
      );
      setClosing(true);
    } catch {
      busy.current = false;
    }
  };

  return (
    <DsNotice
      scheme={scheme}
      icon="star-outline"
      title={t('gam.rating.title')}
      body={t('gam.rating.body')}
      closing={closing}
      onExitComplete={rating.dismiss}
      testID="store-rating-banner"
      actions={
        <>
          <DsPillButton
            scheme={scheme}
            size="sm"
            variant="primary"
            label={t('gam.rating.action')}
            onPress={() => {
              void review();
            }}
          />
          <DsPillButton
            scheme={scheme}
            size="sm"
            variant="ghost"
            label={t('gam.rating.dismiss')}
            onPress={() => setClosing(true)}
          />
        </>
      }
    />
  );
}
