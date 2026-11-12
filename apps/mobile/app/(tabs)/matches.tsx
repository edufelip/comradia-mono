import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DsMotionView } from '@/components/ds/motion/DsMotionView';
import { DsCard } from '@/components/ds/primitives/DsCard';
import { DsPillButton } from '@/components/ds/primitives/DsPillButton';
import { DsScreen } from '@/components/ds/primitives/DsScreen';
import { DsRadius, DsSpace, DsTypography, getDsTheme } from '@/constants/design-system';
import { useSessionStore } from '@/features/auth/session-store';
import { sharedValues } from '@/features/matches/shared-values';
import { useMatches } from '@/features/matches/use-matches';
import { ProfilePhoto } from '@/features/profile/ProfilePhoto';
import { useBlockedUids } from '@/features/safety/use-blocked-uids';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTranslation } from '@/localization';
import { backend } from '@/services/backend';
import type { ValueId } from '@/features/profile/profile-schema';
import type { Match } from '@/services/backend/types';

/**
 * S9. Every mutual like, newest first, straight from Firestore. Opening the tab first
 * reconciles matches both people created at the same moment (decision #8). Matches of
 * people I blocked (or who blocked me) stay hidden.
 */
export default function MatchesScreen() {
  const colorScheme = useColorScheme();
  const scheme = colorScheme === 'dark' ? 'dark' : 'light';
  const ds = getDsTheme(scheme);
  const { t } = useTranslation();
  const router = useRouter();
  const isFocused = useIsFocused();
  const uid = useSessionStore((state) => state.user?.uid);
  const myValues = useSessionStore((state) => state.profile?.values);
  const { status, matches, retry } = useMatches(backend, uid);
  const { blockedUids } = useBlockedUids(backend, uid);
  const [animatedMatchIds, setAnimatedMatchIds] = useState<Set<string>>(() => new Set());
  const matchSnapshot = useRef<{ key: string; initialized: boolean; ids: Set<string> }>({
    key: uid ?? '',
    initialized: false,
    ids: new Set(),
  });

  const isLoading = status === 'idle' || status === 'loading';
  const visibleMatches = matches.filter((match) => !blockedUids.includes(match.other.id));

  useEffect(() => {
    const key = uid ?? '';
    if (matchSnapshot.current.key !== key) {
      matchSnapshot.current = { key, initialized: false, ids: new Set() };
      setAnimatedMatchIds(new Set());
      return;
    }

    if (status !== 'ready') {
      matchSnapshot.current.initialized = false;
      setAnimatedMatchIds((current) => (current.size === 0 ? current : new Set()));
      return;
    }

    if (!matchSnapshot.current.initialized) {
      matchSnapshot.current.initialized = true;
      matchSnapshot.current.ids = new Set(matches.map((match) => match.id));
      return;
    }

    const incoming = matches.filter((match) => !matchSnapshot.current.ids.has(match.id));
    matches.forEach((match) => matchSnapshot.current.ids.add(match.id));
    const visibleIds = new Set(
      matches.filter((match) => !blockedUids.includes(match.other.id)).map((match) => match.id),
    );

    if (!isFocused || incoming.length === 0) {
      setAnimatedMatchIds((current) => {
        const next = new Set([...current].filter((id) => visibleIds.has(id)));
        if (next.size === current.size && [...current].every((id) => next.has(id))) return current;
        return next;
      });
      return;
    }

    const visibleIncoming = incoming.map((match) => match.id).filter((id) => visibleIds.has(id));
    setAnimatedMatchIds((current) => {
      const next = new Set([...current].filter((id) => visibleIds.has(id)));
      visibleIncoming.forEach((id) => next.add(id));
      if (next.size === current.size && [...current].every((id) => next.has(id))) return current;
      return next;
    });
  }, [blockedUids, isFocused, matches, status, uid]);

  return (
    <DsScreen contentContainerStyle={styles.container} scheme={scheme} testID="matches-screen">
      <View style={styles.header}>
        <Text
          accessibilityRole="header"
          style={[DsTypography.title, { color: ds.color.textPrimary }]}
        >
          {t('matches.title')}
        </Text>
        <Text style={[DsTypography.body, { color: ds.color.textSecondary }]}>
          {t('matches.subtitle')}
        </Text>
      </View>

      {isLoading ? (
        <DsCard scheme={scheme}>
          <Text style={[DsTypography.body, { color: ds.color.textSecondary }]}>
            {t('matches.loading')}
          </Text>
        </DsCard>
      ) : status === 'error' ? (
        <DsCard scheme={scheme} style={styles.card}>
          <Text
            accessibilityRole="alert"
            style={[DsTypography.body, { color: ds.color.textPrimary }]}
            testID="matches-error"
          >
            {t('matches.error')}
          </Text>
          <DsPillButton
            label={t('matches.retry')}
            onPress={retry}
            scheme={scheme}
            testID="matches-retry"
            variant="primary"
          />
        </DsCard>
      ) : visibleMatches.length === 0 ? (
        <DsCard scheme={scheme} style={styles.card} testID="matches-empty">
          <Text style={[DsTypography.cardTitle, { color: ds.color.textPrimary }]}>
            {t('matches.empty.title')}
          </Text>
          <Text style={[DsTypography.body, { color: ds.color.textSecondary }]}>
            {t('matches.empty.body')}
          </Text>
          <DsPillButton
            label={t('matches.empty.cta')}
            onPress={() => router.navigate('/discover')}
            scheme={scheme}
            testID="matches-empty-discover"
            variant="primary"
          />
        </DsCard>
      ) : (
        visibleMatches.map((match) => {
          const shared = sharedValues(myValues, match.other.values)[0];
          return (
            <MatchRow
              animate={
                isFocused &&
                matchSnapshot.current.key === (uid ?? '') &&
                matchSnapshot.current.initialized &&
                animatedMatchIds.has(match.id)
              }
              key={match.id}
              match={match}
              onPress={() => router.push(`/chat/${match.id}`)}
              scheme={scheme}
              shared={shared}
            />
          );
        })
      )}
    </DsScreen>
  );
}

