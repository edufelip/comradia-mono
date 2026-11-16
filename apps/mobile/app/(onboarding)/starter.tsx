import { useRouter } from 'expo-router';
import { useLayoutEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { DsMotionView } from '@/components/ds/motion/DsMotionView';
import { DsCard } from '@/components/ds/primitives/DsCard';
import { DsChip } from '@/components/ds/primitives/DsChip';
import { DsPillButton } from '@/components/ds/primitives/DsPillButton';
import { DsSwitch } from '@/components/ds/primitives/DsSwitch';
import { ExternalLink } from '@/components/external-link';
import { DsLayout, DsRadius, DsSpace, DsTypography, getDsTheme } from '@/constants/design-system';
import { LEGAL_URLS } from '@/constants/legal';
import { useSessionStore } from '@/features/auth/session-store';
import { OnboardingScreen } from '@/features/onboarding/components/OnboardingScreen';
import { useOnboardingStore } from '@/features/onboarding/onboarding-store';
import {
  ANSWER_MAX,
  buildDocuments,
  canFinish,
  PROMPT_IDS,
} from '@/features/profile/profile-schema';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTranslation } from '@/localization';
import { backend } from '@/services/backend';

/**
 * S4 — prompt picker, the written answer and the consent for sensitive data. Finishing is the only write of the
 * whole flow: `buildDocuments` produces both Firestore documents, the backend
 * saves them in one batch, and `completeOnboarding` flips the session to `ready`
 * so routing takes the user to Discover. A failed save keeps the draft intact.
 */
