import { StyleSheet, Text, View } from 'react-native';

import { DsCard } from '@/components/ds/primitives/DsCard';
import { DsScreen } from '@/components/ds/primitives/DsScreen';
import { DsSpace, DsTypography, getDsTheme } from '@/constants/design-system';
import { useDiscoveryStore } from '@/features/discovery/discovery-store';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTranslation } from '@/localization';

export default function MatchesScreen() {
  const colorScheme = useColorScheme();
  const scheme = colorScheme === 'dark' ? 'dark' : 'light';
  const ds = getDsTheme(scheme);
  const { t } = useTranslation();
  const matches = useDiscoveryStore((s) => s.matches);

  return (
    <DsScreen contentContainerStyle={styles.container} scheme={scheme}>
      <View style={styles.header}>
        <Text style={[DsTypography.title, { color: ds.color.textPrimary }]}>
          {t('matches.title')}
        </Text>
        <Text style={[DsTypography.body, { color: ds.color.textSecondary }]}>
          {t('matches.subtitle')}
        </Text>
      </View>

      {matches.length === 0 ? (
        <DsCard scheme={scheme}>
          <Text style={[DsTypography.body, { color: ds.color.textSecondary }]}>
            {t('matches.empty')}
          </Text>
        </DsCard>
      ) : (
        matches.map((comrade) => (
          <DsCard key={comrade.id} scheme={scheme} style={styles.card}>
            <Text style={[DsTypography.cardTitle, { color: ds.color.textPrimary }]}>
              {comrade.displayName}, {comrade.age} · {comrade.city}
            </Text>
            <Text style={[DsTypography.caption, { color: ds.color.accentPrimary }]}>
              {comrade.tendency}
            </Text>
            <Text style={[DsTypography.body, { color: ds.color.textSecondary }]}>
              {comrade.praxisPrompt}
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
