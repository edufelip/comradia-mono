import { StyleSheet, Text, View } from 'react-native';

import { DsCard } from '@/components/ds/primitives/DsCard';
import { DsScreen } from '@/components/ds/primitives/DsScreen';
import { DsSpace, DsTypography, getDsTheme } from '@/constants/design-system';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTranslation } from '@/localization';

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const scheme = colorScheme === 'dark' ? 'dark' : 'light';
  const ds = getDsTheme(scheme);
  const { t } = useTranslation();

  return (
    <DsScreen contentContainerStyle={styles.container} scheme={scheme}>
      <View style={styles.header}>
        <Text style={[DsTypography.title, { color: ds.color.textPrimary }]}>
          {t('profile.title')}
        </Text>
        <Text style={[DsTypography.body, { color: ds.color.textSecondary }]}>
          {t('profile.subtitle')}
        </Text>
      </View>

      <DsCard scheme={scheme} style={styles.card}>
        <Text style={[DsTypography.micro, { color: ds.color.accentPrimary }]}>
          {t('profile.tendency')}
        </Text>
        <Text style={[DsTypography.cardTitle, { color: ds.color.textPrimary }]}>
          Democratic Socialist
        </Text>
      </DsCard>

      <DsCard scheme={scheme} style={styles.card}>
        <Text style={[DsTypography.micro, { color: ds.color.accentPrimary }]}>
          {t('profile.causes')}
        </Text>
        <Text style={[DsTypography.body, { color: ds.color.textPrimary }]}>
          Labor Rights · Universal Healthcare · Climate Action · Housing as a Human Right
        </Text>
      </DsCard>
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
