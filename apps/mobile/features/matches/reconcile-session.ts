const reconciledUids = new Set<string>();

/** Returns true once per uid for the lifetime of the app process. */
export function markReconciliationForSession(uid: string): boolean {
  if (reconciledUids.has(uid)) return false;
  reconciledUids.add(uid);
  return true;
}

/** A failed repair may run again on the next open. */
export function forgetReconciliationForSession(uid: string): void {
  reconciledUids.delete(uid);
}

/** Component tests start a fresh app session for each test. */
export function resetReconciliationSession(): void {
  reconciledUids.clear();
}
