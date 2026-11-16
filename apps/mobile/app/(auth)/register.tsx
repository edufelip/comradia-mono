import {
  AppleAuthenticationButton,
  AppleAuthenticationButtonStyle,
  AppleAuthenticationButtonType,
} from 'expo-apple-authentication';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DsMotionPressable } from '@/components/ds/motion/DsMotionPressable';
import { DsMotionView } from '@/components/ds/motion/DsMotionView';
import { DsBackButton } from '@/components/ds/primitives/DsBackButton';
import { DsPillButton } from '@/components/ds/primitives/DsPillButton';
import { DsLayout, DsRadius, DsSpace, DsTypography, getDsTheme } from '@/constants/design-system';
import { AuthError, type AuthErrorCode } from '@/features/auth/components/auth-error';
import { PhoneField } from '@/features/auth/components/phone-field';
import { formatBR, toE164BR } from '@/features/auth/phone';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTranslation } from '@/localization';
import { backend } from '@/services/backend';
import { toBackendError } from '@/services/backend/errors';

type BusyAction = 'apple' | 'google' | 'phone';

/**
 * S1B: Apple (iPhone only), Google, or a Brazilian phone number. Signing in only changes
 * the session store; routing moves the user (docs/architecture.md, "Routing").
 * `mode=login` switches the copy, never the behaviour.
 */
