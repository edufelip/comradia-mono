import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { DsMotionPressable } from '@/components/ds/motion/DsMotionPressable';
import { DsMotionView } from '@/components/ds/motion/DsMotionView';
import { DsCard } from '@/components/ds/primitives/DsCard';
import { DsChip } from '@/components/ds/primitives/DsChip';
import { DsPillButton } from '@/components/ds/primitives/DsPillButton';
import { DsSelectCard } from '@/components/ds/primitives/DsSelectCard';
import { DsSwitch } from '@/components/ds/primitives/DsSwitch';
import {
  DsBorder,
  DsLayout,
  DsRadius,
  DsSpace,
  DsTypography,
  getDsTheme,
} from '@/constants/design-system';
import { OnboardingScreen } from '@/features/onboarding/components/OnboardingScreen';
import { useOnboardingStore } from '@/features/onboarding/onboarding-store';
import { VIBE_VISUALS } from '@/features/onboarding/visuals';
import { pickPhoto } from '@/features/profile/pick-photo';
import {
  canLeaveVibeStep,
  LOOKING_FOR,
  NAME_MAX,
  UNIONS,
  validateBasics,
  VIBES,
} from '@/features/profile/profile-schema';
import { ProfilePhoto } from '@/features/profile/ProfilePhoto';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTranslation } from '@/localization';

/**
 * S2 — first name, birthday, vibe, who you are looking for and an optional union
 * badge. The Continue button only leaves the step once `canLeaveVibeStep` is true;
 * the basics errors appear after a field was left, so the form is not shouting at
 * someone who just arrived.
 */
