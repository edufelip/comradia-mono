import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { DsMotionView } from '@/components/ds/motion/DsMotionView';
import { DsCard } from '@/components/ds/primitives/DsCard';
import { DsPillButton } from '@/components/ds/primitives/DsPillButton';
import { DsSpace, DsTypography, getDsTheme } from '@/constants/design-system';
import { MAX_AGE, MIN_AGE, VIBES, type Vibe } from '@/features/profile/profile-schema';
import { useTranslation } from '@/localization';
import { DEFAULT_DISCOVERY_FILTERS, type DiscoveryFilters } from './discovery-filters';

type Props = {
  filters: DiscoveryFilters;
  scheme: 'light' | 'dark';
  busy: boolean;
  active: boolean;
  onApply: (filters: DiscoveryFilters) => void;
  onCancel: () => void;
};

export function DiscoveryFilterPanel({ filters, scheme, busy, active, onApply, onCancel }: Props) {
  const { t } = useTranslation();
  const ds = getDsTheme(scheme);
  const [minAge, setMinAge] = useState(String(filters.minAge));
  const [maxAge, setMaxAge] = useState(String(filters.maxAge));
  const [vibe, setVibe] = useState<Vibe | null>(filters.vibe);
  const [invalid, setInvalid] = useState(false);
  const apply = () => {
    const min = Number(minAge);
    const max = Number(maxAge);
    if (
      !/^\d+$/.test(minAge) ||
      !/^\d+$/.test(maxAge) ||
      min < MIN_AGE ||
      max > MAX_AGE ||
      min > max
    ) {
      setInvalid(true);
      return;
    }
    if (!busy) onApply({ minAge: min, maxAge: max, vibe });
  };
  const inputStyle = [
    styles.input,
    { backgroundColor: ds.color.surfaceMuted, color: ds.color.textPrimary },
  ];
  return (
    <DsMotionView active={active} variant="reveal" testID="discover-filters-panel">
      <DsCard scheme={scheme} style={styles.panel}>
        <Text
          accessibilityRole="header"
          style={[DsTypography.cardTitle, { color: ds.color.textPrimary }]}
        >
          {t('discover.filters.title')}
        </Text>
        <Text style={[DsTypography.caption, { color: ds.color.textSecondary }]}>
          {t('discover.filters.scope')}
        </Text>
        <View style={styles.row}>
          <View style={styles.age}>
            <Text style={{ color: ds.color.textPrimary }}>{t('discover.filters.min_age')}</Text>
            <TextInput
              accessibilityLabel={t('discover.filters.min_age')}
              editable={!busy}
              keyboardType="number-pad"
              maxLength={2}
              onChangeText={setMinAge}
              style={inputStyle}
              testID="discover-filter-min-age"
              value={minAge}
            />
          </View>
          <View style={styles.age}>
            <Text style={{ color: ds.color.textPrimary }}>{t('discover.filters.max_age')}</Text>
            <TextInput
              accessibilityLabel={t('discover.filters.max_age')}
              editable={!busy}
              keyboardType="number-pad"
              maxLength={2}
              onChangeText={setMaxAge}
              style={inputStyle}
              testID="discover-filter-max-age"
              value={maxAge}
            />
          </View>
        </View>
        <View style={styles.choices}>
          <DsPillButton
            disabled={busy}
            fullWidth={false}
            label={t('discover.filters.any_vibe')}
            onPress={() => setVibe(null)}
            scheme={scheme}
            selected={vibe === null}
            testID="discover-filter-vibe-any"
            contentColor={ds.color.textPrimary}
            variant="outline"
          />
          {VIBES.map((choice) => (
            <DsPillButton
              disabled={busy}
              fullWidth={false}
              key={choice}
              label={t(`onboarding.vibe.${choice}`)}
              onPress={() => setVibe(choice)}
              scheme={scheme}
              selected={vibe === choice}
              testID={`discover-filter-vibe-${choice}`}
              contentColor={ds.color.textPrimary}
              variant="outline"
            />
          ))}
        </View>
        {invalid ? (
          <Text
            accessibilityRole="alert"
            style={{ color: ds.color.danger }}
            testID="discover-filters-error"
          >
            {t('discover.filters.invalid')}
          </Text>
        ) : null}
        <DsPillButton
          disabled={busy}
          label={t('discover.filters.apply')}
          onPress={apply}
          scheme={scheme}
          testID="discover-filters-apply"
        />
        <DsPillButton
          disabled={busy}
          label={t('discover.filters.reset')}
          onPress={() => onApply({ ...DEFAULT_DISCOVERY_FILTERS })}
          scheme={scheme}
          testID="discover-filters-reset"
          variant="secondary"
        />
        <DsPillButton
          label={t('discover.filters.cancel')}
          onPress={onCancel}
          scheme={scheme}
          testID="discover-filters-cancel"
          variant="ghost"
        />
      </DsCard>
    </DsMotionView>
  );
}
const styles = StyleSheet.create({
  panel: { gap: DsSpace.sm },
  row: { flexDirection: 'row', gap: DsSpace.sm },
  age: { flex: 1, gap: DsSpace.xs },
  input: { minHeight: 48, borderRadius: 12, padding: 12, fontSize: 18 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: DsSpace.xs },
});
