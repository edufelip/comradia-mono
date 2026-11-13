import { fakeBackend, TEST_PROFILE, TEST_USER } from '../component/mocks/backend';
import { useSessionStore } from '@/features/auth/session-store';
import { useDiscoveryStore } from '@/features/discovery/discovery-store';
import { useOnboardingStore } from '@/features/onboarding/onboarding-store';
import { BackendError, type BackendErrorCode } from '@/services/backend/errors';
import type { Backend } from '@/services/backend/types';
const boot =
  typeof window === 'undefined'
    ? { id: '' }
    : ((window as any).__COMRADIA_ATLAS_BOOT__ ?? { id: '' });
export const portrait =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><rect width="300" height="400" fill="#fce8e9"/><circle cx="150" cy="145" r="65" fill="#8c444b"/><path d="M30 400Q30 230 150 230Q270 230 270 400" fill="#8c444b"/></svg>',
  );
const base = fakeBackend.backend;
export const backend: Backend = { ...base, photoUrl: async () => portrait };
const holds = new Map<string, Array<() => void>>();
const activeHolds = new Set<string>();
const activeFailures = new Map<string, BackendErrorCode>();
for (const [method, original] of Object.entries(base)) {
  if (['onAuthChanged', 'onMatches', 'onMessages', 'lastSignInAt'].includes(method)) continue;
  (backend as any)[method] = async (...args: any[]) => {
    if (activeHolds.has(method))
      await new Promise<void>((resolve) =>
        holds.set(method, [...(holds.get(method) ?? []), resolve]),
      );
    const failure = activeFailures.get(method);
    if (failure) {
      activeFailures.delete(method);
      throw new BackendError(failure);
    }
    return (original as any)(...args);
  };
}
backend.photoUrl = async () => portrait;
let expired = false;
backend.lastSignInAt = () => (expired ? Date.now() - 600000 : Date.now());
for (const method of ['onMatches', 'onMessages'] as const) {
  (backend as any)[method] = (...args: any[]) => {
    if (activeFailures.has(method)) {
      activeFailures.delete(method);
      queueMicrotask(() => args[2]());
      return () => {};
    }
    if (activeHolds.has(method)) {
      let closed = false;
      holds.set(method, [
        ...(holds.get(method) ?? []),
        () => {
          if (!closed) (base[method] as any)(...args);
        },
      ]);
      return () => {
        closed = true;
      };
    }
    return (base[method] as any)(...args);
  };
}
function initialize() {
  fakeBackend.reset();
  const id = boot.id as string;
  const [flow, state] = id.split('.');
  const onboarding = [
    '05-onboarding-basics',
    '06-onboarding-values',
    '07-onboarding-starter',
  ].includes(flow);
  const auth =
    ['02-welcome', '03-registration', '04-verification'].includes(flow) ||
    (flow === '01-entry' && state === 'signed-out');
  fakeBackend.state.profiles.set(TEST_USER.uid, { ...TEST_PROFILE });
  fakeBackend.state.profiles.set('maya', {
    ...TEST_PROFILE,
    displayName: 'Maya',
    age: 28,
    vibe: 'creative',
    photoPath: 'photos/maya/fixture.jpg',
  });
  fakeBackend.state.profiles.set('lucas', {
    ...TEST_PROFILE,
    displayName: 'Lucas',
    age: 31,
    unionMember: false,
    union: null,
    photoPath: null,
  });
  if (
    onboarding ||
    (flow === '01-entry' && state === 'onboarding') ||
    (flow === '04-verification' && state === 'success')
  )
    fakeBackend.state.profiles.delete(TEST_USER.uid);
  if (['10-match', '11-matches', '12-chat', '14-safety'].includes(flow))
    fakeBackend.state.matches.set('maya_test-user', 1700000000000);
  if (flow === '11-matches' && state === 'ready')
    fakeBackend.state.matches.set('lucas_test-user', 1700000002000);
  if (flow === '12-chat' && state === 'history')
    fakeBackend.state.messages.set('maya_test-user', [
      {
        id: 'history-me',
        from: TEST_USER.uid,
        text: 'Hello Maya, the garden sounds lovely.',
        createdAt: 1699999999000,
      },
    ]);
  if (flow === '12-chat' && !['empty', 'missing'].includes(state))
    fakeBackend.receiveMessage('maya_test-user', 'maya', 'Shall we visit the community garden?');
  if (
    (flow === '08-discovery' && ['empty', 'refresh'].includes(state)) ||
    (flow === '11-matches' && state === 'empty')
  ) {
    if (flow === '08-discovery') {
      fakeBackend.state.profiles.delete('maya');
      fakeBackend.state.profiles.delete('lucas');
    } else fakeBackend.state.matches.clear();
  }
  if (flow === '10-match' && state === 'fallbacks') {
    fakeBackend.state.profiles.set('maya', {
      ...TEST_PROFILE,
      displayName: 'Maya',
      values: ['cycling', 'food_markets', 'pets_parks'],
      photoPath: null,
    });
    fakeBackend.state.profiles.set(TEST_USER.uid, {
      ...TEST_PROFILE,
      values: ['climate_outdoors', 'public_transit', 'tenant_rights'],
    });
  }
  if ((flow === '10-match' || flow === '12-chat') && state === 'missing')
    fakeBackend.state.matches.clear();
  if (flow === '01-entry' && state === 'loading') activeHolds.add('getProfile');
  if (flow === '01-entry' && state === 'profile-error') activeFailures.set('getProfile', 'network');
  if (state === 'loading')
    activeHolds.add(
      flow === '08-discovery' ? 'listDiscovery' : flow === '11-matches' ? 'onMatches' : 'getMatch',
    );
  if (flow === '08-discovery' && ['read-error', 'retry'].includes(state))
    activeFailures.set('listDiscovery', 'network');
  if (flow === '10-match' && state === 'error') activeFailures.set('getMatch', 'network');
  if (flow === '11-matches' && state === 'error') activeFailures.set('onMatches', 'network');
  if (flow === '12-chat' && state === 'read-error') activeFailures.set('onMessages', 'network');
  if (flow === '12-chat' && state === 'closed') fakeBackend.state.blocked.add('maya');
  if (flow === '13-profile' && ['photo', 'photo-remove'].includes(state))
    fakeBackend.state.profiles.set(TEST_USER.uid, {
      ...TEST_PROFILE,
      photoPath: 'photos/test-user/fixture.jpg',
    });
  if (flow === '13-profile' && state === 'delete-reauth') expired = true;
  if (flow === '11-matches' && ['live-arrival', 'hidden-arrival'].includes(state)) {
    fakeBackend.state.matches.clear();
    fakeBackend.state.matches.set('lucas_test-user', 1699999999000);
  }
  if (flow === '13-profile' && state === 'missing') activeHolds.add('getProfile');
  const saved =
    typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem('atlas-persist');
  if (saved) {
    const parsed = JSON.parse(saved);
    for (const [key, entries] of Object.entries(parsed))
      (((fakeBackend.state as any)[key] as Map<string, unknown>).clear(),
        (entries as any[]).forEach(([id, value]) =>
          (fakeBackend.state as any)[key].set(id, value),
        ));
  }
  fakeBackend.state.pendingPhone = '+5511999990000';
  fakeBackend.state.user = auth ? null : TEST_USER;
  if (onboarding && !(flow === '05-onboarding-basics' && state === 'default')) {
    const store = useOnboardingStore.getState();
    // State data only: production stores and screen validation remain in control.
    useOnboardingStore.setState({
      ...(store as any),
      displayName: 'Ana',
      birthDateInput: '14/03/1994',
      vibe: 'bookworm',
      lookingFor: 'everyone',
      unionMember: false,
      union: null,
      values:
        flow === '06-onboarding-values' ? [] : ['bookshops_coffee', 'tenant_rights', 'cycling'],
      promptId: 'perfect_sunday',
      promptAnswer: '',
      photoUri: null,
      sharedPassionWeight: 60,
    } as any);
  }
}
initialize();
export const atlasController = {
  ready: true,
  async pushSafety() {
    const { router } = await import('expo-router');
    router.push('/safety/maya?context=profile');
  },
  async pushMatch() {
    const { router } = await import('expo-router');
    router.push('/match/maya_test-user');
  },
  async pushChat() {
    const { router } = await import('expo-router');
    router.push('/chat/maya_test-user');
  },
  async pushCover() {
    const { router } = await import('expo-router');
    router.push('/safety/maya?context=chat');
  },
  async back() {
    const { router } = await import('expo-router');
    router.back();
  },
  profileMissing() {
    useSessionStore.setState({ profile: null, status: 'ready' });
  },
  persist() {
    const data = Object.fromEntries(
      ['profiles', 'matches', 'messages'].map((k) => [k, [...(fakeBackend.state as any)[k]]]),
    );
    sessionStorage.setItem('atlas-persist', JSON.stringify(data));
  },
  addPeer() {
    fakeBackend.state.profiles.set('zoe', { ...TEST_PROFILE, displayName: 'Zoe', age: 26 });
    void useDiscoveryStore.getState().load(backend, TEST_USER.uid);
  },
  block() {
    fakeBackend.state.blocked.add('maya');
  },
  hold(method: string) {
    activeHolds.add(method);
  },
  release(method: string) {
    activeHolds.delete(method);
    for (const done of holds.get(method) ?? []) done();
    holds.delete(method);
  },
  fail(method: string, code: BackendErrorCode = 'network') {
    activeFailures.set(method, code);
  },
  incoming() {
    fakeBackend.receiveMessage('maya_test-user', 'maya', 'A new message from Maya.');
  },
  match() {
    fakeBackend.likeFrom('maya', TEST_USER.uid);
    fakeBackend.likeFrom(TEST_USER.uid, 'maya');
    void base.reconcileMatches(TEST_USER.uid);
  },
  switchAccount() {
    const user = { ...TEST_USER, uid: 'other' };
    fakeBackend.state.profiles.set('other', { ...TEST_PROFILE, displayName: 'Other' });
    fakeBackend.emit(user);
  },
  switchBack() {
    fakeBackend.emit(TEST_USER);
  },
  signIn() {
    fakeBackend.emit(TEST_USER);
  },
  sessionError() {
    useSessionStore.getState().setProfileError(TEST_USER);
  },
  setPhoto() {
    fakeBackend.state.profiles.set(TEST_USER.uid, {
      ...TEST_PROFILE,
      photoPath: 'photos/test-user/fixture.jpg',
    });
    useSessionStore
      .getState()
      .updateProfile({ ...TEST_PROFILE, photoPath: 'photos/test-user/fixture.jpg' });
  },
  calls() {
    return fakeBackend.state.calls.map((c) => c.method);
  },
};
if (typeof window !== 'undefined') (window as any).__COMRADIA_ATLAS__ = atlasController;
