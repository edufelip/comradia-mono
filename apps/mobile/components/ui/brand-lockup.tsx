import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import {
  DsRadius,
  DsSpace,
  DsTypography,
  type DsColorScheme,
  getDsTheme,
} from '@/constants/design-system';
import { useTranslation } from '@/localization';

/** The Comradia mark with the wordmark beside it. */
export function BrandLockup({ scheme }: { scheme: DsColorScheme }) {
  const { t } = useTranslation();
  const theme = getDsTheme(scheme);

  return (
    <View style={styles.row}>
      <Image
        accessibilityLabel={t('a11y.brand_logo')}
        contentFit="contain"
        source={require('../../assets/images/logo.svg')}
        style={styles.mark}
      />
      <Text style={[styles.wordmark, { color: theme.color.textPrimary }]}>Comradia</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row', gap: DsSpace.sm },
  mark: { borderRadius: DsRadius.sm, height: 32, overflow: 'hidden', width: 32 },
  wordmark: { ...DsTypography.screenTitle },
});
