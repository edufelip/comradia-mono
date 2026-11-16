import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { DsPillButton } from '@/components/ds/primitives/DsPillButton';
import { DsTypography, getDsTheme } from '@/constants/design-system';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTranslation } from '@/localization';
import { backend } from '@/services/backend';

import { useSessionStore } from './session-store';

/** Shown when the user is signed in but their profile couldn't be read. */
export function SessionErrorView() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const ds = getDsTheme(scheme);
  const { t } = useTranslation();
  const user = useSessionStore((s) => s.user);
  const [busy, setBusy] = useState(false);

  const retry = async () => {
    if (!user) return;
    setBusy(true);
    try {
      useSessionStore.getState().setSignedIn(user, await backend.getProfile(user.uid));
    } catch {
      useSessionStore.getState().setProfileError(user);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: ds.color.canvas }]} testID="session-error">
      <Text
        accessibilityRole="header"
        style={[DsTypography.title, { color: ds.color.textPrimary }]}
      >
        {t('session.error.title')}
      </Text>
      <Text style={[DsTypography.body, { color: ds.color.textSecondary }]}>
        {t('session.error.body')}
      </Text>
      <DsPillButton
        label={t('session.error.retry')}
        loading={busy}
        onPress={retry}
        scheme={scheme}
        testID="session-error-retry"
      />
      <DsPillButton
        label={t('session.error.sign_out')}
        onPress={() => backend.signOut().catch(() => undefined)}
        scheme={scheme}
        testID="session-error-sign-out"
        variant="ghost"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: 16, justifyContent: 'center', padding: 24 },
});
