import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { DsCard } from '@/components/ds/primitives/DsCard';
import { DsPillButton } from '@/components/ds/primitives/DsPillButton';
import { DsScreen } from '@/components/ds/primitives/DsScreen';
import { DsRadius, DsSpace, DsTypography, getDsTheme } from '@/constants/design-system';
import { useSessionStore } from '@/features/auth/session-store';
import { useDiscoveryStore } from '@/features/discovery/discovery-store';
import { ProfilePhoto } from '@/features/profile/ProfilePhoto';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTranslation } from '@/localization';
import { backend } from '@/services/backend';

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
  const uid = useSessionStore((state) => state.user?.uid);
  const status = useDiscoveryStore((state) => state.status);
  const candidates = useDiscoveryStore((state) => state.candidates);
  const load = useDiscoveryStore((state) => state.load);
  const like = useDiscoveryStore((state) => state.like);
  const pass = useDiscoveryStore((state) => state.pass);

  useEffect(() => {
    if (uid) void load(backend, uid);
  }, [uid, load]);

  const reload = () => {
    if (uid) void load(backend, uid);
  };

  const likeAndMaybeMatch = async (id: string) => {
    if (!uid) return;
    const result = await like(backend, uid, id);
    if (result?.matched) router.push(`/match/${result.matchId}`);
  };

  const activeCandidate = status === 'ready' ? candidates[0] : undefined;
  const isLoading = status === 'idle' || status === 'loading';

  return (
    <DsScreen contentContainerStyle={styles.container} scheme={scheme} testID="discover-screen">
      <View style={styles.header}>
        <Text
          accessibilityRole="header"
          style={[DsTypography.title, { color: ds.color.accentPrimary }]}
        >
          {t('discover.title')}
        </Text>
        <Text style={[DsTypography.body, { color: ds.color.textSecondary }]}>
          {t('discover.subtitle')}
        </Text>
      </View>

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
      ) : activeCandidate ? (
        <DsCard
          scheme={scheme}
          style={styles.card}
          testID={`discover-person-${activeCandidate.id}`}
        >
          <ProfilePhoto
            key={activeCandidate.id}
            path={activeCandidate.photoPath}
            name={activeCandidate.displayName}
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
              {activeCandidate.displayName}, {activeCandidate.age}
            </Text>
            <Text style={[DsTypography.caption, { color: ds.color.textSecondary }]}>
              {t(`onboarding.vibe.${activeCandidate.vibe}`)}
            </Text>
          </View>

          <View style={styles.badgesRow}>
            {activeCandidate.unionMember ? (
              <View
                style={[
                  styles.badge,
                  { backgroundColor: ds.color.surfaceMuted, borderColor: ds.color.border },
                ]}
              >
                <Text style={[DsTypography.micro, { color: ds.color.textPrimary }]}>
                  {activeCandidate.union
                    ? `${t('discover.union_badge')} · ${t(`onboarding.union.${activeCandidate.union}`)}`
                    : t('discover.union_badge')}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.valuesBlock}>
            <Text style={[DsTypography.micro, { color: ds.color.accentPrimary }]}>
              {t('discover.values_label')}
            </Text>
            <View style={styles.valuesRow}>
              {activeCandidate.values.map((value) => (
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
            <Text style={[DsTypography.micro, { color: ds.color.accentPrimary }]}>
              {t(`onboarding.prompt.${activeCandidate.promptId}`)}
            </Text>
            <Text style={[DsTypography.body, { color: ds.color.textPrimary }]}>
              {activeCandidate.promptAnswer}
            </Text>
          </View>

          <View style={styles.actionsRow}>
            <View style={styles.actionItem}>
              <DsPillButton
                label={t('discover.action.pass')}
                onPress={() => {
                  if (uid) void pass(backend, uid, activeCandidate.id);
                }}
                scheme={scheme}
                testID="discover-pass"
                variant="secondary"
              />
            </View>
            <View style={styles.actionItem}>
              <DsPillButton
                label={t('discover.action.solidarity')}
                onPress={() => {
                  void likeAndMaybeMatch(activeCandidate.id);
                }}
                scheme={scheme}
                testID="discover-like"
                variant="primary"
              />
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('discover.report', { name: activeCandidate.displayName })}
            onPress={() => router.push(`/safety/${activeCandidate.id}?context=profile`)}
            style={({ pressed }) => [styles.reportLink, { opacity: pressed ? 0.7 : 1 }]}
            testID="discover-report"
          >
            <Text style={[DsTypography.caption, { color: ds.color.textTertiary }]}>
              {t('discover.report', { name: activeCandidate.displayName })}
            </Text>
          </Pressable>
        </DsCard>
      ) : (
        <DsCard scheme={scheme} style={styles.card}>
          <Text style={[DsTypography.cardTitle, { color: ds.color.textPrimary }]}>
            {t('discover.empty.title')}
          </Text>
          <Text style={[DsTypography.body, { color: ds.color.textSecondary }]}>
            {t('discover.empty.body')}
          </Text>
          <DsPillButton
            label={t('discover.empty.refresh')}
            onPress={reload}
            scheme={scheme}
            testID="discover-refresh"
            variant="primary"
          />
        </DsCard>
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
    borderRadius: DsRadius.md,
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
