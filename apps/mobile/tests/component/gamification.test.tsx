import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { randomUUID } from 'expo-crypto';
import { AppState, Linking, Platform, Text, type AppStateStatus } from 'react-native';
import CravosCelebrationScreen from '@/app/conquista/[id]';
import CravosWallet from '@/app/cravos';
import { useSessionStore } from '@/features/auth/session-store';
import { CelebrationBridge } from '@/features/gamification/CelebrationBridge';
import { ProgramSettings } from '@/features/gamification/ProgramSettings';
import { RatingBanner, useRatingBanner } from '@/features/store-rating/RatingBanner';
import { ratingReviewUrl } from '@/features/store-rating/eligibility';
import { GAM_FLAG_DEFAULTS, parseGamFlags, type GamFlags } from '@/features/gamification/flags';
import type { GamProjection } from '@/features/gamification/model';
import { GamificationProvider, useGamification } from '@/features/gamification/provider';
import type { GamificationClient } from '@/services/gamification/types';
import { TEST_PROFILE, TEST_USER } from './mocks/backend';

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: jest.fn(async () => '00000000'),
  randomUUID: jest.fn(() => 'feature-test-key'),
}));
const mockPush = jest.fn();
const mockBack = jest.fn();
let mockPath = '/matches';
let mockCelebrationId = 'moment';
jest.mock('expo-router', () => ({
  usePathname: () => mockPath,
  useLocalSearchParams: () => ({ id: mockCelebrationId }),
  Redirect: () => null,
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    back: mockBack,
    canGoBack: () => true,
  }),
}));
jest.mock('@/localization/get-device-locale', () => ({ getDeviceLocale: () => 'en-US' }));

beforeEach(() => {
  mockPath = '/matches';
  mockCelebrationId = 'moment';
  jest.spyOn(require('react-native-reanimated'), 'useReducedMotion').mockReturnValue(true);
});

const time = { toMillis: () => Date.parse('2026-11-25T12:00:00Z') };
const projection: GamProjection = {
  balance: 160,
  lifetimeNet: 305,
  levelHighWaterMark: 310,
  levelId: 'flor',
  streak: {
    currentWeeks: 2,
    recordWeeks: 4,
    qualifiedThisWeek: true,
    pausedUntil: null,
    pauseBank: 1,
  },
  quest: { questId: null, weekStart: '2026-11-23', progress: 0, target: 0, completedAt: null },
  updatedAt: time,
};

function fixture(start: Partial<GamFlags> = {}) {
  let flagListener: ((flags: GamFlags) => void) | undefined;
  const closeMember = jest.fn();
  const raw = { ...GAM_FLAG_DEFAULTS, gam_ui_enabled: true, gam_experiment_pct: 100, ...start };
  const flags = parseGamFlags((key) => String(raw[key]));
  const api: GamificationClient = {
    watchFlags: (receive) => {
      flagListener = receive;
      receive(flags);
      return () => {};
    },
    watchPreferences: (_uid, receive) => {
      receive({});
      return () => {};
    },
    setPreferences: async () => {},
    watchMember: jest.fn((_uid, receive) => {
      receive(projection);
      return closeMember;
    }),
    watchLedger: (_uid, receive) => {
      receive([]);
      return () => {};
    },
    watchAchievements: (_uid, receive) => {
      receive([{ id: 'faisca', tier: 0, unlockedAt: time, updatedAt: time, status: 'unlocked' }]);
      return () => {};
    },
    watchCelebrations: (_uid, receive) => {
      receive([]);
      return () => {};
    },
    watchCatalog: jest.fn((receive) => {
      receive([
        {
          id: 'coffee',
          title: 'Coffee',
          description: 'Partner reward',
          priceCravos: 20,
          stock: 1,
          kind: 'partner_funded',
          partner: 'Partner',
          active: true,
        },
      ]);
      return () => {};
    }),
    watchRedemptions: (_uid, receive) => {
      receive([]);
      return () => {};
    },
    markSeen: jest.fn(async () => {}),
    redeem: jest.fn(async () => ({
      ok: true as const,
      redemptionId: 'r1',
      code: 'PUBLIC-FIXTURE',
    })),
  };
  return {
    api,
    closeMember,
    flag: (updates: Partial<GamFlags>) => flagListener?.({ ...flags, ...updates }),
  };
}

function signIn() {
  useSessionStore.getState().setSignedIn(TEST_USER, TEST_PROFILE);
}

function Reader() {
  const { member, uid } = useGamification();
  return <Text>{uid ? `${uid}:${member?.balance ?? 'loading'}` : 'hidden'}</Text>;
}