export default function VibeScreen() {
  const colorScheme = useColorScheme();
  const scheme = colorScheme === 'dark' ? 'dark' : 'light';
  const ds = getDsTheme(scheme);
  const { t } = useTranslation();
  const router = useRouter();
  const draft = useOnboardingStore();
  const [nameTouched, setNameTouched] = useState(false);
  const [birthdayTouched, setBirthdayTouched] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [photoError, setPhotoError] = useState(false);

  const handlePickPhoto = async () => {
    setPhotoError(false);
    try {
      const uri = await pickPhoto();
      if (uri) draft.setPhotoUri(uri);
    } catch {
      setPhotoError(true);
    }
  };

  const today = new Date();
  const basicsError = validateBasics(draft, today);
  const canContinue = canLeaveVibeStep(draft, today);
  const showNameError = basicsError === 'name_required' && (nameTouched || attempted);
  const showBirthdayError =
    basicsError !== null && basicsError !== 'name_required' && (birthdayTouched || attempted);

  const handleContinue = () => {
    setAttempted(true);
    if (!canLeaveVibeStep(draft, new Date())) return;
    router.push('/values');
  };

  return (
    <OnboardingScreen
      footer={
        <DsPillButton
          contentColor={ds.color.onAccent}
          disabled={!canContinue}
          fullWidth
          label={t('onboarding.continue')}
          onPress={handleContinue}
          scheme={scheme}
          style={[styles.cta, { backgroundColor: ds.color.accentPrimary }]}
          testID="onboarding-continue"
          variant="primary"
        />
      }
      lede={t('onboarding.vibe.lede')}
      scheme={scheme}
      step={1}
      testID="onboarding-vibe"
      title={t('onboarding.vibe.title')}
    >
      <View style={styles.photoBlock}>
        <ProfilePhoto
          name={draft.displayName}
          path={draft.photoUri}
          scheme={scheme}
          shape="arch"
          style={styles.photo}
          testID="onboarding-photo"
        />
        <DsPillButton
          label={draft.photoUri ? t('photo.change') : t('photo.add')}
          onPress={() => {
            void handlePickPhoto();
          }}
          scheme={scheme}
          fullWidth={false}
          testID="onboarding-photo-pick"
          variant="secondary"
        />
        {draft.photoUri ? (
          <DsMotionPressable
            accessibilityRole="button"
            feedbackScale={0.97}
            onPress={() => draft.setPhotoUri(null)}
            style={styles.photoRemove}
            testID="onboarding-photo-remove"
          >
            <Text style={[styles.photoRemoveLabel, { color: ds.color.textSecondary }]}>
              {t('photo.remove')}
            </Text>
          </DsMotionPressable>
        ) : null}
        <Text style={[styles.hint, styles.photoHint, { color: ds.color.textTertiary }]}>
          {t('photo.hint')}
        </Text>
        {photoError ? (
          <DsMotionView testID="onboarding-photo-error-motion" variant="reveal">
            <Text
              accessibilityRole="alert"
              style={[styles.error, styles.photoHint, { color: ds.color.danger }]}
              testID="onboarding-photo-error"
            >
              {t('photo.error')}
            </Text>
          </DsMotionView>
        ) : null}
      </View>

      <Text
        accessibilityRole="header"
        style={[styles.sectionLabel, { color: ds.color.textPrimary }]}
      >
        {t('onboarding.basics.section')}
      </Text>
      <View style={styles.field}>
        <Text style={[styles.fieldLabel, { color: ds.color.textSecondary }]}>
          {t('onboarding.basics.name')}
        </Text>
        <TextInput
          accessibilityLabel={t('onboarding.basics.name')}
          autoCapitalize="words"
          autoComplete="given-name"
          maxLength={NAME_MAX}
          onBlur={() => setNameTouched(true)}
          onChangeText={draft.setDisplayName}
          placeholder={t('onboarding.basics.name_placeholder')}
          placeholderTextColor={ds.color.textTertiary}
          style={[
            styles.input,
            {
              backgroundColor: ds.color.surface,
              borderColor: showNameError ? ds.color.dangerBorder : ds.color.border,
              color: ds.color.textPrimary,
            },
          ]}
          testID="onboarding-name"
          textContentType="givenName"
          value={draft.displayName}
        />
        {showNameError ? (
          <DsMotionView testID="onboarding-name-error-motion" variant="reveal">
            <Text style={[styles.error, { color: ds.color.danger }]} testID="onboarding-name-error">
              {t('onboarding.error.name_required')}
            </Text>
          </DsMotionView>
        ) : null}
      </View>

      <View style={styles.field}>
        <Text style={[styles.fieldLabel, { color: ds.color.textSecondary }]}>
          {t('onboarding.basics.birthday')}
        </Text>
        <TextInput
          accessibilityLabel={t('onboarding.basics.birthday')}
          keyboardType="numeric"
          maxLength={10}
          onBlur={() => setBirthdayTouched(true)}
          onChangeText={draft.setBirthDateInput}
          placeholder={t('onboarding.basics.birthday_placeholder')}
          placeholderTextColor={ds.color.textTertiary}
          style={[
            styles.input,
            {
              backgroundColor: ds.color.surface,
              borderColor: showBirthdayError ? ds.color.dangerBorder : ds.color.border,
              color: ds.color.textPrimary,
            },
          ]}
          testID="onboarding-birthday"
          value={draft.birthDateInput}
        />
        {showBirthdayError && basicsError ? (
          <DsMotionView testID="onboarding-birthday-error-motion" variant="reveal">
            <Text
              style={[styles.error, { color: ds.color.danger }]}
              testID="onboarding-birthday-error"
            >
              {t(`onboarding.error.${basicsError}`)}
            </Text>
          </DsMotionView>
        ) : (
          <Text style={[styles.hint, { color: ds.color.textTertiary }]}>
            {t('onboarding.basics.birthday_hint')}
          </Text>
        )}
      </View>

      <View style={styles.grid}>
        {VIBES.map((vibe) => (
          <View key={vibe} style={styles.gridCell}>
            <DsSelectCard
              accent={VIBE_VISUALS[vibe].color}
              description={t(`onboarding.vibe.${vibe}_desc`)}
              icon={VIBE_VISUALS[vibe].icon}
              label={t(`onboarding.vibe.${vibe}`)}
              onPress={() => draft.setVibe(vibe)}
              scheme={scheme}
              selected={draft.vibe === vibe}
              testID={`vibe-${vibe}`}
            />
          </View>
        ))}
      </View>

      <Text style={[styles.sectionLabel, { color: ds.color.textPrimary }]}>
        {t('onboarding.looking_for.title')}
      </Text>
      <View style={styles.segmented}>
        {LOOKING_FOR.map((option) => (
          <DsChip
            key={option}
            label={t(`onboarding.looking_for.${option}`)}
            onPress={() => draft.setLookingFor(option)}
            role="radio"
            scheme={scheme}
            selected={draft.lookingFor === option}
            style={styles.segment}
            testID={`looking-for-${option}`}
          />
        ))}
      </View>

      <DsCard scheme={scheme} style={styles.unionCard}>
        <View style={styles.unionRow}>
          <View style={styles.unionText}>
            <Text style={[styles.unionLabel, { color: ds.color.textPrimary }]}>
              {t('onboarding.union.title')}
            </Text>
            <Text style={[styles.hint, { color: ds.color.textSecondary }]}>
              {t('onboarding.union.hint')}
            </Text>
          </View>
          <DsSwitch
            accessibilityLabel={t('onboarding.union.title')}
            onValueChange={draft.setUnionMember}
            scheme={scheme}
            testID="union-toggle"
            value={draft.unionMember}
          />
        </View>

        {draft.unionMember ? (
          <View style={styles.unionChips}>
            {UNIONS.map((union) => (
              <DsChip
                key={union}
                label={t(`onboarding.union.${union}`)}
                onPress={() => draft.setUnion(union)}
                role="radio"
                scheme={scheme}
                selected={draft.union === union}
                testID={`union-${union}`}
              />
            ))}
          </View>
        ) : null}
      </DsCard>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  photoBlock: {
    alignItems: 'center',
    marginTop: DsSpace.md,
  },
  photo: {
    width: 120,
    aspectRatio: 3 / 4,
  },
  photoRemove: {
    justifyContent: 'center',
    marginTop: DsSpace.xs,
    minHeight: DsLayout.minTouchTarget,
  },
  photoRemoveLabel: {
    ...DsTypography.button,
  },
  photoHint: {
    textAlign: 'center',
  },
  field: {
    marginTop: DsSpace.md,
  },
  fieldLabel: {
    ...DsTypography.caption,
    marginBottom: DsSpace.xs,
  },
  input: {
    ...DsTypography.input,
    borderRadius: DsRadius.lg,
    borderWidth: DsBorder.strong,
    minHeight: DsLayout.fieldHeight,
    paddingHorizontal: DsSpace.md,
    paddingVertical: DsSpace.sm,
  },
  hint: {
    ...DsTypography.caption,
    marginTop: DsSpace.xs,
  },
  error: {
    ...DsTypography.caption,
    marginTop: DsSpace.xs,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DsSpace.sm,
    marginTop: DsSpace.lg,
  },
  gridCell: {
    flexBasis: '47%',
  },
  sectionLabel: {
    ...DsTypography.cardTitle,
    marginTop: DsSpace.lg,
  },
  segmented: {
    flexDirection: 'row',
    gap: DsSpace.xs,
    marginTop: DsSpace.sm,
  },
  segment: {
    flex: 1,
  },
  unionCard: {
    marginTop: DsSpace.lg,
  },
  unionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: DsSpace.sm,
    justifyContent: 'space-between',
  },
  unionText: {
    flex: 1,
  },
  unionLabel: {
    ...DsTypography.button,
  },
  unionChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DsSpace.xs,
    marginTop: DsSpace.sm,
  },
  cta: {
    height: DsLayout.fieldHeight,
  },
});
