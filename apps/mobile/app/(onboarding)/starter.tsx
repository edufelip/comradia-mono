import { useRouter } from 'expo-router';
import { useLayoutEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { DsMotionView } from '@/components/ds/motion/DsMotionView';
import { DsCard } from '@/components/ds/primitives/DsCard';
import { DsPillButton } from '@/components/ds/primitives/DsPillButton';
import { DsFontFamily, DsRadius, DsSpace, getDsTheme } from '@/constants/design-system';
import { useSessionStore } from '@/features/auth/session-store';
import { OnboardingChip } from '@/features/onboarding/components/OnboardingChip';
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
 * S4 — prompt picker and the written answer. Finishing is the only write of the
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
                style={[styles.error, { color: ds.color.danger }]}
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
      <Text style={[styles.sectionLabel, { color: ds.color.textPrimary }]}>
        {t('onboarding.starter.prompt_label')}
      </Text>
      <ScrollView
        contentContainerStyle={styles.promptRow}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.promptScroll}
      >
        {PROMPT_IDS.map((id) => (
          <OnboardingChip
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
            <Text style={[styles.promptLabel, { color: ds.color.accentPrimary }]}>
              {t(`onboarding.prompt.${draft.promptId}`)}
            </Text>
          </DsMotionView>
        ) : (
          <Text style={[styles.promptLabel, { color: ds.color.accentPrimary }]}>
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
          style={[styles.answer, { color: ds.color.textPrimary }]}
          testID="starter-answer"
          textAlignVertical="top"
          value={draft.promptAnswer}
        />
        <Text
          style={[styles.counter, { color: ds.color.textTertiary }]}
          testID="starter-answer-count"
        >
          {t('onboarding.starter.answer_count', { count: draft.promptAnswer.length })}
        </Text>
      </DsCard>

      <View style={styles.voiceRow}>
        <Text style={[styles.voice, { color: ds.color.textTertiary }]}>
          {t('onboarding.starter.voice_soon')}
        </Text>
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    fontFamily: DsFontFamily.bold,
    fontSize: 15,
    lineHeight: 20,
    marginTop: DsSpace.lg,
  },
  promptScroll: {
    marginTop: DsSpace.sm,
  },
  promptRow: {
    gap: 8,
    paddingBottom: 4,
    paddingRight: 8,
  },
  answerCard: {
    marginTop: DsSpace.md,
  },
  promptLabel: {
    fontFamily: DsFontFamily.mono,
    fontSize: 11,
    letterSpacing: 1,
    lineHeight: 14,
    textTransform: 'uppercase',
  },
  answer: {
    borderRadius: DsRadius.md,
    fontSize: 18,
    lineHeight: 26,
    marginTop: DsSpace.sm,
    minHeight: 96,
    padding: 0,
  },
  counter: {
    fontFamily: DsFontFamily.mono,
    fontSize: 11,
    lineHeight: 14,
    marginTop: 6,
    textAlign: 'right',
  },
  voiceRow: {
    marginTop: DsSpace.sm,
  },
  voice: {
    fontSize: 12,
    lineHeight: 16,
  },
  error: {
    fontSize: 12,
    lineHeight: 16,
  },
  cta: {
    height: 52,
  },
});
