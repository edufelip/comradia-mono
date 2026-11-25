import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { DsCard } from '@/components/ds/primitives/DsCard';
import { DsCountUp } from '@/components/ds/primitives/DsCountUp';
import { DsOfflineBanner } from '@/components/ds/primitives/DsOfflineBanner';
import { DsSkeletonCard } from '@/components/ds/primitives/DsSkeletonCard';
import { DsMedal } from '@/components/ds/primitives/DsMedal';
import { DsMotionPressable } from '@/components/ds/motion/DsMotionPressable';
import { DsPillButton } from '@/components/ds/primitives/DsPillButton';
import { DsProgressBar } from '@/components/ds/primitives/DsProgressBar';
import { DsScreen } from '@/components/ds/primitives/DsScreen';
import { DsSheet } from '@/components/ds/primitives/DsSheet';
import { DsSpace, DsTypography, getDsTheme } from '@/constants/design-system';
import { BadgeMoment } from '@/features/gamification/BadgeMoment';
import { ProgramSettings } from '@/features/gamification/ProgramSettings';
import { RedemptionCatalog } from '@/features/gamification/RedemptionCatalog';
import { StreakCard } from '@/features/gamification/StreakCard';
import { BADGE_NAMES, LEVEL_NAMES, medalTier } from '@/features/gamification/display';
import { GAM_ACHIEVEMENTS, GAM_LEVELS, type GamAchievementId } from '@/features/gamification/model';
import { useGamification } from '@/features/gamification/provider';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTranslation } from '@/localization';

const freshStreak = {
  currentWeeks: 0,
  recordWeeks: 0,
  qualifiedThisWeek: false,
  pauseBank: 0,
  pausedUntil: null,
};

