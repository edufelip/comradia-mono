import { CryptoDigestAlgorithm, digestStringAsync } from 'expo-crypto';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useSessionStore } from '@/features/auth/session-store';
import { gamificationClient } from '@/services/gamification';
import type {
  GamDocument,
  GamificationClient,
  GamPreferences,
} from '@/services/gamification/types';
import { GAM_FLAG_DEFAULTS, isGamUiEnabled, treatmentBucket, type GamFlags } from './flags';
import type { GamCelebration, GamLedgerEntry, GamProjection, GamUserAchievement } from './model';

type MemberData = {
  uid: string;
  member: GamProjection | null;
  achievements: GamDocument<GamUserAchievement>[];
  celebrations: GamDocument<GamCelebration>[];
  ledger: GamDocument<GamLedgerEntry>[];
  loading: boolean;
  offline: boolean;
  error: Error | null;
};

type GamificationContextValue = Omit<MemberData, 'uid'> & {
  flags: GamFlags;
  uiEnabled: boolean;
  programEligible: boolean;
  preferences: GamPreferences;
  uid: string | null;
  client: GamificationClient;
  retry(): void;
};

const EMPTY = {
  member: null,
  achievements: [],
  celebrations: [],
  ledger: [],
  loading: false,
  offline: false,
  error: null,
};
const Context = createContext<GamificationContextValue>({
  ...EMPTY,
  flags: GAM_FLAG_DEFAULTS,
  uiEnabled: false,
  programEligible: false,
  preferences: {},
  uid: null,
  client: gamificationClient,
  retry: () => {},
});

export function GamificationProvider({
  children,
  client = gamificationClient,
}: {
  children: ReactNode;
  client?: GamificationClient;
}) {
  const uid = useSessionStore((state) =>
    state.status === 'ready' ? (state.user?.uid ?? null) : null,
  );
  const [flags, setFlags] = useState<GamFlags>(GAM_FLAG_DEFAULTS);
  const [arm, setArm] = useState<{ uid: string; bucket: number | null } | null>(null);
  const [data, setData] = useState<MemberData | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [preference, setPreference] = useState<{ uid: string; data: GamPreferences } | null>(null);

  useEffect(() => {
    if (uid === null) return;
    return client.watchFlags(setFlags);
  }, [client, uid]);

  useEffect(() => {
    if (uid === null) return;
    let current = true;
    void digestStringAsync(CryptoDigestAlgorithm.SHA256, `gam_v1:${uid}`).then(
      (hash) => {
        if (current) setArm({ uid, bucket: treatmentBucket(hash) });
      },
      () => {
        if (current) setArm({ uid, bucket: null });
      },
    );
    return () => {
      current = false;
    };
  }, [uid]);

  const programUid =
    uid !== null && arm?.uid === uid && isGamUiEnabled(flags, arm.bucket) ? uid : null;
  useEffect(() => {
    if (programUid === null) {
      setPreference(null);
      return;
    }
    let active = true;
    const stop = client.watchPreferences(
      programUid,
      (data) => {
        if (active) setPreference({ uid: programUid, data });
      },
      () => {
        if (active) setPreference(null);
      },
    );
    return () => {
      active = false;
      stop();
    };
  }, [client, programUid]);

  const preferences =
    programUid !== null && preference?.uid === programUid ? preference.data : null;
  const eligibleUid = preferences !== null && preferences.optedOut !== true ? programUid : null;
  useEffect(() => {
    if (eligibleUid === null) {
      setData(null);
      return;
    }

    let current = true;
    setData({ ...EMPTY, uid: eligibleUid, loading: true });
    const update = (next: Partial<MemberData>) => {
      if (current) setData((data) => (data?.uid === eligibleUid ? { ...data, ...next } : data));
    };
    const failed = (error: Error) => update({ error, loading: false });
    const stop = [
      client.watchMember(
        eligibleUid,
        (member, offline = false) => update({ member, offline, loading: false }),
        failed,
      ),
      client.watchLedger(eligibleUid, (ledger) => update({ ledger }), failed),
      client.watchAchievements(eligibleUid, (achievements) => update({ achievements }), failed),
      client.watchCelebrations(eligibleUid, (celebrations) => update({ celebrations }), failed),
    ];
    return () => {
      current = false;
      stop.forEach((unsubscribe) => unsubscribe());
    };
  }, [attempt, client, eligibleUid]);

  const visible = eligibleUid !== null && data?.uid === eligibleUid ? data : EMPTY;
  return (
    <Context.Provider
      value={{
        ...visible,
        flags,
        uiEnabled: eligibleUid !== null,
        programEligible: preferences !== null,
        preferences: preferences ?? {},
        uid: eligibleUid,
        client,
        retry: () => setAttempt((attempt) => attempt + 1),
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function useGamification() {
  return useContext(Context);
}
