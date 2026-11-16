import { StyleSheet, Text } from 'react-native';

import { DsTypography, getDsTheme, type DsColorScheme } from '@/constants/design-system';
import { useTranslation, type TranslationKey } from '@/localization';
import type { BackendErrorCode } from '@/services/backend/errors';

/** Every failure the auth screens can show. `cancelled` is never displayed. */
export type AuthErrorCode = Exclude<BackendErrorCode, 'cancelled'>;

export function authErrorKey(code: AuthErrorCode): TranslationKey {
  return `auth.error.${code}`;
}

type AuthErrorProps = {
  code: AuthErrorCode | null;
  scheme: DsColorScheme;
  testID?: string;
};

/** The single place an auth failure becomes user-facing copy (docs/architecture.md, "Security"). */
export function AuthError({ code, scheme, testID }: AuthErrorProps) {
  const { t } = useTranslation();
  const ds = getDsTheme(scheme);

  if (!code) return null;

  return (
    <Text
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={[DsTypography.body, styles.text, { color: ds.color.danger }]}
      testID={testID}
    >
      {t(authErrorKey(code))}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    fontSize: 13,
    lineHeight: 18,
  },
});
