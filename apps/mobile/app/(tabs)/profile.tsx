import { useIsFocused } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DsMotionPressable } from '@/components/ds/motion/DsMotionPressable';
import { DsMotionView } from '@/components/ds/motion/DsMotionView';
import { DsCard } from '@/components/ds/primitives/DsCard';
import { DsPillButton } from '@/components/ds/primitives/DsPillButton';
import { DsScreen } from '@/components/ds/primitives/DsScreen';
import { DsRadius, DsSpace, DsTypography, getDsTheme } from '@/constants/design-system';
import { useSessionStore } from '@/features/auth/session-store';
import { NotificationSettings } from '@/features/notifications/NotificationSettings';
import { useNotificationSettings } from '@/features/notifications/use-notification-settings';
import { pickPhoto } from '@/features/profile/pick-photo';
import { ProfileEditor } from '@/features/profile/ProfileEditor';
import { ProfilePhoto } from '@/features/profile/ProfilePhoto';
import { needsRecentSignIn } from '@/features/safety/safety';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTranslation } from '@/localization';
import { backend } from '@/services/backend';
import { toBackendError, type BackendErrorCode } from '@/services/backend/errors';

/**
 * S11. The signed-in user's own public card, exactly as other people see it, plus the two
 * ways out: sign out, and delete the account (which needs a recent sign-in — Firebase
 * refuses to delete an old session, so the panel asks for one instead of failing late).
 */
