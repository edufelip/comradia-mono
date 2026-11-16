import type { TranslationKey } from '@/localization';
import type { BackendErrorCode } from '@/services/backend/errors';

/** The rules accept at most 500 characters of report details; the field stops there. */
export const REPORT_DETAILS_MAX = 500;

/** Firebase deletes an account only when the sign-in is newer than this. */
export const RECENT_LOGIN_WINDOW_MS = 5 * 60 * 1000;

/** The single place a block / report failure becomes user-facing copy. */
export function safetyErrorKey(code: BackendErrorCode): TranslationKey {
  switch (code) {
    case 'network':
      return 'safety.error.network';
    case 'too_many_requests':
      return 'safety.error.too_many_requests';
    case 'requires_recent_login':
      return 'safety.error.requires_recent_login';
    default:
      return 'safety.error.generic';
  }
}

/** Deletion needs a sign-in newer than `RECENT_LOGIN_WINDOW_MS`; null never qualifies. */
export function needsRecentSignIn(lastSignInAt: number | null, now: number): boolean {
  if (lastSignInAt === null) return true;
  return now - lastSignInAt > RECENT_LOGIN_WINDOW_MS;
}