it('clears private state and subscriptions on the kill switch and sign-out', async () => {
  signIn();
  const { api, closeMember, flag } = fixture();
  await render(
    <GamificationProvider client={api}>
      <Reader />
    </GamificationProvider>,
  );
  await screen.findByText(`${TEST_USER.uid}:160`);
  await act(() => flag({ gam_kill_switch: true }));
  expect(screen.getByText('hidden')).toBeOnTheScreen();
  expect(closeMember).toHaveBeenCalledTimes(1);
  await act(() => flag({ gam_kill_switch: false }));
  await screen.findByText(`${TEST_USER.uid}:160`);
  await act(() => useSessionStore.getState().setSignedOut());
  expect(screen.getByText('hidden')).toBeOnTheScreen();
  expect(closeMember).toHaveBeenCalledTimes(2);
});

it('shows only the treatment wallet, and replays unlocked badges', async () => {
  signIn();
  const { api, flag } = fixture({ gam_experiment_pct: 0 });
  await render(
    <GamificationProvider client={api}>
      <CravosWallet />
    </GamificationProvider>,
  );
  expect(screen.queryByTestId('gam-wallet')).toBeNull();
  expect(api.watchMember).not.toHaveBeenCalled();
  await act(() => flag({ gam_experiment_pct: 100 }));
  await screen.findByText('Flor');
  expect(screen.getByText('This week counts')).toBeOnTheScreen();
  expect(api.watchCatalog).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByTestId('gam-achievement-faisca'));
  await fireEvent.press(await screen.findByText('Replay'));
  expect(await screen.findByText('Achievement unlocked')).toBeOnTheScreen();
});

it('requires an explicit confirmation and a successful claim before showing a code', async () => {
  signIn();
  const { api } = fixture({ gam_redemption: true });
  await render(
    <GamificationProvider client={api}>
      <CravosWallet />
    </GamificationProvider>,
  );
  await fireEvent.press(await screen.findByTestId('gam-redeem-coffee'));
  expect(api.redeem).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByTestId('gam-redeem-confirm'));
  await waitFor(() => expect(api.redeem).toHaveBeenCalledWith('coffee', 'feature-test-key'));
  expect(await screen.findByText('Code: PUBLIC-FIXTURE')).toBeOnTheScreen();
});

it('reuses the claim key after an ambiguous failure and wallet remount', async () => {
  signIn();
  const { api } = fixture({ gam_redemption: true });
  const redeem = jest.mocked(api.redeem);
  redeem.mockRejectedValueOnce(new Error('connection lost'));
  jest.mocked(randomUUID).mockReturnValueOnce('original-attempt');
  const wallet = (
    <GamificationProvider client={api}>
      <CravosWallet />
    </GamificationProvider>
  );
  const first = await render(wallet);
  await fireEvent.press(await screen.findByTestId('gam-redeem-coffee'));
  await fireEvent.press(screen.getByTestId('gam-redeem-confirm'));
  await screen.findByRole('alert');
  expect(redeem).toHaveBeenLastCalledWith('coffee', 'original-attempt');
  await first.unmount();

  await render(wallet);
  await fireEvent.press(await screen.findByTestId('gam-redeem-coffee'));
  await fireEvent.press(screen.getByTestId('gam-redeem-confirm'));
  expect(await screen.findByText('Code: PUBLIC-FIXTURE')).toBeOnTheScreen();
  expect(redeem).toHaveBeenLastCalledWith('coffee', 'original-attempt');
});

it('shows a fresh wallet for an eligible member without a projection', async () => {
  signIn();
  const { api } = fixture();
  api.watchMember = (_uid, receive) => {
    receive(null, true);
    return () => {};
  };
  await render(
    <GamificationProvider client={api}>
      <CravosWallet />
    </GamificationProvider>,
  );
  expect(
    await screen.findByText('Your first Cravos arrive when you start a conversation.'),
  ).toBeOnTheScreen();
  expect(screen.getByText('Offline. Showing your saved balance.')).toBeOnTheScreen();
  expect(screen.getByText('Your streak is resting')).toBeOnTheScreen();
  await fireEvent.press(screen.getByTestId('gam-achievement-papo'));
  expect(await screen.findByText('Locked')).toBeOnTheScreen();
  expect(screen.queryByText('Replay')).toBeNull();
});

it('shows a completed level state at the top of the ladder', async () => {
  signIn();
  const { api } = fixture();
  api.watchMember = (_uid, receive) => {
    receive({ ...projection, levelId: 'primavera', levelHighWaterMark: 5000 });
    return () => {};
  };
  await render(
    <GamificationProvider client={api}>
      <CravosWallet />
    </GamificationProvider>,
  );
  expect(await screen.findByText('Primavera')).toBeOnTheScreen();
  expect(screen.queryByRole('progressbar', { name: '5000 lifetime Cravos' })).toBeNull();
});

