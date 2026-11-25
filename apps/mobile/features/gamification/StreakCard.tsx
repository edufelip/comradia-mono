import { Text, View } from 'react-native';
import { DsCard } from '@/components/ds/primitives/DsCard';
import { DsProgressRing } from '@/components/ds/primitives/DsProgressRing';
import { DsSpace, DsTypography, getDsTheme, type DsColorScheme } from '@/constants/design-system';
import { useTranslation } from '@/localization';
import type { GamStreakState } from './model';

export function StreakCard({ scheme, streak }: { scheme: DsColorScheme; streak: GamStreakState }) {
  const { t } = useTranslation();
  const theme = getDsTheme(scheme);
  const progress = streak.qualifiedThisWeek
    ? 'gam.qualified'
    : streak.currentWeeks > 0
      ? 'gam.progress'
      : 'gam.rested';
  return (
    <DsCard scheme={scheme} testID="gam-streak-card">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: DsSpace.md }}>
        <DsProgressRing
          scheme={scheme}
          progress={streak.qualifiedThisWeek ? 1 : 0}
          label={String(streak.currentWeeks)}
        />
        <View style={{ flex: 1, gap: DsSpace.xxs }}>
          <Text style={[DsTypography.cardTitle, { color: theme.color.textPrimary }]}>
            {t('gam.streak')}
          </Text>
          <Text style={[DsTypography.body, { color: theme.color.textSecondary }]}>
            {t(progress)}
          </Text>
        </View>
      </View>
    </DsCard>
  );
}