export default function StarterScreen() {
  const colorScheme = useColorScheme();
  const scheme = colorScheme === 'dark' ? 'dark' : 'light';
  const ds = getDsTheme(scheme);
  const { t } = useTranslation();
  const router = useRouter();
  const draft = useOnboardingStore();
  const user = useSessionStore((state) => state.user);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const previousPromptId = useRef(draft.promptId);
  const [promptHasChanged, setPromptHasChanged] = useState(false);

  useLayoutEffect(() => {
    if (previousPromptId.current === draft.promptId) return;
    previousPromptId.current = draft.promptId;
    setPromptHasChanged(true);
  }, [draft.promptId]);

  const handleFinish = async () => {
    if (!user || saving) return;
    setSaving(true);
    setFailed(false);
    try {
      const documents = buildDocuments(draft, new Date());
      const photoUri = draft.photoUri;
      const profile = await backend.saveOnboarding(user.uid, documents, photoUri);
      draft.reset();
      useSessionStore.getState().completeOnboarding(profile);
    } catch {
      setFailed(true);
      setSaving(false);
    }
  };

  return (
    <OnboardingScreen
      footer={
        <>
          {failed ? (
            <DsMotionView testID="onboarding-error-motion" variant="reveal">
              <Text
                accessibilityRole="alert"
                style={[DsTypography.caption, { color: ds.color.danger }]}
                testID="onboarding-error"
              >
                {t('onboarding.error.save')}
              </Text>
            </DsMotionView>
          ) : null}
          <DsPillButton
            contentColor={ds.color.onAccent}
            disabled={!canFinish(draft)}
            fullWidth
            label={t('onboarding.starter.finish')}
            loading={saving}
            onPress={() => {
              void handleFinish();
            }}
            scheme={scheme}
            style={[styles.cta, { backgroundColor: ds.color.accentPrimary }]}
            testID="starter-finish"
            variant="primary"
          />
        </>
      }
      lede={t('onboarding.starter.lede')}
      onBack={() => router.back()}
      scheme={scheme}
      step={3}
      testID="onboarding-starter"
      title={t('onboarding.starter.title')}
    >
      <Text style={[DsTypography.cardTitle, styles.sectionLabel, { color: ds.color.textPrimary }]}>
        {t('onboarding.starter.prompt_label')}
      </Text>
      <ScrollView
        contentContainerStyle={styles.promptRow}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.promptScroll}
      >
        {PROMPT_IDS.map((id) => (
          <DsChip
            key={id}
            label={t(`onboarding.prompt.${id}`)}
            onPress={() => draft.setPromptId(id)}
            role="radio"
            scheme={scheme}
            selected={draft.promptId === id}
            testID={`prompt-${id}`}
          />
        ))}
      </ScrollView>

      <DsCard scheme={scheme} style={styles.answerCard} testID="starter-prompt-card">
        {promptHasChanged ? (
          <DsMotionView key={draft.promptId} testID="starter-prompt-motion" variant="reveal">
            <Text style={[DsTypography.eyebrow, { color: ds.color.accentText }]}>
              {t(`onboarding.prompt.${draft.promptId}`)}
            </Text>
          </DsMotionView>
        ) : (
          <Text style={[DsTypography.eyebrow, { color: ds.color.accentText }]}>
            {t(`onboarding.prompt.${draft.promptId}`)}
          </Text>
        )}
        <TextInput
          accessibilityLabel={t('onboarding.starter.answer_label')}
          maxLength={ANSWER_MAX}
          multiline
          onChangeText={draft.setPromptAnswer}
          placeholder={t('onboarding.starter.answer_placeholder')}
          placeholderTextColor={ds.color.textTertiary}
          style={[DsTypography.bodyLarge, styles.answer, { color: ds.color.textPrimary }]}
          testID="starter-answer"
          textAlignVertical="top"
          value={draft.promptAnswer}
        />
        <Text
          style={[DsTypography.caption, styles.counter, { color: ds.color.textTertiary }]}
          testID="starter-answer-count"
        >
          {t('onboarding.starter.answer_count', { count: draft.promptAnswer.length })}
        </Text>
      </DsCard>

      <View style={styles.voiceRow}>
        <Text style={[DsTypography.caption, { color: ds.color.textTertiary }]}>
          {t('onboarding.starter.voice_soon')}
        </Text>
      </View>

      <DsCard scheme={scheme} style={styles.consentCard} testID="starter-consent">
        <Text style={[DsTypography.body, { color: ds.color.textSecondary }]}>
          {t('onboarding.consent.body')}
        </Text>
        <View style={styles.consentRow}>
          <DsSwitch
            accessibilityLabel={t('onboarding.consent.toggle')}
            onValueChange={draft.setSensitiveDataConsent}
            scheme={scheme}
            testID="starter-consent-toggle"
            value={draft.sensitiveDataConsent}
          />
          <Text style={[DsTypography.button, styles.consentLabel, { color: ds.color.textPrimary }]}>
            {t('onboarding.consent.toggle')}
          </Text>
        </View>
        <ExternalLink
          href={LEGAL_URLS.privacy}
          style={[DsTypography.body, { color: ds.color.accentText }]}
          testID="starter-consent-privacy"
        >
          {t('onboarding.consent.privacy_link')}
        </ExternalLink>
      </DsCard>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    marginTop: DsSpace.lg,
  },
  promptScroll: {
    marginTop: DsSpace.sm,
  },
  promptRow: {
    gap: DsSpace.xs,
    paddingBottom: DsSpace.xxs,
    paddingRight: DsSpace.xs,
  },
  answerCard: {
    marginTop: DsSpace.md,
  },
  answer: {
    borderRadius: DsRadius.sm,
    marginTop: DsSpace.sm,
    minHeight: 96,
    padding: 0,
  },
  counter: {
    marginTop: DsSpace.xs,
    textAlign: 'right',
  },
  voiceRow: {
    marginTop: DsSpace.sm,
  },
  consentCard: {
    gap: DsSpace.sm,
    marginTop: DsSpace.lg,
  },
  consentRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: DsSpace.sm,
  },
  consentLabel: {
    flex: 1,
  },
  cta: {
    height: DsLayout.fieldHeight,
  },
});
