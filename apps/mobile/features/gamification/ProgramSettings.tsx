import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { DsPillButton } from '@/components/ds/primitives/DsPillButton';
import { DsSpace, DsTypography, getDsTheme, type DsColorScheme } from '@/constants/design-system';
import { useTranslation } from '@/localization';
import type { PreferenceUpdate } from '@/services/gamification/types';
import { useGamification } from './provider';

export function ProgramSettings({
  scheme,
  pauseOnly = false,
}: {
  scheme: DsColorScheme;
  pauseOnly?: boolean;
}) {
  const { client, programEligible, preferences } = useGamification();
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const running = useRef(false);
  if (!programEligible) return null;
  const paused = (preferences.pausedUntil?.toMillis() ?? 0) > Date.now();

  async function change(update: PreferenceUpdate) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError(false);
    try {
      await client.setPreferences(update);
    } catch {
      setError(true);
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  const label = pauseOnly
    ? t(paused ? 'gam.resume' : 'gam.pause')
    : t(preferences.optedOut ? 'gam.enable' : 'gam.disable');
  const next = pauseOnly ? { pauseWeeks: paused ? 0 : 1 } : { optedOut: !preferences.optedOut };
  return (
    <View style={{ gap: DsSpace.xs }}>
      <DsPillButton
        scheme={scheme}
        variant="ghost"
        label={label}
        disabled={busy}
        onPress={() => {
          void change(next);
        }}
        testID={pauseOnly ? 'gam-streak-pause' : 'gam-opt-out'}
      />
      {error && (
        <Text
          accessibilityRole="alert"
          style={[DsTypography.body, { color: getDsTheme(scheme).color.textPrimary }]}
        >
          {t('gam.failed')}
        </Text>
      )}
    </View>
  );
}
