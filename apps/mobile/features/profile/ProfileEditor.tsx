import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { DsMotionView } from '@/components/ds/motion/DsMotionView';
import { DsCard } from '@/components/ds/primitives/DsCard';
import { DsPillButton } from '@/components/ds/primitives/DsPillButton';
import { DsRadius, DsSpace, DsTypography, getDsTheme } from '@/constants/design-system';
import { useSessionStore } from '@/features/auth/session-store';
import { useTranslation } from '@/localization';
import { backend } from '@/services/backend';
import { validProfileEdits, type ProfileEdits } from './profile-edits';
import {
  ANSWER_MAX,
  LOOKING_FOR,
  NAME_MAX,
  PROMPT_IDS,
  UNIONS,
  VALUE_IDS,
  VIBES,
  toggleValue,
  type PublicProfile,
} from './profile-schema';

type Props = {
  uid: string;
  profile: PublicProfile;
  scheme: 'light' | 'dark';
  active: boolean;
  onClose: () => void;
};

export function ProfileEditor({ uid, profile, scheme, active, onClose }: Props) {
  const { t } = useTranslation();
  const ds = getDsTheme(scheme);
  const [draft, setDraft] = useState<ProfileEdits>({
    displayName: profile.displayName,
    vibe: profile.vibe,
    lookingFor: profile.lookingFor,
    unionMember: profile.unionMember,
    union: profile.union,
    values: [...profile.values],
    promptId: profile.promptId,
    promptAnswer: profile.promptAnswer,
  });
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [error, setError] = useState<'invalid' | 'failed' | null>(null);
  const save = async () => {
    if (saving.current || useSessionStore.getState().user?.uid !== uid) return;
    if (!validProfileEdits(draft)) {
      setError('invalid');
      return;
    }
    const edits = {
      ...draft,
      displayName: draft.displayName.trim(),
      promptAnswer: draft.promptAnswer.trim(),
    };
    saving.current = true;
    setBusy(true);
    setError(null);
    try {
      await backend.updateProfile(uid, edits);
      const session = useSessionStore.getState();
      if (!mounted.current || session.user?.uid !== uid || !session.profile) return;
      session.updateProfile({ ...session.profile, ...edits });
      onClose();
    } catch {
      if (mounted.current && useSessionStore.getState().user?.uid === uid) setError('failed');
    } finally {
      saving.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const heading = (label: string) => (
    <Text style={[DsTypography.cardTitle, { color: ds.color.textPrimary }]}>{label}</Text>
  );
  const inputStyle = [
    styles.input,
    {
      color: ds.color.textPrimary,
      backgroundColor: ds.color.surfaceMuted,
      borderColor: ds.color.border,
    },
  ];
  return (
    <DsMotionView active={active} variant="reveal" testID="profile-editor">
      <DsCard scheme={scheme} style={styles.panel}>
        {heading(t('profile.edit.title'))}
        <Text style={[DsTypography.caption, { color: ds.color.textSecondary }]}>
          {t('profile.edit.hint')}
        </Text>
        {heading(t('onboarding.basics.name'))}
        <TextInput
          accessibilityLabel={t('onboarding.basics.name')}
          testID="profile-edit-name"
          value={draft.displayName}
          maxLength={NAME_MAX}
          editable={!busy}
          style={inputStyle}
          onChangeText={(displayName) => setDraft((d) => ({ ...d, displayName }))}
        />
        {heading(t('profile.edit.vibe'))}
        <View style={styles.choices}>
          {VIBES.map((vibe) => (
            <DsPillButton
              key={vibe}
              testID={`profile-edit-vibe-${vibe}`}
              label={t(`onboarding.vibe.${vibe}`)}
              fullWidth={false}
              scheme={scheme}
              contentColor={ds.color.textPrimary}
              variant="outline"
              selected={draft.vibe === vibe}
              disabled={busy}
              onPress={() => setDraft((d) => ({ ...d, vibe }))}
            />
          ))}
        </View>
        {heading(t('onboarding.looking_for.title'))}
        <View style={styles.choices}>
          {LOOKING_FOR.map((lookingFor) => (
            <DsPillButton
              key={lookingFor}
              testID={`profile-edit-looking-${lookingFor}`}
              label={t(`onboarding.looking_for.${lookingFor}`)}
              fullWidth={false}
              scheme={scheme}
              contentColor={ds.color.textPrimary}
              variant="outline"
              selected={draft.lookingFor === lookingFor}
              disabled={busy}
              onPress={() => setDraft((d) => ({ ...d, lookingFor }))}
            />
          ))}
        </View>
        {heading(t('onboarding.union.title'))}
        <View style={styles.choices}>
          <DsPillButton
            testID="profile-edit-union-none"
            label={t('profile.edit.no_union')}
            fullWidth={false}
            scheme={scheme}
            contentColor={ds.color.textPrimary}
            variant="outline"
            selected={!draft.unionMember}
            disabled={busy}
            onPress={() => setDraft((d) => ({ ...d, unionMember: false, union: null }))}
          />
          {UNIONS.map((union) => (
            <DsPillButton
              key={union}
              testID={`profile-edit-union-${union}`}
              label={t(`onboarding.union.${union}`)}
              fullWidth={false}
              scheme={scheme}
              contentColor={ds.color.textPrimary}
              variant="outline"
              selected={draft.union === union}
              disabled={busy}
              onPress={() => setDraft((d) => ({ ...d, unionMember: true, union }))}
            />
          ))}
        </View>
        {heading(t('onboarding.values.title'))}
        <Text style={{ color: ds.color.textSecondary }}>{t('onboarding.values.lede')}</Text>
        <View style={styles.choices}>
          {VALUE_IDS.map((value) => (
            <DsPillButton
              key={value}
              testID={`profile-edit-value-${value}`}
              label={t(`onboarding.values.${value}`)}
              fullWidth={false}
              scheme={scheme}
              contentColor={ds.color.textPrimary}
              variant="outline"
              selected={draft.values.includes(value)}
              disabled={busy}
              onPress={() => setDraft((d) => ({ ...d, values: toggleValue(d.values, value) }))}
            />
          ))}
        </View>
        {heading(t('profile.edit.prompt'))}
        <View style={styles.choices}>
          {PROMPT_IDS.map((promptId) => (
            <DsPillButton
              key={promptId}
              testID={`profile-edit-prompt-${promptId}`}
              label={t(`onboarding.prompt.${promptId}`)}
              fullWidth={false}
              scheme={scheme}
              contentColor={ds.color.textPrimary}
              variant="outline"
              selected={draft.promptId === promptId}
              disabled={busy}
              onPress={() => setDraft((d) => ({ ...d, promptId }))}
            />
          ))}
        </View>
        <TextInput
          accessibilityLabel={t('profile.edit.answer')}
          testID="profile-edit-answer"
          multiline
          value={draft.promptAnswer}
          maxLength={ANSWER_MAX}
          editable={!busy}
          style={[inputStyle, styles.answer]}
          onChangeText={(promptAnswer) => setDraft((d) => ({ ...d, promptAnswer }))}
        />
        {error ? (
          <Text
            accessibilityRole="alert"
            testID="profile-edit-error"
            style={{ color: ds.color.danger }}
          >
            {t(`profile.edit.${error}`)}
          </Text>
        ) : null}
        <DsPillButton
          testID="profile-edit-save"
          label={t('profile.edit.save')}
          disabled={busy}
          loading={busy}
          scheme={scheme}
          onPress={() => void save()}
        />
        <DsPillButton
          testID="profile-edit-cancel"
          label={t('profile.edit.cancel')}
          disabled={busy}
          scheme={scheme}
          variant="ghost"
          onPress={onClose}
        />
      </DsCard>
    </DsMotionView>
  );
}
const styles = StyleSheet.create({
  panel: { gap: DsSpace.sm },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: DsSpace.xs },
  input: {
    minHeight: 48,
    padding: 12,
    borderWidth: 1,
    borderRadius: DsRadius.sm,
    ...DsTypography.bodyLarge,
  },
  answer: { minHeight: 120, textAlignVertical: 'top' },
});