export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const scheme = colorScheme === 'dark' ? 'dark' : 'light';
  const ds = getDsTheme(scheme);
  const { t } = useTranslation();
  const uid = useSessionStore((state) => state.user?.uid);
  const profile = useSessionStore((state) => state.profile);
  const notificationSettings = useNotificationSettings(uid);
  const isFocused = useIsFocused();
  const isFocusedRef = useRef(isFocused);
  isFocusedRef.current = isFocused;
  const [editingUid, setEditingUid] = useState<string | null>(null);
  useEffect(() => {
    setEditingUid(null);
  }, [uid]);
  const [signingOut, setSigningOut] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<BackendErrorCode | null>(null);
  const [needsReauth, setNeedsReauth] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState(false);
  const [animatePhotoError, setAnimatePhotoError] = useState(false);
  const [animateDeleteError, setAnimateDeleteError] = useState(false);
  const [animateDeleteReauth, setAnimateDeleteReauth] = useState(false);

  // Saves a new photo (a local uri) or removes the current one (null), then updates my card.
  const savePhoto = async (localUri: string | null) => {
    if (!uid || !profile || photoBusy) return;
    setPhotoError(false);
    setAnimatePhotoError(false);
    setPhotoBusy(true);
    try {
      const photoPath = await backend.setProfilePhoto(uid, localUri);
      useSessionStore.getState().updateProfile({ ...profile, photoPath });
    } catch {
      setPhotoError(true);
      setAnimatePhotoError(isFocusedRef.current);
    } finally {
      setPhotoBusy(false);
    }
  };

  const choosePhoto = async () => {
    if (photoBusy) return;
    setPhotoError(false);
    setAnimatePhotoError(false);
    let localUri: string | null;
    try {
      localUri = await pickPhoto();
    } catch {
      setPhotoError(true);
      setAnimatePhotoError(isFocusedRef.current);
      return;
    }
    if (localUri) await savePhoto(localUri);
  };

  const signOut = async () => {
    setSigningOut(true);
    try {
      await backend.signOut();
    } catch {
      setSigningOut(false);
    }
  };

  const openDeletePanel = () => {
    setDeleteError(null);
    setNeedsReauth(false);
    setAnimateDeleteError(false);
    setAnimateDeleteReauth(false);
    setConfirmingDelete(true);
  };

  const cancelDelete = () => {
    if (deleting) return;
    setConfirmingDelete(false);
  };

  const deleteAccount = async () => {
    if (!uid || deleting) return;
    setDeleteError(null);
    setNeedsReauth(false);
    setAnimateDeleteError(false);
    setAnimateDeleteReauth(false);

    // Delete nothing without a fresh sign-in: the Auth call would fail anyway, and the copy
    // tells the person to sign out and back in.
    if (needsRecentSignIn(backend.lastSignInAt(), Date.now())) {
      setNeedsReauth(true);
      setAnimateDeleteReauth(isFocusedRef.current);
      return;
    }

    setDeleting(true);
    try {
      await backend.deleteAccount(uid);
      // On success the session ends and routing takes the user to /welcome by itself.
    } catch (error) {
      const { code } = toBackendError(error);
      setDeleteError(code);
      setAnimateDeleteError(isFocusedRef.current);
      if (code === 'requires_recent_login') setNeedsReauth(true);
      if (code === 'requires_recent_login') setAnimateDeleteReauth(isFocusedRef.current);
      setDeleting(false);
    }
  };

  return (
    <DsScreen
      keyboardAware={editingUid === uid}
      keyboardDismissMode="on-drag"
      contentContainerStyle={styles.container}
      scheme={scheme}
      testID="profile-screen"
    >
      <View style={styles.header}>
        <Text
          accessibilityRole="header"
          style={[DsTypography.title, { color: ds.color.textPrimary }]}
        >
          {t('profile.title')}
        </Text>
        <Text style={[DsTypography.body, { color: ds.color.textSecondary }]}>
          {t('profile.subtitle')}
        </Text>
      </View>

      {profile ? (
        <>
          {uid && editingUid === uid ? (
            <ProfileEditor
              key={uid}
              uid={uid}
              profile={profile}
              scheme={scheme}
              active={isFocused}
              onClose={() => setEditingUid(null)}
            />
          ) : (
            <DsPillButton
              label={t('profile.edit.title')}
              scheme={scheme}
              testID="profile-edit"
              variant="secondary"
              disabled={photoBusy || deleting}
              onPress={() => setEditingUid(uid ?? null)}
            />
          )}
          <DsCard scheme={scheme} style={styles.card}>
            <ProfilePhoto
              path={profile.photoPath}
              name={profile.displayName}
              shape="arch"
              scheme={scheme}
              style={{ width: 160, aspectRatio: 3 / 4, alignSelf: 'center' }}
              testID="profile-photo"
            />
            <DsPillButton
              disabled={photoBusy || editingUid === uid}
              label={profile.photoPath ? t('photo.change') : t('photo.add')}
              onPress={() => void choosePhoto()}
              scheme={scheme}
              testID="profile-photo-change"
              variant="secondary"
            />
            {profile.photoPath ? (
              <DsMotionPressable
                accessibilityRole="button"
                disabled={photoBusy || editingUid === uid}
                onPress={() => void savePhoto(null)}
                style={styles.textButton}
                testID="profile-photo-remove"
              >
                <Text style={[DsTypography.caption, { color: ds.color.danger }]}>
                  {t('photo.remove')}
                </Text>
              </DsMotionPressable>
            ) : null}
            {photoBusy ? (
              <Text
                style={[DsTypography.caption, { color: ds.color.textSecondary }]}
                testID="profile-photo-saving"
              >
                {t('photo.saving')}
              </Text>
            ) : null}
            {photoError ? (
              animatePhotoError ? (
                <DsMotionView testID="profile-photo-error-motion" variant="reveal">
                  <Text
                    accessibilityRole="alert"
                    style={[DsTypography.caption, { color: ds.color.danger }]}
                    testID="profile-photo-error"
                  >
                    {t('photo.error')}
                  </Text>
                </DsMotionView>
              ) : (
                <Text
                  accessibilityRole="alert"
                  style={[DsTypography.caption, { color: ds.color.danger }]}
                  testID="profile-photo-error"
                >
                  {t('photo.error')}
                </Text>
              )
            ) : null}

            <Text
              style={[DsTypography.title, { color: ds.color.textPrimary }]}
              testID="profile-card-name"
            >
              {profile.displayName}, {t('profile.age', { age: profile.age })}
            </Text>
            <Text style={[DsTypography.caption, { color: ds.color.accentPrimary }]}>
              {t(`onboarding.vibe.${profile.vibe}`)}
            </Text>
            {profile.unionMember ? (
              <View
                style={[
                  styles.badge,
                  { backgroundColor: ds.color.surfaceMuted, borderColor: ds.color.border },
                ]}
              >
                <Text style={[DsTypography.micro, { color: ds.color.textPrimary }]}>
                  {profile.union
                    ? `${t('discover.union_badge')} · ${t(`onboarding.union.${profile.union}`)}`
                    : t('discover.union_badge')}
                </Text>
              </View>
            ) : null}
          </DsCard>

          <DsCard scheme={scheme} style={styles.card}>
            <Text style={[DsTypography.micro, { color: ds.color.accentPrimary }]}>
              {t('discover.values_label')}
            </Text>
            <View style={styles.valuesRow}>
              {profile.values.map((value) => (
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
          </DsCard>

          <DsCard scheme={scheme} style={styles.card}>
            <Text style={[DsTypography.micro, { color: ds.color.accentPrimary }]}>
              {t(`onboarding.prompt.${profile.promptId}`)}
            </Text>
            <Text style={[DsTypography.body, { color: ds.color.textPrimary }]}>
              {profile.promptAnswer}
            </Text>
          </DsCard>
        </>
      ) : null}

      <NotificationSettings {...notificationSettings} motionActive={isFocused} />

      {confirmingDelete ? (
        <DsMotionView testID="profile-delete-motion" variant="scale">
          <DsCard
            scheme={scheme}
            style={styles.card}
            testID="profile-delete-panel"
            variant="warning"
          >
            <Text style={[DsTypography.cardTitle, { color: ds.color.textPrimary }]}>
              {t('profile.delete.title')}
            </Text>
            <Text style={[DsTypography.body, { color: ds.color.textSecondary }]}>
              {t('profile.delete.body')}
            </Text>
            {deleteError ? (
              animateDeleteError ? (
                <DsMotionView
                  key={deleteError}
                  testID="profile-delete-error-motion"
                  variant="reveal"
                >
                  <Text
                    accessibilityRole="alert"
                    style={[DsTypography.body, { color: ds.color.danger }]}
                    testID="profile-delete-error"
                  >
                    {t('profile.delete.error')}
                  </Text>
                </DsMotionView>
              ) : (
                <Text
                  accessibilityRole="alert"
                  style={[DsTypography.body, { color: ds.color.danger }]}
                  testID="profile-delete-error"
                >
                  {t('profile.delete.error')}
                </Text>
              )
            ) : null}
            {needsReauth ? (
              animateDeleteReauth ? (
                <DsMotionView testID="profile-delete-reauth-motion" variant="reveal">
                  <Text
                    style={[DsTypography.body, { color: ds.color.textPrimary }]}
                    testID="profile-delete-reauth"
                  >
                    {t('profile.delete.reauth')}
                  </Text>
                </DsMotionView>
              ) : (
                <Text
                  style={[DsTypography.body, { color: ds.color.textPrimary }]}
                  testID="profile-delete-reauth"
                >
                  {t('profile.delete.reauth')}
                </Text>
              )
            ) : null}
            <DsPillButton
              disabled={deleting}
              label={t('profile.delete.confirm')}
              loading={deleting}
              onPress={() => void deleteAccount()}
              scheme={scheme}
              testID="profile-delete-confirm"
              variant="primary"
            />
            <DsPillButton
              disabled={deleting}
              label={t('profile.delete.cancel')}
              onPress={cancelDelete}
              scheme={scheme}
              testID="profile-delete-cancel"
              variant="ghost"
            />
          </DsCard>
        </DsMotionView>
      ) : (
        <DsPillButton
          label={t('profile.delete_account')}
          onPress={openDeletePanel}
          scheme={scheme}
          testID="profile-delete-account"
          variant="ghost"
        />
      )}

      <DsPillButton
        label={t('profile.sign_out')}
        loading={signingOut}
        onPress={() => void signOut()}
        scheme={scheme}
        testID="profile-sign-out"
        variant="ghost"
      />
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
  badge: {
    alignSelf: 'flex-start',
    borderRadius: DsRadius.pill,
    borderWidth: 1,
    paddingHorizontal: DsSpace.sm,
    paddingVertical: DsSpace.xxs,
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
  textButton: {
    alignSelf: 'center',
    paddingVertical: DsSpace.xxs,
  },
});
