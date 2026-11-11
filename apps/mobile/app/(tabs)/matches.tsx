import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DsCard } from '@/components/ds/primitives/DsCard';
import { DsPillButton } from '@/components/ds/primitives/DsPillButton';
import { DsScreen } from '@/components/ds/primitives/DsScreen';
import { DsRadius, DsSpace, DsTypography, getDsTheme } from '@/constants/design-system';
import { useSessionStore } from '@/features/auth/session-store';
import { sharedValues } from '@/features/matches/shared-values';
import { useMatches } from '@/features/matches/use-matches';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTranslation } from '@/localization';
import { backend } from '@/services/backend';

/**
 * S9. Every mutual like, newest first, straight from Firestore. Opening the tab first
 * reconciles matches both people created at the same moment (decision #8).
 */
export default function MatchesScreen() {
  const colorScheme = useColorScheme();
  const scheme = colorScheme === 'dark' ? 'dark' : 'light';
  const ds = getDsTheme(scheme);
  const { t } = useTranslation();
  const router = useRouter();
  const uid = useSessionStore((state) => state.user?.uid);
  const myValues = useSessionStore((state) => state.profile?.values);
  const { status, matches, retry } = useMatches(backend, uid);

  const isLoading = status === 'idle' || status === 'loading';

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
      ) : matches.length === 0 ? (
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
        matches.map((match) => {
          const shared = sharedValues(myValues, match.other.values)[0];
          return (
            <Pressable
              accessibilityLabel={t('matches.open_chat', { name: match.other.displayName })}
              accessibilityRole="button"
              key={match.id}
              onPress={() => router.push(`/chat/${match.id}`)}
              style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
              testID={`match-row-${match.id}`}
            >
              <DsCard scheme={scheme} style={styles.card}>
                <Text style={[DsTypography.cardTitle, { color: ds.color.textPrimary }]}>
                  {match.other.displayName}, {match.other.age}
                </Text>
                <Text style={[DsTypography.caption, { color: ds.color.accentPrimary }]}>
                  {t(`onboarding.vibe.${match.other.vibe}`)}
                </Text>
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
        })
      )}
    </DsScreen>
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
  valueChip: {
    alignSelf: 'flex-start',
    borderRadius: DsRadius.sm,
    paddingHorizontal: DsSpace.sm,
    paddingVertical: DsSpace.xxs,
  },
});