type MatchRowProps = {
  animate: boolean;
  match: Match;
  onPress: () => void;
  scheme: 'light' | 'dark';
  shared: ValueId | undefined;
};

function MatchRow({ animate, match, onPress, scheme, shared }: MatchRowProps) {
  const ds = getDsTheme(scheme);
  const { t } = useTranslation();

  const row = (
    <Pressable
      accessibilityLabel={t('matches.open_chat', { name: match.other.displayName })}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
      testID={`match-row-${match.id}`}
    >
      <DsCard scheme={scheme} style={styles.card}>
        <View style={styles.row}>
          <ProfilePhoto
            name={match.other.displayName}
            path={match.other.photoPath}
            scheme={scheme}
            shape="circle"
            style={{ width: 48 }}
            testID={`match-row-photo-${match.id}`}
          />
          <View style={styles.rowText}>
            <Text style={[DsTypography.cardTitle, { color: ds.color.textPrimary }]}>
              {match.other.displayName}, {match.other.age}
            </Text>
            <Text style={[DsTypography.caption, { color: ds.color.accentPrimary }]}>
              {t(`onboarding.vibe.${match.other.vibe}`)}
            </Text>
          </View>
        </View>
        {shared ? (
          <View style={[styles.valueChip, { backgroundColor: ds.color.surfaceMuted }]}>
            <Text style={[DsTypography.caption, { color: ds.color.textSecondary }]}>
              {t('matches.shared', { value: t(`onboarding.values.${shared}`) })}
            </Text>
          </View>
        ) : null}
      </DsCard>
    </Pressable>
  );

  return animate ? (
    <DsMotionView variant="slide" testID={`match-row-motion-${match.id}`}>
      {row}
    </DsMotionView>
  ) : (
    row
  );
}

const styles = StyleSheet.create({
  container: {
    gap: DsSpace.md,
    padding: DsSpace.lg,
  },
  header: {
    gap: DsSpace.xxs,
  },
  card: {
    gap: DsSpace.xs,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: DsSpace.sm,
  },
  rowText: {
    flex: 1,
    gap: DsSpace.xxs,
    minWidth: 0,
  },
  valueChip: {
    alignSelf: 'flex-start',
    borderRadius: DsRadius.sm,
    paddingHorizontal: DsSpace.sm,
    paddingVertical: DsSpace.xxs,
  },
});
