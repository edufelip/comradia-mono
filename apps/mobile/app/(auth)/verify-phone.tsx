import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DsMotionPressable } from '@/components/ds/motion/DsMotionPressable';
import { DsMotionView } from '@/components/ds/motion/DsMotionView';
import { DsBackButton } from '@/components/ds/primitives/DsBackButton';
import { DsPillButton } from '@/components/ds/primitives/DsPillButton';
import { DsLayout, DsSpace, DsTypography, getDsTheme } from '@/constants/design-system';
import { AuthError, type AuthErrorCode } from '@/features/auth/components/auth-error';
import { CodeField } from '@/features/auth/components/code-field';
import { formatBR, toE164BR } from '@/features/auth/phone';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTranslation } from '@/localization';
import { backend } from '@/services/backend';
import { toBackendError } from '@/services/backend/errors';

const CODE_LENGTH = 6;
const RESEND_SECONDS = 30;

/**
 * S1C: the 6-digit SMS code. A correct code signs the user in and routing takes the
 * screen away; this screen never navigates on success (docs/architecture.md, "Routing").
 */
export default function VerifyPhoneScreen() {
  const colorScheme = useColorScheme();
  const scheme = colorScheme === 'dark' ? 'dark' : 'light';
  const ds = getDsTheme(scheme);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ phone?: string | string[] }>();
  const rawPhone = Array.isArray(params.phone) ? params.phone[0] : params.phone;
  const phone = rawPhone ? toE164BR(rawPhone) : null;

  const [code, setCode] = useState('');
  const [errorCode, setErrorCode] = useState<AuthErrorCode | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const [busy, setBusy] = useState<'verify' | 'resend' | null>(null);
  const busyRef = useRef(false);

  // One interval for the whole countdown, cleared on unmount and when it reaches zero.
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setInterval(() => setSecondsLeft((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => clearInterval(timer);
  }, [secondsLeft <= 0]);

  const goBackToRegister = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/register');
  };

  const confirm = async (digits: string) => {
    if (!phone || busyRef.current) return;
    busyRef.current = true;
    setBusy('verify');
    setErrorCode(null);
    try {
      await backend.confirmPhoneCode(digits);
    } catch (error) {
      const { code: failure } = toBackendError(error);
      if (failure !== 'cancelled') setErrorCode(failure);
      setCode('');
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  };

  const handleChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setErrorCode(null);
    setCode(digits);
    if (digits.length === CODE_LENGTH) void confirm(digits);
  };

  const handleResend = async () => {
    if (!phone || busy) return;
    setBusy('resend');
    setErrorCode(null);
    try {
      await backend.startPhoneSignIn(phone);
      setCode('');
      setSecondsLeft(RESEND_SECONDS);
    } catch (error) {
      const { code: failure } = toBackendError(error);
      if (failure !== 'cancelled') setErrorCode(failure);
    } finally {
      setBusy(null);
    }
  };

  // A deep link without a usable number has nothing to verify.
  if (!phone) return <Redirect href="/register" />;

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
            onPress={goBackToRegister}
            scheme={scheme}
            testID="verify-back"
          />

          <Text style={[DsTypography.eyebrow, styles.step, { color: ds.color.accentText }]}>
            {t('verify.step')}
          </Text>

          <Text
            accessibilityRole="header"
            style={[DsTypography.display, styles.title, { color: ds.color.textPrimary }]}
          >
            {t('verify.title')}
          </Text>

          <View style={styles.sentToRow}>
            <Text style={[DsTypography.body, { color: ds.color.textSecondary }]}>
              {t('verify.sent_to', { phone: formatBR(phone) })}
            </Text>
            <DsMotionPressable
              accessibilityRole="link"
              feedbackScale={0.985}
              onPress={goBackToRegister}
              style={styles.edit}
              testID="verify-edit"
            >
              <Text style={[DsTypography.button, { color: ds.color.accentText }]}>
                {t('verify.edit')}
              </Text>
            </DsMotionPressable>
          </View>
        </View>

        <View style={styles.form}>
          <CodeField
            label={t('verify.code_label')}
            onChangeText={handleChange}
            scheme={scheme}
            testID="verify-code-input"
            value={code}
          />

          {errorCode ? (
            <DsMotionView key={errorCode} testID="verify-error-motion" variant="reveal">
              <AuthError code={errorCode} scheme={scheme} testID="verify-error" />
            </DsMotionView>
          ) : null}

          <DsPillButton
            contentColor={ds.color.onAccent}
            disabled={code.length !== CODE_LENGTH}
            label={t('verify.submit')}
            loading={busy === 'verify'}
            onPress={() => void confirm(code)}
            scheme={scheme}
            style={[
              styles.submit,
              code.length === CODE_LENGTH ? { backgroundColor: ds.color.accentPrimary } : null,
            ]}
            testID="verify-submit"
            variant="primary"
          />
        </View>

        <View style={styles.resend}>
          {secondsLeft > 0 ? (
            <Text
              style={[DsTypography.body, styles.resendWait, { color: ds.color.textSecondary }]}
              testID="verify-resend-countdown"
            >
              {t('verify.resend_in', { seconds: secondsLeft })}
            </Text>
          ) : (
            <DsPillButton
              label={t('verify.resend')}
              loading={busy === 'resend'}
              onPress={() => void handleResend()}
              scheme={scheme}
              size="sm"
              style={styles.resendButton}
              testID="verify-resend"
              variant="ghost"
            />
          )}
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
  sentToRow: {
    gap: DsSpace.xxs,
    marginTop: DsSpace.xs,
  },
  edit: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    minHeight: DsLayout.minTouchTarget,
  },
  form: {
    gap: DsSpace.sm,
    marginTop: DsSpace.xl,
  },
  submit: {
    height: DsLayout.fieldHeight,
  },
  resend: {
    alignItems: 'center',
    marginTop: 'auto',
    paddingTop: DsSpace.xl,
  },
  resendWait: {
    textAlign: 'center',
  },
  resendButton: {
    minHeight: DsLayout.minTouchTarget,
  },
});
