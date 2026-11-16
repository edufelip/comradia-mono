import { useIsFocused } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { DsMotionView } from '@/components/ds/motion/DsMotionView';
import { DsBackButton } from '@/components/ds/primitives/DsBackButton';
import { DsCard } from '@/components/ds/primitives/DsCard';
import { DsPillButton } from '@/components/ds/primitives/DsPillButton';
import { DsScreen } from '@/components/ds/primitives/DsScreen';
import { DsRadius, DsSpace, DsTypography, getDsTheme } from '@/constants/design-system';
import { useSessionStore } from '@/features/auth/session-store';
import { useDiscoveryStore } from '@/features/discovery/discovery-store';
import { DsChip } from '@/components/ds/primitives/DsChip';
import { REPORT_DETAILS_MAX, safetyErrorKey } from '@/features/safety/safety';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTranslation } from '@/localization';
import { backend } from '@/services/backend';
import { toBackendError, type BackendErrorCode } from '@/services/backend/errors';
import { REPORT_REASONS, type ReportContext, type ReportReason } from '@/services/backend/types';

type BusyAction = 'block' | 'report';

/**
 * S12. The safety sheet for one person, opened from Discover (`context=profile`) or from a
 * chat (`context=chat&match=<id>`). Blocking closes the sheet; reporting does the same after
 * also blocking (the backend writes both in one batch, so the copy says so).
 */
