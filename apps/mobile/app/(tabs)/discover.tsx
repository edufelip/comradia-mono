import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { DsMotionPressable } from '@/components/ds/motion/DsMotionPressable';
import { DsCard } from '@/components/ds/primitives/DsCard';
import { DsEmptyState } from '@/components/ds/primitives/DsEmptyState';
import { DsPillButton } from '@/components/ds/primitives/DsPillButton';
import { DsScreen } from '@/components/ds/primitives/DsScreen';
import { DsRadius, DsSpace, DsTypography, getDsTheme } from '@/constants/design-system';
import { useSessionStore } from '@/features/auth/session-store';
import {
  DEFAULT_DISCOVERY_FILTERS,
  matchesDiscoveryFilters,
  type DiscoveryFilters,
} from '@/features/discovery/discovery-filters';
import { useDiscoveryStore } from '@/features/discovery/discovery-store';
import { DiscoveryFilterPanel } from '@/features/discovery/DiscoveryFilterPanel';
import { ProfilePhoto } from '@/features/profile/ProfilePhoto';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTranslation } from '@/localization';
import { backend } from '@/services/backend';
import type { DiscoveryProfile } from '@/features/profile/profile-schema';

/**
 * S5. The deck comes from Firestore; Like / Pass are written as swipes and the card leaves
 * the deck at once. A like the backend reports as mutual opens S8 (decision #8).
 */
