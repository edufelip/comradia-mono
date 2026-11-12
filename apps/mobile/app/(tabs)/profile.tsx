import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { DsCard } from '@/components/ds/primitives/DsCard';
import { DsPillButton } from '@/components/ds/primitives/DsPillButton';
import { DsScreen } from '@/components/ds/primitives/DsScreen';
import { DsRadius, DsSpace, DsTypography, getDsTheme } from '@/constants/design-system';
import { useSessionStore } from '@/features/auth/session-store';
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
  const [signingOut, setSigningOut] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<BackendErrorCode | null>(null);
  const [needsReauth, setNeedsReauth] = useState(false);

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

    // Delete nothing without a fresh sign-in: the Auth call would fail anyway, and the copy
    // tells the person to sign out and back in.
    if (needsRecentSignIn(backend.lastSignInAt(), Date.now())) {
      setNeedsReauth(true);
      return;
    }

    setDeleting(true);
    try {
      await backend.deleteAccount(uid);
      // On success the session ends and routing takes the user to /welcome by itself.
    } catch (error) {
      const { code } = toBackendError(error);
      setDeleteError(code);
      if (code === 'requires_recent_login') setNeedsReauth(true);
      setDeleting(false);
    }
  };

  return (
    <DsScreen contentContainerStyle={styles.container} scheme={scheme} testID="profile-screen">
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
          <DsCard scheme={scheme} style={styles.card}>
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

      {confirmingDelete ? (
        <DsCard scheme={scheme} style={styles.card} testID="profile-delete-panel" variant="warning">
          <Text style={[DsTypography.cardTitle, { color: ds.color.textPrimary }]}>
            {t('profile.delete.title')}
          </Text>
          <Text style={[DsTypography.body, { color: ds.color.textSecondary }]}>
            {t('profile.delete.body')}
          </Text>
          {deleteError ? (
            <Text
              accessibilityRole="alert"
              style={[DsTypography.body, { color: ds.color.danger }]}
              testID="profile-delete-error"
            >
              {t('profile.delete.error')}
            </Text>
          ) : null}
          {needsReauth ? (
            <Text
              style={[DsTypography.body, { color: ds.color.textPrimary }]}
              testID="profile-delete-reauth"
            >
              {t('profile.delete.reauth')}
            </Text>
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
});