export default function RegisterScreen() {
  const colorScheme = useColorScheme();
  const scheme = colorScheme === 'dark' ? 'dark' : 'light';
  const ds = getDsTheme(scheme);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string | string[] }>();
  const mode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const isLogin = mode === 'login';

  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState<BusyAction | null>(null);
  const [errorCode, setErrorCode] = useState<AuthErrorCode | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const previousMode = useRef(isLogin);
  const [modeChanged, setModeChanged] = useState(false);

  const e164 = toE164BR(phone);

  useEffect(() => {
    let active = true;
    backend
      .isAppleSignInAvailable()
      .then((available) => {
        if (active) setAppleAvailable(available);
      })
      .catch(() => {
        if (active) setAppleAvailable(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useLayoutEffect(() => {
    if (previousMode.current === isLogin) return;
    previousMode.current = isLogin;
    setModeChanged(true);
  }, [isLogin]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/welcome');
  };

  const runProvider = async (action: 'apple' | 'google') => {
    if (busy) return;
    setBusy(action);
    setErrorCode(null);
    try {
      // On success the session store changes and routing takes over; there is nothing
      // to navigate to from here.
      await (action === 'apple' ? backend.signInWithApple() : backend.signInWithGoogle());
    } catch (error) {
      const { code } = toBackendError(error);
      if (code !== 'cancelled') setErrorCode(code);
    } finally {
      setBusy(null);
    }
  };

  const handleSendCode = async () => {
    if (busy || !e164) return;
    setBusy('phone');
    setErrorCode(null);
    try {
      await backend.startPhoneSignIn(e164);
      router.push({ pathname: '/verify-phone', params: { phone: e164 } });
    } catch (error) {
      const { code } = toBackendError(error);
      if (code !== 'cancelled') setErrorCode(code);
    } finally {
      setBusy(null);
    }
  };

  const handleSwitchMode = () => {
    setErrorCode(null);
    router.setParams({ mode: isLogin ? 'signup' : 'login' });
  };

  const heading = (
    <>
      <Text style={[DsTypography.eyebrow, styles.step, { color: ds.color.accentText }]}>
        {isLogin ? t('auth.step_login') : t('auth.step')}
      </Text>

      <Text
        accessibilityRole="header"
        style={[DsTypography.display, styles.title, { color: ds.color.textPrimary }]}
      >
        {isLogin ? t('auth.title_login') : t('auth.title')}
      </Text>

      <Text style={[DsTypography.body, styles.lede, { color: ds.color.textSecondary }]}>
        {isLogin ? t('auth.lede_login') : t('auth.lede')}
      </Text>
    </>
  );

  const sendCodeButton = (
    <DsPillButton
      contentColor={ds.color.onAccent}
      disabled={!e164 || (busy !== null && busy !== 'phone')}
      label={t('auth.send_code')}
      loading={busy === 'phone'}
      onPress={() => void handleSendCode()}
      scheme={scheme}
      style={[styles.sendButton, e164 ? { backgroundColor: ds.color.accentPrimary } : null]}
      testID="register-send-code"
      variant="primary"
    />
  );

  return (
    <View style={[styles.screen, { backgroundColor: ds.color.canvas }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + DsSpace.xl, paddingTop: insets.top + DsSpace.sm },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View>
          <DsBackButton
            accessibilityLabel={t('auth.back')}
            onPress={handleBack}
            scheme={scheme}
            testID="register-back"
          />

          {modeChanged ? (
            <DsMotionView
              key={isLogin ? 'login' : 'signup'}
              testID="register-heading-motion"
              variant="slide"
            >
              {heading}
            </DsMotionView>
          ) : (
            heading
          )}
        </View>

        <View style={styles.form}>
          {appleAvailable ? (
            <View style={styles.appleWrap}>
              <AppleAuthenticationButton
                buttonStyle={
                  scheme === 'dark'
                    ? AppleAuthenticationButtonStyle.WHITE
                    : AppleAuthenticationButtonStyle.BLACK
                }
                buttonType={
                  isLogin
                    ? AppleAuthenticationButtonType.CONTINUE
                    : AppleAuthenticationButtonType.SIGN_IN
                }
                cornerRadius={DsLayout.controlHeight / 2}
                onPress={() => void runProvider('apple')}
                style={styles.appleButton}
                testID="register-apple"
              />
              {busy === 'apple' ? (
                <View
                  pointerEvents="none"
                  style={[styles.appleLoading, { backgroundColor: ds.color.overlayNeutral }]}
                  testID="register-apple-loading"
                >
                  <ActivityIndicator color={ds.color.onAccent} size="small" />
                </View>
              ) : null}
            </View>
          ) : null}

          <DsPillButton
            disabled={busy !== null && busy !== 'google'}
            label={t('auth.google')}
            loading={busy === 'google'}
            onPress={() => void runProvider('google')}
            scheme={scheme}
            style={styles.googleButton}
            testID="register-google"
            variant="outline"
          />

          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: ds.color.border }]} />
            <Text style={[DsTypography.eyebrow, { color: ds.color.textTertiary }]}>
              {t('auth.or_phone')}
            </Text>
            <View style={[styles.dividerLine, { backgroundColor: ds.color.border }]} />
          </View>

          <PhoneField
            countryLabel={t('auth.country_code_label', { code: '+55' })}
            onChangeText={(next) => {
              setErrorCode(null);
              setPhone(formatBR(next));
            }}
            phoneLabel={t('auth.phone_label')}
            placeholder={t('auth.phone_placeholder')}
            scheme={scheme}
            testID="register-phone-input"
            value={phone}
          />

          {e164 ? (
            <DsMotionView testID="register-send-code-motion" variant="scale">
              {sendCodeButton}
            </DsMotionView>
          ) : (
            sendCodeButton
          )}

          {errorCode ? (
            <DsMotionView key={errorCode} testID="register-error-motion" variant="reveal">
              <AuthError code={errorCode} scheme={scheme} testID="register-error" />
            </DsMotionView>
          ) : null}
        </View>

        <View style={styles.footer}>
          <Text style={[DsTypography.caption, { color: ds.color.textSecondary }]}>
            {t('auth.privacy')}
          </Text>
          <Text style={[DsTypography.caption, { color: ds.color.textSecondary }]}>
            {t('auth.terms')}
          </Text>
          <DsMotionPressable
            accessibilityRole="link"
            feedbackScale={0.985}
            onPress={handleSwitchMode}
            style={styles.switchMode}
            testID="register-switch-mode"
          >
            <Text style={[DsTypography.button, { color: ds.color.accentText }]}>
              {isLogin ? t('auth.switch_to_signup') : t('auth.switch_to_login')}
            </Text>
          </DsMotionPressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: DsLayout.screenGutter,
  },
  step: {
    marginTop: DsSpace.lg,
  },
  title: {
    marginTop: DsSpace.xs,
  },
  lede: {
    marginTop: DsSpace.xs,
  },
  form: {
    gap: DsSpace.sm,
    marginTop: DsSpace.xl,
  },
  appleWrap: {
    height: DsLayout.controlHeight,
    position: 'relative',
  },
  appleButton: {
    height: DsLayout.controlHeight,
    width: '100%',
  },
  appleLoading: {
    alignItems: 'center',
    borderRadius: DsRadius.pill,
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  googleButton: {
    minHeight: DsLayout.controlHeight,
  },
  divider: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: DsSpace.sm,
    marginVertical: DsSpace.xxs,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  sendButton: {
    minHeight: DsLayout.fieldHeight,
    marginTop: DsSpace.xxs,
  },
  footer: {
    gap: DsSpace.xs,
    marginTop: 'auto',
    paddingTop: DsSpace.xl,
  },
  switchMode: {
    alignSelf: 'flex-start',
    minHeight: DsLayout.minTouchTarget,
    justifyContent: 'center',
  },
});
