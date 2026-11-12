import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DsCard } from '@/components/ds/primitives/DsCard';
import { DsPillButton } from '@/components/ds/primitives/DsPillButton';
import { DsScreen } from '@/components/ds/primitives/DsScreen';
import { DsRadius, DsSpace, DsTypography, getDsTheme } from '@/constants/design-system';
import { useSessionStore } from '@/features/auth/session-store';
import { sharedValues } from '@/features/matches/shared-values';
import { ProfilePhoto } from '@/features/profile/ProfilePhoto';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTranslation } from '@/localization';
import { backend } from '@/services/backend';
import type { Match } from '@/services/backend/types';

type MatchStatus = 'loading' | 'ready' | 'not_found' | 'error';

/**
 * S8. Shown right after a like the backend reported as mutual: both first names, the values
 * the two cards share, and the two ways out — write now, or go back to the deck.
 */
export default function MatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const scheme = colorScheme === 'dark' ? 'dark' : 'light';
  const ds = getDsTheme(scheme);
  const { t } = useTranslation();
  const router = useRouter();
  const uid = useSessionStore((state) => state.user?.uid);
  const myProfile = useSessionStore((state) => state.profile);
  const [status, setStatus] = useState<MatchStatus>('loading');
  const [match, setMatch] = useState<Match | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!uid) return;
    let active = true;
    setStatus('loading');

    backend
      .getMatch(uid, id)
      .then((found) => {
        if (!active) return;
        if (!found) {
          setStatus('not_found');
          return;
        }
        setMatch(found);
        setStatus('ready');
      })
      .catch(() => {
        if (active) setStatus('error');
      });

    return () => {
      active = false;
    };
  }, [uid, id, attempt]);

  const shared = sharedValues(myProfile?.values, match?.other.values ?? []);

  return (
    <DsScreen
      contentContainerStyle={styles.container}
      scheme={scheme}
      testID="match-screen"
      withBlobs
    >
      <View style={styles.header}>
        <Text
          accessibilityRole="header"
          style={[DsTypography.title, { color: ds.color.accentPrimary }]}
        >
          {t('match.title')}
        </Text>
        {status === 'ready' && match ? (
          <Text style={[DsTypography.body, { color: ds.color.textSecondary }]}>
            {t('match.subtitle', { name: match.other.displayName })}
          </Text>
        ) : null}
      </View>

      {status === 'loading' ? (
        <DsCard scheme={scheme}>
          <Text style={[DsTypography.body, { color: ds.color.textSecondary }]}>
            {t('match.loading')}
          </Text>
        </DsCard>
      ) : status === 'not_found' ? (
        <DsCard scheme={scheme} testID="match-not-found">
          <Text style={[DsTypography.body, { color: ds.color.textPrimary }]}>
            {t('match.not_found')}
          </Text>
          <DsPillButton
            label={t('match.keep_swiping')}
            onPress={() => router.back()}
            scheme={scheme}
            testID="match-keep-swiping"
            variant="secondary"
          />
        </DsCard>
      ) : status === 'error' ? (
        <DsCard scheme={scheme} testID="match-error">
          <Text
            accessibilityRole="alert"
            style={[DsTypography.body, { color: ds.color.textPrimary }]}
          >
            {t('match.error')}
          </Text>
          <DsPillButton
            label={t('match.retry')}
            onPress={() => setAttempt((value) => value + 1)}
            scheme={scheme}
            testID="match-retry"
            variant="primary"
          />
        </DsCard>
      ) : match ? (
        <>
          <View style={styles.photos}>
            {myProfile ? (
              <ProfilePhoto
                name={myProfile.displayName}
                path={myProfile.photoPath}
                scheme={scheme}
                shape="arch"
                style={styles.portrait}
                testID="match-photo-me"
              />
            ) : null}
            <ProfilePhoto
              name={match.other.displayName}
              path={match.other.photoPath}
              scheme={scheme}
              shape="arch"
              style={styles.portrait}
              testID="match-photo-other"
            />
          </View>

          <DsCard scheme={scheme} style={styles.card}>
            <Text
              style={[DsTypography.cardTitle, { color: ds.color.textPrimary }]}
              testID="match-names"
            >
              {t('match.names', {
                me: myProfile?.displayName ?? '',
                name: match.other.displayName,
              })}
            </Text>
            <Text style={[DsTypography.caption, { color: ds.color.textSecondary }]}>
              {match.other.displayName}, {match.other.age} ·{' '}
              {t(`onboarding.vibe.${match.other.vibe}`)}
            </Text>
          </DsCard>

          <DsCard scheme={scheme} style={styles.card}>
            <Text style={[DsTypography.micro, { color: ds.color.accentPrimary }]}>
              {t('match.shared_label')}
            </Text>
            {shared.length > 0 ? (
              <View style={styles.valuesRow}>
                {shared.map((value) => (
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
            ) : (
              <Text style={[DsTypography.body, { color: ds.color.textSecondary }]}>
                {t('match.shared_none')}
              </Text>
            )}
          </DsCard>

          <View style={styles.actions}>
            <DsPillButton
              label={t('match.send_message')}
              onPress={() => router.replace(`/chat/${match.id}`)}
              scheme={scheme}
              testID="match-send-message"
              variant="primary"
            />
            <DsPillButton
              label={t('match.keep_swiping')}
              onPress={() => router.back()}
              scheme={scheme}
              testID="match-keep-swiping"
              variant="secondary"
            />
          </View>
        </>
      ) : null}
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
  photos: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: DsSpace.sm,
    justifyContent: 'center',
  },
  portrait: {
    aspectRatio: 3 / 4,
    width: 120,
  },
  card: {
    gap: DsSpace.xs,
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
  actions: {
    gap: DsSpace.sm,
  },
});
