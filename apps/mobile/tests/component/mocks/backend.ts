/**
 * In-memory stand-in for `@/services/backend` (wired in tests/component/setup.ts).
 * Tests drive it through `fakeBackend`: sign a user in, seed profiles, make the next
 * call fail, and inspect what the screen wrote.
 */
import type { DiscoveryProfile, PublicProfile } from '@/features/profile/profile-schema';
import { BackendError, type BackendErrorCode } from '@/services/backend/errors';
import { matchIdFor, otherUid } from '@/services/backend/shared';
import type {
  AuthUser,
  Backend,
  ChatMessage,
  Match,
  OnboardingDocuments,
  ReportInput,
  SwipeDirection,
} from '@/services/backend/types';

type Listener = (user: AuthUser | null) => void;
type MatchesListener = { uid: string; listener: (matches: Match[]) => void };
type MessagesListener = { matchId: string; listener: (messages: ChatMessage[]) => void };

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
    /** `${from}->${to}` for every like. Seed one with `likeFrom(from, to)`. */
    likes: new Set<string>(),
    /** matchId -> createdAt (epoch ms). */
    matches: new Map<string, number>(),
    messages: new Map<string, ChatMessage[]>(),
    /** Uids the signed-in user blocked (or reported, which also blocks). */
    blocked: new Set<string>(),
    /** Every report written, in order. */
    reports: [] as ReportInput[],
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

  const matchesListeners = new Set<MatchesListener>();
  const messagesListeners = new Set<MessagesListener>();
  let clock = 1_700_000_000_000;
  let messageSeq = 0;

  const matchesOf = (uid: string): Match[] => {
    const out: Match[] = [];
    state.matches.forEach((createdAt, id) => {
      if (!id.split('_').includes(uid)) return;
      const otherId = otherUid(id, uid);
      const profile = state.profiles.get(otherId);
      if (profile) out.push({ id, other: { id: otherId, ...profile }, createdAt });
    });
    return out.sort((a, b) => b.createdAt - a.createdAt);
  };
  const notifyMatches = () =>
    matchesListeners.forEach(({ uid, listener }) => listener(matchesOf(uid)));
  const notifyMessages = (matchId: string) =>
    messagesListeners.forEach((l) => {
      if (l.matchId === matchId) l.listener([...(state.messages.get(matchId) ?? [])]);
    });
  const createMatch = (a: string, b: string) => {
    const id = matchIdFor(a, b);
    if (!state.matches.has(id)) {
      state.matches.set(id, (clock += 1000));
      notifyMatches();
    }
    return id;
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
    async like(uid, targetId) {
      record('like', [uid, targetId]);
      state.swipes.push({ uid, targetId, direction: 'like' });
      state.likes.add(`${uid}->${targetId}`);
      if (!state.likes.has(`${targetId}->${uid}`)) return { matched: false };
      return { matched: true, matchId: createMatch(uid, targetId) };
    },
    async reconcileMatches(uid) {
      record('reconcileMatches', [uid]);
      state.likes.forEach((key) => {
        const [from, to] = key.split('->');
        if (to === uid && state.likes.has(`${uid}->${from}`)) createMatch(uid, from);
      });
    },
    onMatches(uid, listener, onError) {
      const code = state.failNext.get('onMatches');
      if (code) {
        state.failNext.delete('onMatches');
        onError();
        return () => {};
      }
      const entry = { uid, listener };
      matchesListeners.add(entry);
      listener(matchesOf(uid));
      return () => {
        matchesListeners.delete(entry);
      };
    },
    async getMatch(uid, matchId) {
      record('getMatch', [uid, matchId]);
      return matchesOf(uid).find((m) => m.id === matchId) ?? null;
    },
    onMessages(matchId, listener, onError) {
      const code = state.failNext.get('onMessages');
      if (code) {
        state.failNext.delete('onMessages');
        onError();
        return () => {};
      }
      const entry = { matchId, listener };
      messagesListeners.add(entry);
      listener([...(state.messages.get(matchId) ?? [])]);
      return () => {
        messagesListeners.delete(entry);
      };
    },
    async sendMessage(uid, matchId, text) {
      record('sendMessage', [uid, matchId, text]);
      const list = state.messages.get(matchId) ?? [];
      list.push({ id: `m${(messageSeq += 1)}`, from: uid, text, createdAt: (clock += 1000) });
      state.messages.set(matchId, list);
      notifyMessages(matchId);
    },
    async blockUser(uid, targetId) {
      record('blockUser', [uid, targetId]);
      state.blocked.add(targetId);
    },
    async reportUser(uid, input) {
      record('reportUser', [uid, input]);
      state.reports.push(input);
      state.blocked.add(input.targetId);
    },
    async listBlockedUids(uid) {
      record('listBlockedUids', [uid]);
      return [...state.blocked];
    },
    lastSignInAt() {
      record('lastSignInAt', []);
      return Date.now();
    },
    async deleteAccount(uid) {
      record('deleteAccount', [uid]);
      state.profiles.delete(uid);
      state.accounts.delete(uid);
      state.swipes = state.swipes.filter((swipe) => swipe.uid !== uid);
      emit(null);
    },
  };

  return {
    backend,
    state,
    /** Simulates Firebase restoring or ending a session. */
    emit,
    callsTo: (method: keyof Backend) => state.calls.filter((c) => c.method === method),
    /** Records that `from` already liked `to` (the next like back makes a match). */
    likeFrom(from: string, to: string) {
      state.likes.add(`${from}->${to}`);
    },
    /** Delivers a message as if the other person sent it. */
    receiveMessage(matchId: string, from: string, text: string) {
      const list = state.messages.get(matchId) ?? [];
      list.push({ id: `m${(messageSeq += 1)}`, from, text, createdAt: (clock += 1000) });
      state.messages.set(matchId, list);
      notifyMessages(matchId);
    },
    reset() {
      listeners.clear();
      matchesListeners.clear();
      messagesListeners.clear();
      state.likes.clear();
      state.matches.clear();
      state.messages.clear();
      state.blocked.clear();
      state.reports = [];
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
