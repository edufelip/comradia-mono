import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DsMotionView } from '@/components/ds/motion/DsMotionView';
import { DsPillButton } from '@/components/ds/primitives/DsPillButton';
import {
  DsFontFamily,
  DsLayout,
  DsSpace,
  DsTypography,
  getDsTheme,
} from '@/constants/design-system';
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
        <DsMotionView testID="welcome-story-motion" variant="slide">
          <Text style={[DsTypography.eyebrow, { color: ds.color.textSecondary }]}>
            {t('welcome.location_city')} ·{' '}
            <Text style={{ color: ds.color.accentText }}>{t('welcome.location_coords')}</Text>
            {'\n'}
            {t('welcome.conditions')}
          </Text>

          <Text
            accessibilityRole="header"
            style={[DsTypography.hero, styles.headline, { color: ds.color.textPrimary }]}
          >
            {t('welcome.title_lead')}
            <Text style={{ color: ds.color.accentText }}>{t('welcome.title_accent')}</Text>
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
        </DsMotionView>

        <View style={styles.bottom}>
          <View style={styles.faces}>
            <FaceStack scheme={scheme} />
            <Text style={[DsTypography.caption, { color: ds.color.textSecondary }]}>
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
    paddingHorizontal: DsLayout.screenGutter,
  },
  headline: {
    marginTop: DsSpace.md,
  },
  lede: {
    marginTop: DsSpace.sm,
  },
  map: {
    marginTop: DsSpace.md,
  },
  bottom: {
    gap: DsSpace.sm,
    marginTop: 'auto',
    paddingTop: DsSpace.md,
    width: '100%',
  },
  faces: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: DsSpace.sm,
  },
  socialProofCount: {
    fontFamily: DsFontFamily.bold,
  },
  cta: {
    minHeight: DsLayout.fieldHeight,
  },
});