export default function DiscoverScreen() {
  const colorScheme = useColorScheme();
  const scheme = colorScheme === 'dark' ? 'dark' : 'light';
  const ds = getDsTheme(scheme);
  const { t } = useTranslation();
  const router = useRouter();
  const { height } = useWindowDimensions();
  const isFocused = useIsFocused();
  const reduceMotion = useReducedMotion();
  const uid = useSessionStore((state) => state.user?.uid);
  const [filterState, setFilterState] = useState<{
    uid: string | undefined;
    filters: DiscoveryFilters;
  }>({ uid, filters: { ...DEFAULT_DISCOVERY_FILTERS } });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filters = filterState.uid === uid ? filterState.filters : DEFAULT_DISCOVERY_FILTERS;
  const status = useDiscoveryStore((state) => state.status);
  const candidates = useDiscoveryStore((state) => state.candidates);
  const load = useDiscoveryStore((state) => state.load);
  const like = useDiscoveryStore((state) => state.like);
  const pass = useDiscoveryStore((state) => state.pass);
  const [heldCandidate, setHeldCandidate] = useState<DiscoveryProfile | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const focusedRef = useRef(isFocused);
  const actionEpoch = useRef(0);
  const actionInFlight = useRef(false);
  const cardProgress = useSharedValue(1);
  const cardMotionStyle = useAnimatedStyle(() => ({
    opacity: cardProgress.value,
    transform: [
      { translateY: (1 - cardProgress.value) * 8 },
      { scale: 0.98 + cardProgress.value * 0.02 },
    ],
  }));

  useEffect(() => {
    focusedRef.current = isFocused;
    if (!isFocused) {
      actionEpoch.current += 1;
      actionInFlight.current = false;
      setHeldCandidate(null);
      setActionPending(false);
      cancelAnimation(cardProgress);
      cardProgress.value = 1;
    }
    return () => {
      actionEpoch.current += 1;
      actionInFlight.current = false;
      cancelAnimation(cardProgress);
    };
  }, [cardProgress, isFocused]);

  useEffect(() => {
    actionEpoch.current += 1;
    actionInFlight.current = false;
    setHeldCandidate(null);
    setActionPending(false);
    cancelAnimation(cardProgress);
    cardProgress.value = 1;
    setFilterState({ uid, filters: { ...DEFAULT_DISCOVERY_FILTERS } });
    setFiltersOpen(false);
  }, [cardProgress, uid]);

  useEffect(() => {
    if (uid) void load(backend, uid);
  }, [uid, load]);

  const reload = () => {
    if (uid) void load(backend, uid);
  };

  const finishConfirmedSwipe = () => {
    actionInFlight.current = false;
    setHeldCandidate(null);
    setActionPending(false);
    if (reduceMotion || !focusedRef.current) {
      cancelAnimation(cardProgress);
      cardProgress.value = 1;
      return;
    }
    cardProgress.value = 0;
    cardProgress.value = withTiming(1, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
  };

  const restoreUnconfirmedSwipe = () => {
    actionInFlight.current = false;
    setHeldCandidate(null);
    setActionPending(false);
  };

  const isCurrentAction = (epoch: number, actionUid: string) =>
    actionEpoch.current === epoch &&
    focusedRef.current &&
    useSessionStore.getState().user?.uid === actionUid;

  const likeAndMaybeMatch = async (candidate: DiscoveryProfile) => {
    if (!uid || actionInFlight.current) return;
    actionInFlight.current = true;
    const epoch = ++actionEpoch.current;
    setActionPending(true);
    setHeldCandidate(candidate);
    const result = await like(backend, uid, candidate.id);
    if (!isCurrentAction(epoch, uid)) return;
    if (!result) {
      restoreUnconfirmedSwipe();
      return;
    }
    if (result.matched) {
      restoreUnconfirmedSwipe();
      router.push(`/match/${result.matchId}?celebrate=1`);
      return;
    }
    finishConfirmedSwipe();
  };

  const passCandidate = async (candidate: DiscoveryProfile) => {
    if (!uid || actionInFlight.current) return;
    actionInFlight.current = true;
    const epoch = ++actionEpoch.current;
    setActionPending(true);
    setHeldCandidate(candidate);
    await pass(backend, uid, candidate.id);
    if (!isCurrentAction(epoch, uid)) return;
    // The store restores a failed pass before its promise settles. Keep the visible card in
    // place on failure; only confirm the transition after it is absent from the deck.
    if (useDiscoveryStore.getState().candidates.some((person) => person.id === candidate.id)) {
      restoreUnconfirmedSwipe();
      return;
    }
    finishConfirmedSwipe();
  };

  const filteredCandidates = candidates.filter((person) =>
    matchesDiscoveryFilters(person, filters),
  );
  const applyFilters = (next: DiscoveryFilters) => {
    if (actionInFlight.current) return;
    cancelAnimation(cardProgress);
    cardProgress.value = 1;
    setFilterState({ uid, filters: next });
    setFiltersOpen(false);
  };
  const activeCandidate = status === 'ready' ? filteredCandidates[0] : undefined;
  const hasFilteredEmpty = candidates.length > 0 && filteredCandidates.length === 0;
  const displayedCandidate = heldCandidate ?? activeCandidate;
  const isLoading = status === 'idle' || status === 'loading';

  return (
    <DsScreen
      keyboardAware={filtersOpen}
      keyboardDismissMode="on-drag"
      contentContainerStyle={styles.container}
      scheme={scheme}
      testID="discover-screen"
    >
      <View style={styles.header}>
        <Text
          accessibilityRole="header"
          style={[DsTypography.title, { color: ds.color.accentText }]}
        >
          {t('discover.title')}
        </Text>
        <Text style={[DsTypography.body, { color: ds.color.textSecondary }]}>
          {t('discover.subtitle')}
        </Text>
      </View>

      <DsPillButton
        disabled={actionPending}
        label={t('discover.filters.title')}
        onPress={() => setFiltersOpen((open) => !open)}
        scheme={scheme}
        testID="discover-filters-open"
        variant="outline"
      />
      {filtersOpen ? (
        <DiscoveryFilterPanel
          key={uid}
          active={isFocused}
          busy={actionPending}
          filters={filters}
          onApply={applyFilters}
          onCancel={() => setFiltersOpen(false)}
          scheme={scheme}
        />
      ) : null}

      {isLoading ? (
        <DsCard scheme={scheme} style={styles.card}>
          <Text style={[DsTypography.body, { color: ds.color.textSecondary }]}>
            {t('discover.loading')}
          </Text>
        </DsCard>
      ) : status === 'error' ? (
        <DsCard scheme={scheme} style={styles.card}>
          <Text style={[DsTypography.body, { color: ds.color.textPrimary }]}>
            {t('discover.error')}
          </Text>
          <DsPillButton
            label={t('discover.retry')}
            onPress={reload}
            scheme={scheme}
            testID="discover-retry"
            variant="primary"
          />
        </DsCard>
      ) : displayedCandidate ? (
        <Animated.View style={cardMotionStyle} testID="discover-card-motion">
          <DsCard
            scheme={scheme}
            style={styles.card}
            testID={`discover-person-${displayedCandidate.id}`}
          >
            <ProfilePhoto
              key={displayedCandidate.id}
              path={displayedCandidate.photoPath}
              name={displayedCandidate.displayName}
              shape="arch"
              scheme={scheme}
              style={{
                width: '100%',
                aspectRatio: 4 / 5,
                maxHeight: Math.round(height * 0.42),
                alignSelf: 'center',
              }}
              testID="discover-photo"
            />
            <View style={styles.titleRow}>
              <Text
                style={[DsTypography.title, { color: ds.color.textPrimary }]}
                testID="discover-card-name"
              >
                {displayedCandidate.displayName}, {displayedCandidate.age}
              </Text>
              <Text style={[DsTypography.caption, { color: ds.color.textSecondary }]}>
                {t(`onboarding.vibe.${displayedCandidate.vibe}`)}
              </Text>
            </View>

            <View style={styles.badgesRow}>
              {displayedCandidate.unionMember ? (
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: ds.color.surfaceMuted, borderColor: ds.color.border },
                  ]}
                >
                  <Text style={[DsTypography.micro, { color: ds.color.textPrimary }]}>
                    {displayedCandidate.union
                      ? `${t('discover.union_badge')} · ${t(`onboarding.union.${displayedCandidate.union}`)}`
                      : t('discover.union_badge')}
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={styles.valuesBlock}>
              <Text style={[DsTypography.micro, { color: ds.color.accentText }]}>
                {t('discover.values_label')}
              </Text>
              <View style={styles.valuesRow}>
                {displayedCandidate.values.map((value) => (
                  <View
                    key={value}
                    style={[styles.valueChip, { backgroundColor: ds.color.surfaceMuted }]}
                  >
                    <Text style={[DsTypography.caption, { color: ds.color.textSecondary }]}>
                      {t(`onboarding.values.${value}`)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={[styles.promptBox, { backgroundColor: ds.color.surfaceMuted }]}>
              <Text style={[DsTypography.micro, { color: ds.color.accentText }]}>
                {t(`onboarding.prompt.${displayedCandidate.promptId}`)}
              </Text>
              <Text style={[DsTypography.body, { color: ds.color.textPrimary }]}>
                {displayedCandidate.promptAnswer}
              </Text>
            </View>

            <View style={styles.actionsRow}>
              <View style={styles.actionItem}>
                <DsPillButton
                  disabled={actionPending}
                  label={t('discover.action.pass')}
                  onPress={() => void passCandidate(displayedCandidate)}
                  scheme={scheme}
                  testID="discover-pass"
                  variant="secondary"
                />
              </View>
              <View style={styles.actionItem}>
                <DsPillButton
                  disabled={actionPending}
                  label={t('discover.action.solidarity')}
                  onPress={() => void likeAndMaybeMatch(displayedCandidate)}
                  scheme={scheme}
                  testID="discover-like"
                  variant="primary"
                />
              </View>
            </View>

            <DsMotionPressable
              accessibilityRole="button"
              accessibilityLabel={t('discover.report', { name: displayedCandidate.displayName })}
              onPress={() => router.push(`/safety/${displayedCandidate.id}?context=profile`)}
              style={styles.reportLink}
              testID="discover-report"
            >
              <Text style={[DsTypography.caption, { color: ds.color.textTertiary }]}>
                {t('discover.report', { name: displayedCandidate.displayName })}
              </Text>
            </DsMotionPressable>
          </DsCard>
        </Animated.View>
      ) : (
        <DsEmptyState
          actionLabel={t(hasFilteredEmpty ? 'discover.filters.reset' : 'discover.empty.refresh')}
          actionTestID="discover-refresh"
          body={t(hasFilteredEmpty ? 'discover.filters.empty_body' : 'discover.empty.body')}
          onAction={
            hasFilteredEmpty ? () => applyFilters({ ...DEFAULT_DISCOVERY_FILTERS }) : reload
          }
          scheme={scheme}
          title={t(hasFilteredEmpty ? 'discover.filters.empty_title' : 'discover.empty.title')}
        />
      )}
    </DsScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: DsSpace.lg,
    padding: DsSpace.lg,
  },
  header: {
    gap: DsSpace.xxs,
  },
  card: {
    gap: DsSpace.md,
  },
  titleRow: {
    gap: DsSpace.xxs,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DsSpace.xs,
  },
  badge: {
    borderRadius: DsRadius.pill,
    borderWidth: 1,
    paddingHorizontal: DsSpace.sm,
    paddingVertical: DsSpace.xxs,
  },
  valuesBlock: {
    gap: DsSpace.xxs,
  },
  valuesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DsSpace.xs,
  },
  valueChip: {
    borderRadius: DsRadius.sm,
    paddingHorizontal: DsSpace.sm,
    paddingVertical: DsSpace.xxs,
  },
  promptBox: {
    borderRadius: DsRadius.sm,
    gap: DsSpace.xxs,
    padding: DsSpace.md,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: DsSpace.sm,
    marginTop: DsSpace.xs,
  },
  actionItem: {
    flex: 1,
  },
  reportLink: {
    alignSelf: 'center',
    paddingVertical: DsSpace.xxs,
  },
});
