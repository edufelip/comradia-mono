import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DsPillButton } from '@/components/ds/primitives/DsPillButton';
import { DsFontFamily, DsTypography, getDsTheme } from '@/constants/design-system';
import { DateMapCard, FaceStack, SunBurst, TopoRings } from '@/features/welcome/welcome-art';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTranslation } from '@/localization';

export default function WelcomeScreen() {
  const colorScheme = useColorScheme();
  const scheme = colorScheme === 'dark' ? 'dark' : 'light';
  const ds = getDsTheme(scheme);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const handleStart = () => router.push('/register');
  const handleLogin = () => router.push({ pathname: '/register', params: { mode: 'login' } });

  return (
    <View style={[styles.screen, { backgroundColor: ds.color.canvas }]}>
      <View style={styles.sun}>
        <SunBurst />
      </View>
      <View style={styles.topo}>
        <TopoRings scheme={scheme} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 20, paddingTop: insets.top + 30 },
        ]}
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        <View>
          <Text style={[styles.location, { color: ds.color.textSecondary }]}>
            {t('welcome.location_city')} ·{' '}
            <Text style={{ color: ds.color.accentPrimary }}>{t('welcome.location_coords')}</Text>
            {'\n'}
            {t('welcome.conditions')}
          </Text>

          <Text
            accessibilityRole="header"
            style={[styles.headline, { color: ds.color.textPrimary }]}
          >
            {t('welcome.title_lead')}
            <Text style={{ color: ds.color.accentPrimary }}>{t('welcome.title_accent')}</Text>
          </Text>

          <Text style={[DsTypography.body, styles.lede, { color: ds.color.textSecondary }]}>
            {t('welcome.lede')}
          </Text>

          <View style={styles.map}>
            <DateMapCard
              caption={t('welcome.map_caption')}
              places={t('welcome.map_places')}
              scheme={scheme}
            />
          </View>
        </View>

        <View style={styles.bottom}>
          <View style={styles.faces}>
            <FaceStack scheme={scheme} />
            <Text style={[styles.socialProof, { color: ds.color.textSecondary }]}>
              <Text style={[styles.socialProofCount, { color: ds.color.textPrimary }]}>
                {t('welcome.social_proof_count')}
              </Text>{' '}
              {t('welcome.social_proof_rest')}
            </Text>
          </View>

          <DsPillButton
            contentColor={ds.color.onAccent}
            fullWidth
            label={`${t('welcome.cta_start')} →`}
            onPress={handleStart}
            scheme={scheme}
            style={[styles.cta, { backgroundColor: ds.color.accentPrimary }]}
            testID="welcome-cta-start"
            variant="primary"
          />

          <DsPillButton
            contentColor={ds.color.textSecondary}
            label={t('welcome.cta_login')}
            onPress={handleLogin}
            scheme={scheme}
            testID="welcome-cta-login"
            variant="ghost"
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    overflow: 'hidden',
  },
  sun: {
    pointerEvents: 'none',
    position: 'absolute',
    right: -108,
    top: -104,
    zIndex: 0,
  },
  topo: {
    bottom: 120,
    left: -90,
    opacity: 0.55,
    pointerEvents: 'none',
    position: 'absolute',
    zIndex: 0,
  },
  scroll: {
    flex: 1,
    zIndex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 22,
  },
  location: {
    fontFamily: DsFontFamily.mono,
    fontSize: 10.5,
    letterSpacing: 0.8,
    lineHeight: 16,
  },
  headline: {
    fontFamily: DsFontFamily.bold,
    fontSize: 40,
    letterSpacing: -1.6,
    lineHeight: 40,
    marginTop: 16,
  },
  lede: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
  },
  map: {
    marginTop: 14,
  },
  bottom: {
    gap: 10,
    marginTop: 'auto',
    paddingTop: 16,
    width: '100%',
  },
  faces: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  socialProof: {
    fontSize: 12,
    lineHeight: 16,
  },
  socialProofCount: {
    fontFamily: DsFontFamily.bold,
  },
  cta: {
    height: 52,
  },
});
