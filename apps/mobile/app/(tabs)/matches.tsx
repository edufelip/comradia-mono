import { StyleSheet, Text, View } from 'react-native';

import { DsCard } from '@/components/ds/primitives/DsCard';
import { DsScreen } from '@/components/ds/primitives/DsScreen';
import { DsSpace, DsTypography, getDsTheme } from '@/constants/design-system';
import { useDiscoveryStore } from '@/features/discovery/discovery-store';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTranslation } from '@/localization';

/**
 * S9. Matches are not computed server-side yet (decision #8), so this is the list of people
 * liked in this session. It empties on reload, when swipe data is still in Firestore.
 */
export default function MatchesScreen() {
  const colorScheme = useColorScheme();
  const scheme = colorScheme === 'dark' ? 'dark' : 'light';
  const ds = getDsTheme(scheme);
  const { t } = useTranslation();
  const liked = useDiscoveryStore((state) => state.liked);

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

      {liked.length === 0 ? (
        <DsCard scheme={scheme}>
          <Text style={[DsTypography.body, { color: ds.color.textSecondary }]}>
            {t('matches.empty')}
          </Text>
        </DsCard>
      ) : (
        liked.map((person) => (
          <DsCard key={person.id} scheme={scheme} style={styles.card}>
            <Text style={[DsTypography.cardTitle, { color: ds.color.textPrimary }]}>
              {person.displayName}, {person.age}
            </Text>
            <Text style={[DsTypography.caption, { color: ds.color.accentPrimary }]}>
              {t(`onboarding.vibe.${person.vibe}`)}
            </Text>
            <Text style={[DsTypography.body, { color: ds.color.textSecondary }]}>
              {person.promptAnswer}
            </Text>
          </DsCard>
        ))
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
});
