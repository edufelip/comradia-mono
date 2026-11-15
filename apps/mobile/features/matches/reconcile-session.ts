const reconciledUids = new Set<string>();

/** Returns true once per uid for the lifetime of the app process. */
export function markReconciliationForSession(uid: string): boolean {
  if (reconciledUids.has(uid)) return false;
  reconciledUids.add(uid);
  return true;
}

/** Component tests start a fresh app session for each test. */
export function resetReconciliationSession(): void {
  reconciledUids.clear();
}