export default function CravosWallet() {
  const {
    uiEnabled,
    uid,
    member,
    achievements,
    celebrations,
    ledger,
    offline,
    flags,
    loading,
    error,
    retry,
    client,
  } = useGamification();
  const router = useRouter();
  const { t, locale } = useTranslation();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const theme = getDsTheme(scheme);
  const [selected, setSelected] = useState<GamAchievementId | null>(null);
  const [replay, setReplay] = useState(false);

  if (!uiEnabled || uid === null) return <Redirect href="/profile" />;

  const balance = Math.max(member?.balance ?? 0, 0);
  const lifetime = member?.levelHighWaterMark ?? 0;
  const levels =
    member?.levels ?? GAM_LEVELS.map((level) => ({ ...level, name: LEVEL_NAMES[level.id] }));
  const index = Math.max(
    0,
    levels.findIndex((level) => level.id === member?.levelId),
  );
  const level = levels[index];
  const next = levels[index + 1];
  const selectedBadge = achievements.find((badge) => badge.id === selected);
  const header = { color: theme.color.textPrimary };
  const sub = { color: theme.color.textSecondary };
  const closeAchievement = () => {
    setSelected(null);
    setReplay(false);
  };
  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/profile');
  };

  return (
    <DsScreen
      scheme={scheme}
      testID="gam-wallet"
      contentContainerStyle={{ padding: DsSpace.lg, gap: DsSpace.md }}
    >
      <DsPillButton
        label={t('gam.close')}
        scheme={scheme}
        variant="ghost"
        size="sm"
        onPress={close}
      />
      <Text accessibilityRole="header" style={[DsTypography.title, header]}>
        {t('gam.wallet')}
      </Text>
      {offline && <DsOfflineBanner scheme={scheme} text={t('gam.offline')} />}
      {loading ? (
        <DsSkeletonCard scheme={scheme} label={t('gam.loading')} />
      ) : error ? (
        <DsCard scheme={scheme}>
          <Text accessibilityRole="alert" style={[DsTypography.body, sub]}>
            {t('gam.failed')}
          </Text>
          <DsPillButton label={t('gam.retry')} scheme={scheme} onPress={retry} />
        </DsCard>
      ) : (
        <>
          <DsCard scheme={scheme} testID="gam-wallet-card">
            <Text style={[DsTypography.caption, sub]}>{t('gam.balance')}</Text>
            <DsCountUp locale={locale} value={balance} textStyle={[DsTypography.figure, header]} />
            {member === null && <Text style={[DsTypography.body, sub]}>{t('gam.empty')}</Text>}
            {(member?.balance ?? 0) < 0 && (
              <Text style={[DsTypography.body, sub]}>{t('gam.negative_balance')}</Text>
            )}
            <Text style={[DsTypography.cardTitle, header]}>{level.name}</Text>
            <DsProgressBar
              scheme={scheme}
              value={lifetime}
              min={level.threshold}
              max={next?.threshold ?? level.threshold + 1}
              accessibilityLabel={t('gam.lifetime', { count: lifetime })}
            />
            <Text style={[DsTypography.body, sub]}>
              {next
                ? t('gam.next_level', {
                    count: Math.max(0, next.threshold - lifetime),
                    level: next.name,
                  })
                : t('gam.max_level')}
            </Text>
            <Text style={[DsTypography.caption, sub]}>
              {t('gam.lifetime', { count: member?.lifetimeNet ?? 0 })}
            </Text>
          </DsCard>
          <StreakCard scheme={scheme} streak={member?.streak ?? freshStreak} />
          <ProgramSettings scheme={scheme} pauseOnly />
          <DsCard scheme={scheme} testID="gam-achievement-catalog">
            <Text accessibilityRole="header" style={[DsTypography.cardTitle, header]}>
              {t('gam.achievements')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: DsSpace.sm }}>
              {GAM_ACHIEVEMENTS.map((definition) => {
                const badge = achievements.find((item) => item.id === definition.id);
                return (
                  <DsMotionPressable
                    key={definition.id}
                    accessibilityRole="button"
                    accessibilityLabel={BADGE_NAMES[definition.id]}
                    onPress={() => {
                      setSelected(definition.id);
                      setReplay(false);
                    }}
                    style={{
                      alignItems: 'center',
                      flexBasis: '28%',
                      flexGrow: 1,
                      gap: DsSpace.xxs,
                    }}
                    testID={`gam-achievement-${definition.id}`}
                  >
                    <DsMedal
                      scheme={scheme}
                      tier={medalTier(badge?.tier ?? 0)}
                      icon="local-florist"
                      locked={badge?.status !== 'unlocked'}
                    />
                    <Text style={[DsTypography.caption, header, { textAlign: 'center' }]}>
                      {BADGE_NAMES[definition.id]}
                    </Text>
                  </DsMotionPressable>
                );
              })}
            </View>
          </DsCard>
          {celebrations
            .filter((event) => event.kind === 'fullscreen')
            .map((event) => (
              <DsPillButton
                key={event.id}
                label={event.achievementId ? BADGE_NAMES[event.achievementId] : t('gam.level_up')}
                scheme={scheme}
                variant="secondary"
                onPress={() =>
                  router.push({ pathname: '/conquista/[id]', params: { id: event.id } })
                }
              />
            ))}
          {member?.quest.questId && (
            <DsCard scheme={scheme}>
              <Text accessibilityRole="header" style={[DsTypography.cardTitle, header]}>
                {t('gam.quest')}
              </Text>
              <Text style={[DsTypography.body, sub]}>
                {t('gam.quest_progress', {
                  count: member.quest.progress,
                  target: member.quest.target,
                })}
              </Text>
            </DsCard>
          )}
          <DsCard scheme={scheme}>
            <Text accessibilityRole="header" style={[DsTypography.cardTitle, header]}>
              {t('gam.ledger')}
            </Text>
            {ledger.map((entry) => {
              const date = entry.createdAt
                ? new Date(entry.createdAt.toMillis()).toLocaleDateString(locale)
                : '';
              return (
                <View
                  key={entry.id}
                  style={{ flexDirection: 'row', justifyContent: 'space-between', gap: DsSpace.sm }}
                >
                  <Text style={[DsTypography.body, header, { flex: 1 }]}>
                    {t(`gam.ledger.${entry.kind}`)}
                    {date ? ` · ${date}` : ''}
                  </Text>
                  <Text style={[DsTypography.body, sub]}>
                    {entry.amount > 0 ? '+' : ''}
                    {entry.amount}
                  </Text>
                </View>
              );
            })}
            {ledger.length === 0 && (
              <Text style={[DsTypography.body, sub]}>{t('gam.empty_ledger')}</Text>
            )}
          </DsCard>
          {flags.gam_redemption ? (
            <RedemptionCatalog scheme={scheme} balance={balance} />
          ) : (
            <DsPillButton
              label={t('gam.redeem_soon')}
              disabled
              scheme={scheme}
              onPress={() => {}}
            />
          )}
        </>
      )}
      <DsSheet
        visible={selected !== null}
        onClose={closeAchievement}
        closeLabel={t('gam.close')}
        title={selected ? BADGE_NAMES[selected] : t('gam.achievements')}
        scheme={scheme}
        testID="gam-achievement-detail"
      >
        {replay && selected !== null ? (
          <BadgeMoment
            scheme={scheme}
            celebration={{ achievementId: selected, achievementTier: selectedBadge?.tier }}
            close={closeAchievement}
          />
        ) : (
          <View style={{ gap: DsSpace.sm, alignItems: 'center' }}>
            <DsMedal
              scheme={scheme}
              tier={medalTier(selectedBadge?.tier ?? 0)}
              icon="local-florist"
              locked={selectedBadge?.status !== 'unlocked'}
            />
            <Text style={[DsTypography.body, sub]}>
              {t(
                selectedBadge === undefined
                  ? 'gam.locked'
                  : selectedBadge.status === 'unlocked'
                    ? 'gam.earned'
                    : 'gam.lapsed',
              )}
            </Text>
            {selectedBadge?.status === 'unlocked' && selected !== null ? (
              <DsPillButton
                label={t('gam.replay')}
                scheme={scheme}
                onPress={() => {
                  setReplay(true);
                  for (const event of celebrations) {
                    if (event.achievementId === selected)
                      void client.markSeen(uid, event.id).catch(() => {});
                  }
                }}
              />
            ) : null}
          </View>
        )}
      </DsSheet>
    </DsScreen>
  );
}