export default function SafetyScreen() {
  const params = useLocalSearchParams<{ uid: string; context?: string }>();
  const targetId = params.uid;
  const context: ReportContext = params.context === 'chat' ? 'chat' : 'profile';
  const colorScheme = useColorScheme();
  const scheme = colorScheme === 'dark' ? 'dark' : 'light';
  const ds = getDsTheme(scheme);
  const { t } = useTranslation();
  const router = useRouter();
  const isFocused = useIsFocused();
  const isFocusedRef = useRef(isFocused);
  isFocusedRef.current = isFocused;
  const uid = useSessionStore((state) => state.user?.uid);
  const deckName = useDiscoveryStore(
    (state) => state.candidates.find((person) => person.id === targetId)?.displayName,
  );
  const removeCandidate = useDiscoveryStore((state) => state.removeCandidate);

  const [fetchedName, setFetchedName] = useState<string | null>(null);
  const [confirmingBlock, setConfirmingBlock] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState<BusyAction | null>(null);
  const [errorCode, setErrorCode] = useState<BackendErrorCode | null>(null);
  const [animatedErrorCode, setAnimatedErrorCode] = useState<BackendErrorCode | null>(null);

  const name = deckName ?? fetchedName ?? t('safety.someone');

  // From a chat the deck may never hold this person, so fall back to their public card.
  useEffect(() => {
    if (!uid || !targetId || deckName) return;
    let active = true;
    backend
      .getProfile(targetId)
      .then((profile) => {
        if (active && profile) setFetchedName(profile.displayName);
      })
      .catch(() => {
        // The name is cosmetic; the sheet works without it.
      });
    return () => {
      active = false;
    };
  }, [uid, targetId, deckName]);

  const close = () => {
    router.back();
  };

  /** Closes the sheet the way each context expects after the write landed. */
  const finish = () => {
    if (context === 'chat') {
      router.dismissTo('/matches');
      return;
    }
    removeCandidate(targetId);
    router.back();
  };

  const block = async () => {
    if (!uid || !targetId || busy) return;
    setBusy('block');
    setErrorCode(null);
    setAnimatedErrorCode(null);
    try {
      await backend.blockUser(uid, targetId);
      finish();
    } catch (error) {
      const code = toBackendError(error).code;
      setErrorCode(code);
      setAnimatedErrorCode(isFocusedRef.current ? code : null);
      setBusy(null);
    }
  };

  const report = async () => {
    if (!uid || !targetId || !reason || busy) return;
    setBusy('report');
    setErrorCode(null);
    setAnimatedErrorCode(null);
    try {
      await backend.reportUser(uid, { targetId, reason, details: details.trim(), context });
      finish();
    } catch (error) {
      const code = toBackendError(error).code;
      setErrorCode(code);
      setAnimatedErrorCode(isFocusedRef.current ? code : null);
      setBusy(null);
    }
  };

  return (
    <DsScreen
      contentContainerStyle={styles.container}
      scheme={scheme}
      testID="safety-screen"
      withBlobs
    >
      <View style={styles.header}>
        <DsBackButton
          accessibilityLabel={t('safety.close')}
          onPress={close}
          scheme={scheme}
          testID="safety-close"
        />
        <Text
          accessibilityRole="header"
          style={[DsTypography.title, { color: ds.color.accentText }]}
        >
          {t('safety.title')}
        </Text>
      </View>

      <View style={styles.intro}>
        <Text
          style={[DsTypography.cardTitle, { color: ds.color.textPrimary }]}
          testID="safety-name"
        >
          {name}
        </Text>
        <Text style={[DsTypography.body, { color: ds.color.textSecondary }]}>
          {t('safety.subtitle', { name })}
        </Text>
      </View>

      {errorCode ? (
        animatedErrorCode === errorCode ? (
          <DsMotionView key={errorCode} testID="safety-error-motion" variant="reveal">
            <Text
              accessibilityLiveRegion="polite"
              accessibilityRole="alert"
              style={[DsTypography.body, { color: ds.color.danger }]}
              testID="safety-error"
            >
              {t(safetyErrorKey(errorCode))}
            </Text>
          </DsMotionView>
        ) : (
          <Text
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
            style={[DsTypography.body, { color: ds.color.danger }]}
            testID="safety-error"
          >
            {t(safetyErrorKey(errorCode))}
          </Text>
        )
      ) : null}

      <DsCard scheme={scheme} style={styles.card} testID="safety-block-card">
        <Text style={[DsTypography.micro, { color: ds.color.accentText }]}>
          {t('safety.block.title')}
        </Text>
        <Text style={[DsTypography.body, { color: ds.color.textPrimary }]}>
          {t('safety.block.body', { name })}
        </Text>

        {confirmingBlock ? (
          <DsMotionView testID="safety-block-confirm-motion" variant="scale">
            <View style={styles.confirmPanel} testID="safety-block-confirm-panel">
              <Text style={[DsTypography.body, { color: ds.color.textPrimary }]}>
                {t('safety.block.confirm_text', { name })}
              </Text>
              <DsPillButton
                disabled={busy !== null}
                label={t('safety.block.confirm')}
                loading={busy === 'block'}
                onPress={() => void block()}
                scheme={scheme}
                testID="safety-block-confirm"
                variant="primary"
              />
              <DsPillButton
                disabled={busy !== null}
                label={t('safety.block.cancel')}
                onPress={() => setConfirmingBlock(false)}
                scheme={scheme}
                testID="safety-block-cancel"
                variant="ghost"
              />
            </View>
          </DsMotionView>
        ) : (
          <DsPillButton
            disabled={busy !== null}
            label={t('safety.block.action', { name })}
            onPress={() => setConfirmingBlock(true)}
            scheme={scheme}
            testID="safety-block"
            variant="outline"
          />
        )}
      </DsCard>

      <DsCard scheme={scheme} style={styles.card} testID="safety-report-card">
        <Text style={[DsTypography.micro, { color: ds.color.accentText }]}>
          {t('safety.report.title')}
        </Text>
        <Text style={[DsTypography.body, { color: ds.color.textPrimary }]}>
          {t('safety.report.body', { name })}
        </Text>

        <Text style={[DsTypography.screenTitle, { color: ds.color.textPrimary }]}>
          {t('safety.report.reason_label')}
        </Text>
        <View style={styles.reasons}>
          {REPORT_REASONS.map((id) => (
            <DsChip
              key={id}
              disabled={busy !== null}
              label={t(`safety.reason.${id}`)}
              onPress={() => setReason(id)}
              role="radio"
              scheme={scheme}
              selected={reason === id}
              testID={`report-reason-${id}`}
            />
          ))}
        </View>

        <TextInput
          accessibilityLabel={t('safety.report.details_label')}
          maxLength={REPORT_DETAILS_MAX}
          multiline
          onChangeText={setDetails}
          placeholder={t('safety.report.details_placeholder')}
          placeholderTextColor={ds.color.textTertiary}
          style={[
            styles.details,
            {
              backgroundColor: ds.color.surfaceMuted,
              borderColor: ds.color.border,
              color: ds.color.textPrimary,
            },
          ]}
          testID="report-details"
          textAlignVertical="top"
          value={details}
        />
        <Text style={[DsTypography.caption, { color: ds.color.textTertiary }]}>
          {t('safety.report.details_count', { count: details.length })}
        </Text>

        <DsPillButton
          disabled={!reason || busy !== null}
          label={t('safety.report.submit')}
          loading={busy === 'report'}
          onPress={() => void report()}
          scheme={scheme}
          testID="report-submit"
          variant="primary"
        />
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
    alignItems: 'center',
    flexDirection: 'row',
    gap: DsSpace.sm,
  },
  intro: {
    gap: DsSpace.xxs,
  },
  card: {
    gap: DsSpace.sm,
  },
  confirmPanel: {
    gap: DsSpace.xs,
  },
  reasons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DsSpace.xs,
  },
  details: {
    borderRadius: DsRadius.sm,
    ...DsTypography.input,
    borderWidth: 1,
    minHeight: 96,
    paddingHorizontal: DsSpace.md,
    paddingVertical: DsSpace.sm,
  },
});
