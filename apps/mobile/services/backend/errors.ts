export type BackendErrorCode =
  | 'cancelled'
  | 'invalid_phone'
  | 'invalid_code'
  | 'code_expired'
  | 'no_pending_code'
  | 'too_many_requests'
  | 'requires_recent_login'
  | 'network'
  | 'unknown';

export class BackendError extends Error {
  constructor(
    readonly code: BackendErrorCode,
    cause?: unknown,
  ) {
    super(code);
    this.name = 'BackendError';
    this.cause = cause;
  }
}

const FIREBASE_CODES: Record<string, BackendErrorCode> = {
  'auth/invalid-phone-number': 'invalid_phone',
  'auth/missing-phone-number': 'invalid_phone',
  'auth/invalid-verification-code': 'invalid_code',
  'auth/missing-verification-code': 'invalid_code',
  'auth/code-expired': 'code_expired',
  'auth/session-expired': 'code_expired',
  'auth/too-many-requests': 'too_many_requests',
  'auth/quota-exceeded': 'too_many_requests',
  'auth/network-request-failed': 'network',
  // Deleting the account needs a sign-in newer than a few minutes.
  'auth/requires-recent-login': 'requires_recent_login',
  'auth/popup-closed-by-user': 'cancelled',
  'auth/cancelled-popup-request': 'cancelled',
  'auth/user-cancelled': 'cancelled',
  // @react-native-google-signin and expo-apple-authentication cancellations.
  SIGN_IN_CANCELLED: 'cancelled',
  '12501': 'cancelled',
  ERR_REQUEST_CANCELED: 'cancelled',
  ERR_CANCELED: 'cancelled',
};

/** Normalizes Firebase / Google / Apple errors so screens only handle BackendErrorCode. */
export function toBackendError(error: unknown): BackendError {
  if (error instanceof BackendError) return error;
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : '';
  return new BackendError(FIREBASE_CODES[code] ?? 'unknown', error);
}
