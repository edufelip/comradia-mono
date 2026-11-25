import { Text, View } from 'react-native';
import { DsMotionView } from '@/components/ds/motion/DsMotionView';
import { DsConfetti } from '@/components/ds/primitives/DsConfetti';
import { DsMedal } from '@/components/ds/primitives/DsMedal';
import { DsPillButton } from '@/components/ds/primitives/DsPillButton';
import { DsSpace, DsTypography, getDsTheme, type DsColorScheme } from '@/constants/design-system';
import { useTranslation } from '@/localization';
import { BADGE_NAMES, LEVEL_NAMES, medalTier } from './display';
import type { GamCelebration } from './model';

export function BadgeMoment({
  scheme,
  celebration,
  close,
}: {
  scheme: DsColorScheme;
  celebration: Pick<GamCelebration, 'achievementId' | 'achievementTier' | 'levelId'>;
  close(): void;
}) {
  const { t } = useTranslation();
  const theme = getDsTheme(scheme);
  const { achievementId, achievementTier, levelId } = celebration;
  const name = achievementId ? BADGE_NAMES[achievementId] : levelId ? LEVEL_NAMES[levelId] : '';
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: DsSpace.lg }}>
      <DsConfetti scheme={scheme} />
      <DsMotionView variant="reveal">
        <DsMedal
          scheme={scheme}
          tier={medalTier(achievementTier ?? 2)}
          icon="local-florist"
          size={112}
        />
      </DsMotionView>
      <Text style={[DsTypography.caption, { color: theme.color.accentText }]}>
        {t(achievementId ? 'gam.unlock' : 'gam.level_up')}
      </Text>
      <Text
        accessibilityRole="header"
        style={[DsTypography.heading, { color: theme.color.textPrimary }]}
      >
        {name}
      </Text>
      <DsPillButton label={t('gam.close')} scheme={scheme} onPress={close} variant="primary" />
    </View>
  );
}
