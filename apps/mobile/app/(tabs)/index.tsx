import { StyleSheet, Text, View } from 'react-native';

import { DsCard } from '@/components/ds/primitives/DsCard';
import { DsPillButton } from '@/components/ds/primitives/DsPillButton';
import { DsScreen } from '@/components/ds/primitives/DsScreen';
import { DsRadius, DsSpace, DsTypography, getDsTheme } from '@/constants/design-system';
import { useDiscoveryStore } from '@/features/discovery/discovery-store';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTranslation } from '@/localization';

export default function DiscoverScreen() {
  const colorScheme = useColorScheme();
  const scheme = colorScheme === 'dark' ? 'dark' : 'light';
  const ds = getDsTheme(scheme);
  const { t } = useTranslation();
  const candidates = useDiscoveryStore((s) => s.candidates);
  const sendSolidarity = useDiscoveryStore((s) => s.sendSolidarity);
  const passCandidate = useDiscoveryStore((s) => s.passCandidate);
  const resetDeck = useDiscoveryStore((s) => s.resetDeck);

  const activeCandidate = candidates[0];

  return (
    <DsScreen contentContainerStyle={styles.container} scheme={scheme}>
      <View style={styles.header}>
        <Text style={[DsTypography.title, { color: ds.color.accentPrimary }]}>
          {t('discover.title')}
        </Text>
        <Text style={[DsTypography.body, { color: ds.color.textSecondary }]}>
          {t('discover.subtitle')}
        </Text>
      </View>

      {activeCandidate ? (
        <DsCard scheme={scheme} style={styles.card}>
          <View style={styles.titleRow}>
            <Text style={[DsTypography.title, { color: ds.color.textPrimary }]}>
              {activeCandidate.displayName}, {activeCandidate.age}
            </Text>
            <Text style={[DsTypography.caption, { color: ds.color.textSecondary }]}>
              {activeCandidate.pronouns} · {activeCandidate.city}
            </Text>
          </View>

          <View style={styles.badgesRow}>
            <View
              style={[
                styles.badge,
                { backgroundColor: ds.color.accentPrimarySoft, borderColor: ds.color.accentPrimary },
              ]}
            >
              <Text style={[DsTypography.micro, { color: ds.color.accentPrimary }]}>
                {activeCandidate.tendency}
              </Text>
            </View>
            {activeCandidate.unionMember ? (
              <View
                style={[
                  styles.badge,
                  { backgroundColor: ds.color.surfaceMuted, borderColor: ds.color.border },
                ]}
              >
                <Text style={[DsTypography.micro, { color: ds.color.textPrimary }]}>
                  {t('discover.union_badge')}
                </Text>
              </View>
            ) : null}
          </View>

          <Text style={[DsTypography.body, { color: ds.color.textPrimary }]}>
            {activeCandidate.bio}
          </Text>

          <View style={[styles.praxisBox, { backgroundColor: ds.color.surfaceMuted }]}>
            <Text style={[DsTypography.micro, { color: ds.color.accentPrimary }]}>
              {t('discover.praxis_label')}
            </Text>
            <Text style={[DsTypography.body, { color: ds.color.textPrimary }]}>
              {activeCandidate.praxisPrompt}
            </Text>
          </View>

          <View style={styles.causesRow}>
            {activeCandidate.causes.map((cause) => (
              <View
                key={cause}
                style={[styles.causeChip, { backgroundColor: ds.color.surfaceMuted }]}
              >
                <Text style={[DsTypography.caption, { color: ds.color.textSecondary }]}>
                  #{cause}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.actionsRow}>
            <View style={styles.actionItem}>
              <DsPillButton
                label={t('discover.action.pass')}
                onPress={() => passCandidate(activeCandidate.id)}
                scheme={scheme}
                variant="secondary"
              />
            </View>
            <View style={styles.actionItem}>
              <DsPillButton
                label={t('discover.action.solidarity')}
                onPress={() => sendSolidarity(activeCandidate.id)}
                scheme={scheme}
                variant="primary"
              />
            </View>
          </View>
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
            label={t('discover.empty.reset')}
            onPress={resetDeck}
            scheme={scheme}
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
  praxisBox: {
    borderRadius: DsRadius.md,
    gap: DsSpace.xxs,
    padding: DsSpace.md,
  },
  causesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DsSpace.xs,
  },
  causeChip: {
    borderRadius: DsRadius.sm,
    paddingHorizontal: DsSpace.sm,
    paddingVertical: DsSpace.xxs,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: DsSpace.sm,
    marginTop: DsSpace.xs,
  },
  actionItem: {
    flex: 1,
  },
});
