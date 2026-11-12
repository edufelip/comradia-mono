const ERROR_TYPES = new Set([
  'Error',
  'TypeError',
  'FirebaseError',
  'NativeFirebaseError',
  'BackendError',
]);

/** Development diagnostics deliberately omit messages, credentials and user input. */
export function phoneFailureSummary(error: unknown): { sdkCode: string | null; errorType: string } {
  const fallback = { sdkCode: null, errorType: 'Error' };
  try {
    if (typeof error !== 'object' || error === null) return fallback;
    const code = 'code' in error ? error.code : null;
    const name = 'name' in error ? error.name : null;
    return {
      sdkCode: typeof code === 'string' && /^auth\/[a-z][a-z0-9-]{0,80}$/.test(code) ? code : null,
      errorType: typeof name === 'string' && ERROR_TYPES.has(name) ? name : 'Error',
    };
  } catch {
    return fallback;
  }
}