it('retries a failed wallet subscription and clears the failure', async () => {
  signIn();
  const { api } = fixture();
  let calls = 0;
  api.watchMember = (_uid, receive, failed) => {
    if (calls++ === 0) failed(new Error('read failed'));
    else receive(projection);
    return () => {};
  };
  await render(
    <GamificationProvider client={api}>
      <CravosWallet />
    </GamificationProvider>,
  );
  await fireEvent.press(await screen.findByText('Try again'));
  expect(await screen.findByText('Flor')).toBeOnTheScreen();
});

it('routes basic program and streak preferences through the service', async () => {
  signIn();
  const { api } = fixture();
  api.setPreferences = jest.fn(async () => {});
  await render(
    <GamificationProvider client={api}>
      <ProgramSettings scheme="light" />
      <ProgramSettings scheme="light" pauseOnly />
    </GamificationProvider>,
  );
  await fireEvent.press(await screen.findByTestId('gam-streak-pause'));
  await fireEvent.press(screen.getByTestId('gam-opt-out'));
  expect(api.setPreferences).toHaveBeenCalledWith({ pauseWeeks: 1 });
  expect(api.setPreferences).toHaveBeenCalledWith({ optedOut: true });
});

it('shows a points toast on a safe route and acknowledges it when closed', async () => {
  signIn();
  const { api } = fixture();
  api.watchCelebrations = (_uid, receive) => {
    receive([
      {
        id: 'toast-1',
        kind: 'toast',
        copyKey: 'gam.toast.quest_completed',
        amount: 25,
        createdAt: { toMillis: () => Date.now() },
        seenAt: null,
      },
    ]);
    return () => {};
  };
  await render(
    <GamificationProvider client={api}>
      <CelebrationBridge />
    </GamificationProvider>,
  );
  expect(await screen.findByText('+25 Cravos')).toBeOnTheScreen();
  await fireEvent.press(screen.getByTestId('gam-points-toast-close'));
  await waitFor(() => expect(api.markSeen).toHaveBeenCalledWith(TEST_USER.uid, 'toast-1'));
});

it('keeps an older fullscreen badge out of the way until the member opens it', async () => {
  signIn();
  const { api } = fixture({ gam_fullscreen_celebrations: true });
  api.watchCelebrations = (_uid, receive) => {
    receive([
      {
        id: 'moment',
        kind: 'fullscreen',
        copyKey: 'gam.achievement.faisca',
        achievementId: 'faisca',
        achievementTier: 2,
        createdAt: { toMillis: () => Date.now() - 3000 },
        seenAt: null,
      },
    ]);
    return () => {};
  };
  await render(
    <GamificationProvider client={api}>
      <CelebrationBridge />
      <CravosCelebrationScreen />
    </GamificationProvider>,
  );
  expect(await screen.findByTestId('gam-celebration')).toBeOnTheScreen();
  expect(mockPush).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText('Close'));
  expect(mockBack).toHaveBeenCalledTimes(1);
  expect(api.markSeen).toHaveBeenCalledWith(TEST_USER.uid, 'moment');
});

it('opens the explicit store URL from the rating banner and closes it', async () => {
  const opened = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  const dismiss = jest.fn();
  const url = 'https://apps.apple.com/br/app/comradia/id1234?action=write-review';
  await render(
    <RatingBanner
      scheme="light"
      rating={{
        uid: TEST_USER.uid,
        url,
        dismiss,
        record: { firstSignInAt: 100, lastShownAt: 200, ratedTapAt: null },
      }}
    />,
  );
  await fireEvent.press(await screen.findByRole('button', { name: 'Rate' }));
  await waitFor(() => expect(opened).toHaveBeenCalledWith(url));
  await waitFor(() => expect(dismiss).toHaveBeenCalledTimes(1));
});

