import type { GamFlags } from '@/features/gamification/flags';
import type {
  GamCatalogItem,
  GamCelebration,
  GamLedgerEntry,
  GamProjection,
  GamRedeemResult,
  GamRedemption,
  GamTimestamp,
  GamUserAchievement,
} from '@/features/gamification/model';

export type GamDocument<T> = T & { id: string };
type Watch<T> = (value: T) => void;
type Failed = (error: Error) => void;
type Stop = () => void;

export type GamPreferences = {
  optedOut?: boolean;
  pausedUntil?: GamTimestamp | null;
};
export type PreferenceUpdate = { optedOut?: boolean; pauseWeeks?: number };

export type GamificationClient = {
  watchFlags(receive: Watch<GamFlags>): Stop;
  watchPreferences(uid: string, receive: Watch<GamPreferences>, failed: Failed): Stop;
  setPreferences(update: PreferenceUpdate): Promise<void>;
  watchMember(
    uid: string,
    receive: (value: GamProjection | null, offline?: boolean) => void,
    failed: Failed,
  ): Stop;
  watchLedger(uid: string, receive: Watch<GamDocument<GamLedgerEntry>[]>, failed: Failed): Stop;
  watchAchievements(
    uid: string,
    receive: Watch<GamDocument<GamUserAchievement>[]>,
    failed: Failed,
  ): Stop;
  watchCelebrations(
    uid: string,
    receive: Watch<GamDocument<GamCelebration>[]>,
    failed: Failed,
  ): Stop;
  watchCatalog(receive: Watch<GamDocument<GamCatalogItem>[]>, failed: Failed): Stop;
  watchRedemptions(uid: string, receive: Watch<GamDocument<GamRedemption>[]>, failed: Failed): Stop;
  markSeen(uid: string, id: string): Promise<void>;
  redeem(itemId: string, idempotencyKey: string): Promise<GamRedeemResult>;
};
