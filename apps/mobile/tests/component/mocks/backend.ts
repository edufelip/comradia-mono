/**
 * In-memory stand-in for `@/services/backend` (wired in tests/component/setup.ts).
 * Tests drive it through `fakeBackend`: sign a user in, seed profiles, make the next
 * call fail, and inspect what the screen wrote.
 */
import type { DiscoveryProfile, PublicProfile } from '@/features/profile/profile-schema';
import { BackendError, type BackendErrorCode } from '@/services/backend/errors';
import type {
  AuthUser,
  Backend,
  OnboardingDocuments,
  SwipeDirection,
} from '@/services/backend/types';

type Listener = (user: AuthUser | null) => void;

export const TEST_USER: AuthUser = {
  uid: 'test-user',
  phoneNumber: '+5511987654321',
  email: null,
  displayName: null,
};

export const TEST_PROFILE: PublicProfile = {
  displayName: 'Ana',
  age: 29,
  vibe: 'bookworm',
  lookingFor: 'everyone',
  unionMember: true,
  union: 'apeoesp',
  values: ['bookshops_coffee', 'tenant_rights', 'cycling'],
  promptId: 'perfect_sunday',
  promptAnswer: 'Feira, then a long lunch.',
};

function createFakeBackend() {
  const listeners = new Set<Listener>();
  const state = {
    user: null as AuthUser | null,
    appleAvailable: false,
    profiles: new Map<string, PublicProfile>(),
    accounts: new Map<string, OnboardingDocuments['account']>(),
    swipes: [] as { uid: string; targetId: string; direction: SwipeDirection }[],
    pendingPhone: null as string | null,
    /** Accepted by confirmPhoneCode. */
    validCode: '123456',
    /** The next call to the named method rejects with this code. */
    failNext: new Map<keyof Backend, BackendErrorCode>(),
    calls: [] as { method: keyof Backend; args: unknown[] }[],
  };

  const record = (method: keyof Backend, args: unknown[]) => {
    state.calls.push({ method, args });
    const code = state.failNext.get(method);
    if (code) {
      state.failNext.delete(method);
      throw new BackendError(code);
    }
  };

  const emit = (user: AuthUser | null) => {
    state.user = user;
    listeners.forEach((l) => l(user));
  };

  const backend: Backend = {
    onAuthChanged(listener) {
      listeners.add(listener);
      listener(state.user);
      return () => {
        listeners.delete(listener);
      };
    },
    async isAppleSignInAvailable() {
      return state.appleAvailable;
    },
    async signInWithApple() {
      record('signInWithApple', []);
      emit(TEST_USER);
    },
    async signInWithGoogle() {
      record('signInWithGoogle', []);
      emit(TEST_USER);
    },
    async startPhoneSignIn(phone) {
      record('startPhoneSignIn', [phone]);
      state.pendingPhone = phone;
    },
    async confirmPhoneCode(code) {
      record('confirmPhoneCode', [code]);
      if (!state.pendingPhone) throw new BackendError('no_pending_code');
      if (code !== state.validCode) throw new BackendError('invalid_code');
      const phoneNumber = state.pendingPhone;
      state.pendingPhone = null;
      emit({ ...TEST_USER, phoneNumber });
    },
    async signOut() {
      record('signOut', []);
      emit(null);
    },
    async getProfile(uid) {
      record('getProfile', [uid]);
      return state.profiles.get(uid) ?? null;
    },
    async saveOnboarding(uid, docs) {
      record('saveOnboarding', [uid, docs]);
      state.profiles.set(uid, docs.profile);
      state.accounts.set(uid, docs.account);
    },
    async listDiscovery(uid) {
      record('listDiscovery', [uid]);
      const swiped = new Set(state.swipes.filter((s) => s.uid === uid).map((s) => s.targetId));
      const out: DiscoveryProfile[] = [];
      state.profiles.forEach((p, id) => {
        if (id !== uid && !swiped.has(id)) out.push({ id, ...p });
      });
      return out;
    },
    async recordSwipe(uid, targetId, direction) {
      record('recordSwipe', [uid, targetId, direction]);
      state.swipes.push({ uid, targetId, direction });
    },
  };

  return {
    backend,
    state,
    /** Simulates Firebase restoring or ending a session. */
    emit,
    callsTo: (method: keyof Backend) => state.calls.filter((c) => c.method === method),
    reset() {
      listeners.clear();
      state.user = null;
      state.appleAvailable = false;
      state.profiles.clear();
      state.accounts.clear();
      state.swipes = [];
      state.pendingPhone = null;
      state.validCode = '123456';
      state.failNext.clear();
      state.calls = [];
    },
  };
}

export const fakeBackend = createFakeBackend();