it('shows recorded transactions, the weekly goal and an unseen level without interrupting the wallet', async () => {
  signIn();
  const { api } = fixture();
  api.watchMember = (_uid, receive) => {
    receive({
      ...projection,
      balance: -50,
      quest: { ...projection.quest, questId: 'reply', target: 3, progress: 1 },
    });
    return () => {};
  };
  api.watchLedger = (_uid, receive) => {
    receive([
      {
        id: 'adjust',
        kind: 'adjust',
        amount: -50,
        createdAt: time,
        track: 'cravos',
        actor: 'admin',
        ruleId: 'admin_adjustment',
        ruleSetVersion: 1,
        source: { path: 'admin', event: 'adjust', eventId: 'adjust' },
      },
    ]);
    return () => {};
  };
  api.watchCelebrations = (_uid, receive) => {
    receive([
      {
        id: 'new-level',
        kind: 'fullscreen',
        copyKey: 'gam.level.up',
        levelId: 'flor',
        createdAt: time,
        seenAt: null,
      },
    ]);
    return () => {};
  };
  await render(
    <GamificationProvider client={api}>
      <CravosWallet />
    </GamificationProvider>,
  );
  expect(await screen.findByText(/Adjustment ·/)).toBeOnTheScreen();
  expect(screen.getByText('1 of 3 completed')).toBeOnTheScreen();
  expect(
    screen.getByText('Previous adjustments will be covered by future earnings.'),
  ).toBeOnTheScreen();
  expect(mockPush).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Level up' }));
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/conquista/[id]',
    params: { id: 'new-level' },
  });
  await fireEvent.press(screen.getByRole('button', { name: /^Close$/ }));
  expect(mockBack).toHaveBeenCalledTimes(1);
});

it('keeps the idempotency key through a network failure and preserves history', async () => {
  signIn();
  const { api } = fixture({ gam_redemption: true });
  jest.mocked(api.redeem).mockRejectedValueOnce(new Error('transient offline'));
  api.watchRedemptions = (uid, receive) => {
    receive([
      {
        id: 'previous',
        uid,
        itemId: 'coffee',
        status: 'fulfilled',
        cravos: 20,
        redeemEntryIds: ['previous'],
        code: 'OLD-FIXTURE',
        createdAt: time,
        fulfilledAt: time,
      },
    ]);
    return () => {};
  };
  await render(
    <GamificationProvider client={api}>
      <CravosWallet />
    </GamificationProvider>,
  );
  expect(await screen.findByText('Code: OLD-FIXTURE')).toBeOnTheScreen();
  await fireEvent.press(screen.getByTestId('gam-redeem-coffee'));
  await fireEvent.press(screen.getByTestId('gam-redeem-confirm'));
  expect(await screen.findByRole('alert')).toHaveTextContent('We couldn’t load your Cravos.');
  await fireEvent.press(screen.getByTestId('gam-redeem-confirm'));
  expect(await screen.findByText('Code: PUBLIC-FIXTURE')).toBeOnTheScreen();
  expect(jest.mocked(api.redeem).mock.calls).toEqual([
    ['coffee', 'feature-test-key'],
    ['coffee', 'feature-test-key'],
  ]);
});

