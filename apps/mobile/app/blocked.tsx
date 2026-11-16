import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DsMotionView } from '@/components/ds/motion/DsMotionView';
import { DsBackButton } from '@/components/ds/primitives/DsBackButton';
import { DsCard } from '@/components/ds/primitives/DsCard';
import { DsPillButton } from '@/components/ds/primitives/DsPillButton';
import { DsScreen } from '@/components/ds/primitives/DsScreen';
import { DsSpace, DsTypography, getDsTheme } from '@/constants/design-system';
import { useSessionStore } from '@/features/auth/session-store';
import { ProfilePhoto } from '@/features/profile/ProfilePhoto';
import { safetyErrorKey } from '@/features/safety/safety';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTranslation } from '@/localization';
import { backend } from '@/services/backend';
import { toBackendError, type BackendErrorCode } from '@/services/backend/errors';
import type { BlockedPerson } from '@/services/backend/types';

/**
 * The people I blocked, with an inline Unblock confirm on each row. Unblocking removes only
 * my two block documents: reports stay, matches are not recreated, and a block they made
 * on me stays in place.
 */
export default function BlockedScreen() {
  const colorScheme = useColorScheme();
  const scheme = colorScheme === 'dark' ? 'dark' : 'light';
  const ds = getDsTheme(scheme);
  const { t } = useTranslation();
  const router = useRouter();
  const uid = useSessionStore((state) => state.user?.uid);
  const [people, setPeople] = useState<BlockedPerson[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<BackendErrorCode | null>(null);

  useEffect(() => {
    if (!uid) return;
    let active = true;
    backend
      .listBlocked(uid)
      .then((list) => {
        if (active) setPeople(list);
      })
      .catch(() => {
        if (active) setLoadFailed(true);
      });
    return () => {
      active = false;
    };
  }, [uid]);

  const unblock = async (id: string) => {
    if (!uid || busyId) return;
    setBusyId(id);
    setErrorCode(null);
    try {
      await backend.unblockUser(uid, id);
      setPeople((list) => list?.filter((person) => person.id !== id) ?? null);
      setConfirmingId(null);
    } catch (error) {
      setErrorCode(toBackendError(error).code);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <DsScreen contentContainerStyle={styles.container} scheme={scheme} testID="blocked-screen">
      <View style={styles.header}>
        <DsBackButton
          accessibilityLabel={t('blocked.back')}
          onPress={() => router.back()}
          scheme={scheme}
          testID="blocked-back"
        />
        <Text
          accessibilityRole="header"
          style={[DsTypography.title, { color: ds.color.textPrimary }]}
        >
          {t('blocked.title')}
        </Text>
        <Text style={[DsTypography.body, { color: ds.color.textSecondary }]}>
          {t('blocked.subtitle')}
        </Text>
      </View>

      {errorCode ? (
        <Text
          accessibilityRole="alert"
          style={[DsTypography.body, { color: ds.color.danger }]}
          testID="blocked-error"
        >
          {t(safetyErrorKey(errorCode))}
        </Text>
      ) : null}

      {loadFailed ? (
        <DsCard scheme={scheme} style={styles.card}>
          <Text
            accessibilityRole="alert"
            style={[DsTypography.body, { color: ds.color.textPrimary }]}
            testID="blocked-load-error"
          >
            {t('blocked.error')}
          </Text>
        </DsCard>
      ) : people === null ? (
        <DsCard scheme={scheme}>
          <Text style={[DsTypography.body, { color: ds.color.textSecondary }]}>
            {t('blocked.loading')}
          </Text>
        </DsCard>
      ) : people.length === 0 ? (
        <DsCard scheme={scheme} style={styles.card} testID="blocked-empty">
          <Text style={[DsTypography.cardTitle, { color: ds.color.textPrimary }]}>
            {t('blocked.empty.title')}
          </Text>
          <Text style={[DsTypography.body, { color: ds.color.textSecondary }]}>
            {t('blocked.empty.body')}
          </Text>
        </DsCard>
      ) : (
        people.map((person) => (
          <BlockedRow
            busy={busyId === person.id}
            confirming={confirmingId === person.id}
            key={person.id}
            onCancel={() => setConfirmingId(null)}
            onConfirm={() => void unblock(person.id)}
            onStart={() => setConfirmingId(person.id)}
            person={person}
            scheme={scheme}
          />
        ))
      )}
    </DsScreen>
  );
}

type BlockedRowProps = {
  busy: boolean;
  confirming: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onStart: () => void;
  person: BlockedPerson;
  scheme: 'light' | 'dark';
};

function BlockedRow({
  busy,
  confirming,
  onCancel,
  onConfirm,
  onStart,
  person,
  scheme,
}: BlockedRowProps) {
  const ds = getDsTheme(scheme);
  const { t } = useTranslation();
  const name = person.displayName ?? t('blocked.unknown_name');

  return (
    <DsCard scheme={scheme} style={styles.card} testID={`blocked-row-${person.id}`}>
      <View style={styles.row}>
        <ProfilePhoto
          name={name}
          path={person.photoPath}
          scheme={scheme}
          shape="circle"
          style={{ width: 48 }}
          testID={`blocked-photo-${person.id}`}
        />
        <Text style={[DsTypography.cardTitle, styles.rowName, { color: ds.color.textPrimary }]}>
          {name}
        </Text>
      </View>
      {confirming ? (
        <DsMotionView testID={`blocked-unblock-motion-${person.id}`} variant="scale">
          <View style={styles.card}>
            <Text style={[DsTypography.cardTitle, { color: ds.color.textPrimary }]}>
              {t('blocked.unblock.title')}
            </Text>
            <Text style={[DsTypography.body, { color: ds.color.textSecondary }]}>
              {t('blocked.unblock.body')}
            </Text>
            <DsPillButton
              disabled={busy}
              label={t('blocked.unblock.confirm')}
              loading={busy}
              onPress={onConfirm}
              scheme={scheme}
              testID={`blocked-unblock-confirm-${person.id}`}
              variant="primary"
            />
            <DsPillButton
              disabled={busy}
              label={t('blocked.unblock.cancel')}
              onPress={onCancel}
              scheme={scheme}
              testID={`blocked-unblock-cancel-${person.id}`}
              variant="ghost"
            />
          </View>
        </DsMotionView>
      ) : (
        <DsPillButton
          label={t('blocked.unblock')}
          onPress={onStart}
          scheme={scheme}
          testID={`blocked-unblock-${person.id}`}
          variant="secondary"
        />
      )}
    </DsCard>
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
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: DsSpace.sm,
  },
  rowName: {
    flex: 1,
  },
});