it('defers the store link to the next Matches visit when the streak card is already present', async () => {
  const uid = 'rating-fixture';
  const listing = 'https://apps.apple.com/br/app/comradia/id1234';
  jest.replaceProperty(process, 'env', {
    ...process.env,
    EXPO_PUBLIC_COMRADIA_APP_STORE_URL: listing,
  });
  const storageKey = `comradia.rating.v1.${uid}`;
  const firstSignInAt = Date.now() - 9 * 86_400_000;
  await AsyncStorage.setItem(
    storageKey,
    JSON.stringify({ firstSignInAt, lastShownAt: null, ratedTapAt: null }),
  );
  function RatingSlot({ focused }: { focused: boolean }) {
    const rating = useRatingBanner(uid, focused, 1, true, ratingReviewUrl('ios', listing));
    return rating ? <RatingBanner scheme="light" rating={rating} /> : null;
  }
  const view = await render(<RatingSlot focused />);
  expect(screen.queryByTestId('store-rating-banner')).toBeNull();
  await act(async () => {
    await Promise.resolve();
  });
  await view.rerender(<RatingSlot focused={false} />);
  await view.rerender(<RatingSlot focused />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Not now' }));
  await waitFor(() => expect(screen.queryByTestId('store-rating-banner')).toBeNull());
  const persisted = await AsyncStorage.getItem(storageKey);
  expect(persisted).toContain('"lastShownAt":');
  expect(persisted).not.toContain('"lastShownAt":null');
});

it('shows a fresh fullscreen moment on Matches just once', async () => {
  signIn();
  const { api } = fixture({ gam_fullscreen_celebrations: true });
  api.watchCelebrations = (_uid, receive) => {
    const now = Date.now() + 100;
    receive(
      ['first', 'second'].map((id) => ({
        id,
        kind: 'fullscreen' as const,
        copyKey: 'gam.achievement.faisca',
        achievementId: 'faisca' as const,
        achievementTier: 2,
        createdAt: { toMillis: () => now },
        seenAt: null,
      })),
    );
    return () => {};
  };
  await render(
    <GamificationProvider client={api}>
      <CelebrationBridge />
    </GamificationProvider>,
  );
  await waitFor(() => expect(mockPush).toHaveBeenCalledTimes(1));
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/conquista/[id]', params: { id: 'first' } });
});

it('keeps the wallet hidden when account preference loading fails', async () => {
  signIn();
  const { api } = fixture();
  api.watchPreferences = (_uid, _receive, fail) => {
    fail(new Error('permission denied'));
    return () => {};
  };
  await render(
    <GamificationProvider client={api}>
      <Reader />
    </GamificationProvider>,
  );
  expect(screen.getByText('hidden')).toBeOnTheScreen();
  expect(api.watchMember).not.toHaveBeenCalled();
});

it('drops a rejected redemption response and allows selecting a reward again', async () => {
  signIn();
  const { api } = fixture({ gam_redemption: true });
  jest.mocked(api.redeem).mockResolvedValueOnce({ ok: false, reason: 'out_of_stock' });
  await render(
    <GamificationProvider client={api}>
      <CravosWallet />
    </GamificationProvider>,
  );
  await fireEvent.press(await screen.findByTestId('gam-redeem-coffee'));
  await fireEvent.press(screen.getByTestId('gam-redeem-confirm'));
  expect(await screen.findByRole('alert')).toBeOnTheScreen();
  await fireEvent.press(await screen.findByTestId('gam-redeem-sheet-close'));
  await waitFor(() => expect(screen.queryByTestId('gam-redeem-confirm')).toBeNull());
  await fireEvent.press(screen.getByTestId('gam-redeem-coffee'));
  await fireEvent.press(screen.getByTestId('gam-redeem-confirm'));
  expect(await screen.findByText('Code: PUBLIC-FIXTURE')).toBeOnTheScreen();
});

it('holds a reward notice in the background and resumes it when the app becomes active', async () => {
  signIn();
  const { api } = fixture();
  let stateChanged: ((state: AppStateStatus) => void) | undefined;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
    stateChanged = listener as (state: AppStateStatus) => void;
    return { remove: jest.fn() };
  });
  api.watchCelebrations = (_uid, receive) => {
    receive([
      {
        id: 'after-background',
        kind: 'toast',
        copyKey: 'gam.toast.expiring',
        amount: 30,
        createdAt: { toMillis: () => Date.now() },
        seenAt: null,
      },
    ]);
    return () => {};
  };
  await render(
    <GamificationProvider client={api}>
      <CelebrationBridge />
    </GamificationProvider>,
  );
  expect(await screen.findByTestId('gam-update-toast')).toBeOnTheScreen();
  await act(() => stateChanged?.('background'));
  expect(screen.queryByTestId('gam-update-toast')).toBeNull();
  await act(() => stateChanged?.('active'));
  expect(await screen.findByTestId('gam-update-toast')).toBeOnTheScreen();
  expect(screen.getByText('30 Cravos expire soon')).toBeOnTheScreen();
});

it('shows a catalog read error without offering a redemption', async () => {
  signIn();
  const { api } = fixture({ gam_redemption: true });
  api.watchCatalog = (_receive, failed) => {
    failed(new Error('catalog offline'));
    return () => {};
  };
  await render(
    <GamificationProvider client={api}>
      <CravosWallet />
    </GamificationProvider>,
  );
  expect(await screen.findByRole('alert')).toBeOnTheScreen();
  expect(screen.queryByTestId('gam-redeem-coffee')).toBeNull();
  expect(api.redeem).not.toHaveBeenCalled();
});

it('can replay a badge even if the seen acknowledgement fails', async () => {
  signIn();
  const { api } = fixture();
  api.watchCelebrations = (_uid, receive) => {
    receive([
      {
        id: 'badge-inbox',
        kind: 'fullscreen',
        copyKey: 'gam.achievement.faisca',
        achievementId: 'faisca',
        achievementTier: 0,
        createdAt: time,
        seenAt: null,
      },
    ]);
    return () => {};
  };
  jest.mocked(api.markSeen).mockRejectedValueOnce(new Error('offline'));
  await render(
    <GamificationProvider client={api}>
      <CravosWallet />
    </GamificationProvider>,
  );
  await fireEvent.press(await screen.findByTestId('gam-achievement-faisca'));
  await fireEvent.press(await screen.findByText('Replay'));
  expect(await screen.findByText('Achievement unlocked')).toBeOnTheScreen();
  expect(api.markSeen).toHaveBeenCalledWith(TEST_USER.uid, 'badge-inbox');
});
